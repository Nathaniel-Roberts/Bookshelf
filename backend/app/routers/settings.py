import csv
import io
import json
from datetime import UTC, date, datetime
from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.deps import require_admin
from app.models.book import Book
from app.models.copy import Copy
from app.models.loan import Loan
from app.models.series import Series
from app.models.setting import Setting
from app.schemas.settings import SettingResponse, SettingUpdate
from app.services.dolt import dolt_commit
from app.services.notifications import check_overdue_and_notify

router = APIRouter()

# Keys the app actually reads; anything else is rejected to keep the
# settings table from accumulating junk rows.
ALLOWED_SETTING_KEYS = {
    "library_name",
    "prefer_google_books",
    "default_barcode_format",
    "overdue_webhook_url",
}


@router.get("", response_model=list[SettingResponse])
async def list_settings(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Setting).order_by(Setting.key))
    return [SettingResponse.model_validate(s) for s in result.scalars().all()]


@router.put("/{key}", response_model=SettingResponse)
async def update_setting(
    key: str,
    data: SettingUpdate,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(require_admin),
):
    if key not in ALLOWED_SETTING_KEYS:
        raise HTTPException(status_code=422, detail=f"Unknown setting: {key}")

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
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(require_admin),
):
    series = (await db.execute(select(Series))).scalars().all()
    books = (await db.execute(select(Book))).scalars().all()
    copies = (await db.execute(select(Copy))).scalars().all()
    loans = (await db.execute(select(Loan))).scalars().all()
    settings = (await db.execute(select(Setting))).scalars().all()

    backup = {
        "exported_at": datetime.now(UTC).isoformat(),
        "series": [_row_to_dict(r) for r in series],
        "books": [_row_to_dict(r) for r in books],
        "copies": [_row_to_dict(r) for r in copies],
        "loans": [_row_to_dict(r) for r in loans],
        "settings": [_row_to_dict(r) for r in settings],
    }

    content = json.dumps(backup, indent=2, default=str)
    timestamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")

    return Response(
        content=content,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="bookshelf_backup_{timestamp}.json"'},
    )


@router.post("/notify-overdue")
async def notify_overdue_now(_: bool = Depends(require_admin)):
    """Run the overdue check immediately — lets the webhook be tested from
    Settings without waiting for the daily loop."""
    return await check_overdue_and_notify()


@router.post("/export-csv")
async def export_csv(
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(require_admin),
):
    """Spreadsheet-friendly export: one row per book with copy/value info."""
    result = await db.execute(
        select(Book).options(selectinload(Book.copies), selectinload(Book.series)).order_by(Book.title)
    )
    books = result.scalars().unique().all()

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "title",
            "subtitle",
            "authors",
            "isbn13",
            "isbn10",
            "publisher",
            "publish_date",
            "series",
            "series_position",
            "genres",
            "tags",
            "rating",
            "language",
            "page_count",
            "copies",
            "locations",
            "total_value",
        ]
    )
    for book in books:
        total_value = sum((c.acquisition_price or Decimal(0)) for c in book.copies)
        locations = sorted({c.location for c in book.copies if c.location})
        writer.writerow(
            [
                book.title,
                book.subtitle or "",
                "; ".join(book.authors or []),
                book.isbn13 or "",
                book.isbn10 or "",
                book.publisher or "",
                book.publish_date or "",
                book.series.name if book.series else "",
                book.series_position or "",
                "; ".join(book.genres or []),
                "; ".join(book.tags or []),
                book.rating or "",
                book.language or "",
                book.page_count or "",
                len(book.copies),
                "; ".join(locations),
                f"{total_value:.2f}" if total_value else "",
            ]
        )

    timestamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="bookshelf_books_{timestamp}.csv"'},
    )


class RestorePayload(BaseModel):
    exported_at: str | None = None
    series: list[dict] = []
    books: list[dict] = []
    copies: list[dict] = []
    loans: list[dict] = []
    settings: list[dict] = []


def _row_from_dict(model_cls, row: dict):
    """Build a model instance from a backup row, coercing ISO strings back
    to dates/decimals and rejecting unknown fields."""
    columns = {c.key: c for c in model_cls.__table__.columns}
    unknown = set(row) - set(columns)
    if unknown:
        raise ValueError(f"{model_cls.__tablename__}: unknown fields {sorted(unknown)}")

    data = {}
    for key, column in columns.items():
        value = row.get(key)
        if value is None:
            continue
        try:
            python_type = column.type.python_type
        except NotImplementedError:  # JSON columns
            python_type = None
        if python_type is datetime and isinstance(value, str):
            value = datetime.fromisoformat(value)
        elif python_type is date and isinstance(value, str):
            value = date.fromisoformat(value)
        elif python_type is Decimal:
            value = Decimal(str(value))
        data[key] = value
    return model_cls(**data)


@router.post("/restore")
async def restore_backup(
    payload: RestorePayload,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(require_admin),
):
    """Replace the entire library with the contents of a JSON backup.

    Everything happens in one transaction, and the result is a single Dolt
    commit — so even a bad restore can be found in History.
    """
    try:
        series = [_row_from_dict(Series, r) for r in payload.series]
        books = [_row_from_dict(Book, r) for r in payload.books]
        copies = [_row_from_dict(Copy, r) for r in payload.copies]
        loans = [_row_from_dict(Loan, r) for r in payload.loans]
        setting_rows = [
            _row_from_dict(Setting, r)
            for r in payload.settings
            if r.get("key") in ALLOWED_SETTING_KEYS
        ]
    except (ValueError, InvalidOperation) as exc:
        raise HTTPException(status_code=422, detail=f"Invalid backup data: {exc}") from exc

    # Delete children before parents, insert parents before children
    for model_cls in (Loan, Copy, Book, Series, Setting):
        await db.execute(delete(model_cls))
    db.add_all([*series, *books, *copies, *loans, *setting_rows])

    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=422,
            detail="Backup data violates database constraints (missing required fields "
            "or broken references); nothing was changed",
        ) from exc

    await dolt_commit(db, f"Restore backup (exported {payload.exported_at or 'unknown'})")
    return {
        "restored": {
            "series": len(series),
            "books": len(books),
            "copies": len(copies),
            "loans": len(loans),
            "settings": len(setting_rows),
        }
    }
