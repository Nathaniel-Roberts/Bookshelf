from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db_session, require_admin
from app.models.setting import Setting
from app.services.isbn_lookup import lookup_isbn

router = APIRouter()


@router.get("/isbn/{isbn}")
async def isbn_lookup(
    isbn: str,
    source: str | None = None,
    db: AsyncSession = Depends(get_db_session),
    _: bool = Depends(require_admin),
):
    # If no explicit source, check DB setting
    if not source:
        result = await db.execute(select(Setting).where(Setting.key == "prefer_google_books"))
        setting = result.scalar_one_or_none()
        if setting and setting.value == "true":
            source = "googlebooks"

    data = await lookup_isbn(isbn, preferred_source=source)
    if not data:
        return {"error": "No results found", "isbn": isbn}
    return data
