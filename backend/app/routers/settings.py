import json
from datetime import date, datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db_session, require_admin
from app.models.book import Book
from app.models.copy import Copy
from app.models.loan import Loan
from app.models.series import Series
from app.models.setting import Setting
from app.schemas.settings import SettingResponse, SettingUpdate
from app.services.dolt import dolt_commit

router = APIRouter()


@router.get("", response_model=list[SettingResponse])
async def list_settings(db: AsyncSession = Depends(get_db_session)):
    result = await db.execute(select(Setting).order_by(Setting.key))
    return [SettingResponse.model_validate(s) for s in result.scalars().all()]


@router.put("/{key}", response_model=SettingResponse)
async def update_setting(
    key: str,
    data: SettingUpdate,
    db: AsyncSession = Depends(get_db_session),
    _: bool = Depends(require_admin),
):
    result = await db.execute(select(Setting).where(Setting.key == key))
    setting = result.scalar_one_or_none()
    if not setting:
        setting = Setting(key=key, value=data.value)
        db.add(setting)
    else:
        setting.value = data.value

    await db.commit()
    await dolt_commit(db, f"Update setting: {key}")
    return SettingResponse(key=setting.key, value=setting.value)


def _serialize(obj):
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if isinstance(obj, Decimal):
        return float(obj)
    return obj


def _row_to_dict(row) -> dict:
    d = {}
    for col in row.__table__.columns:
        val = getattr(row, col.key)
        d[col.key] = _serialize(val)
    return d


@router.post("/backup")
async def create_backup(
    db: AsyncSession = Depends(get_db_session),
    _: bool = Depends(require_admin),
):
    series = (await db.execute(select(Series))).scalars().all()
    books = (await db.execute(select(Book))).scalars().all()
    copies = (await db.execute(select(Copy))).scalars().all()
    loans = (await db.execute(select(Loan))).scalars().all()
    settings = (await db.execute(select(Setting))).scalars().all()

    backup = {
        "exported_at": datetime.utcnow().isoformat(),
        "series": [_row_to_dict(r) for r in series],
        "books": [_row_to_dict(r) for r in books],
        "copies": [_row_to_dict(r) for r in copies],
        "loans": [_row_to_dict(r) for r in loans],
        "settings": [_row_to_dict(r) for r in settings],
    }

    content = json.dumps(backup, indent=2, default=str)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")

    return Response(
        content=content,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="bookshelf_backup_{timestamp}.json"'},
    )
