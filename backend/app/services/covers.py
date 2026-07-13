import logging
from pathlib import Path

import httpx
from sqlalchemy import update

from app.config import settings
from app.database import async_session
from app.models.book import Book
from app.services.dolt import dolt_commit

logger = logging.getLogger(__name__)

_CONTENT_TYPE_EXT = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}


def covers_path() -> Path:
    path = Path(settings.covers_dir)
    path.mkdir(parents=True, exist_ok=True)
    return path


def delete_cached_cover(book_id: str) -> None:
    for file in covers_path().glob(f"{book_id}.*"):
        file.unlink(missing_ok=True)


async def cache_cover(book_id: str, cover_url: str, session_factory=None) -> None:
    """Download a book's cover to the covers volume and point cover_local at
    it. Runs as a background task after create/update; failures just leave
    the book hotlinking cover_url as before."""
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(cover_url, follow_redirects=True)
            if resp.status_code != 200:
                return
            content_type = resp.headers.get("content-type", "").split(";")[0].strip()
            ext = _CONTENT_TYPE_EXT.get(content_type)
            if not ext or not resp.content:
                return
            filename = f"{book_id}{ext}"
            (covers_path() / filename).write_bytes(resp.content)
    except Exception as exc:
        logger.warning("Cover download failed for book %s: %s", book_id, exc)
        return

    factory = session_factory or async_session
    async with factory() as session:
        await session.execute(
            update(Book).where(Book.id == book_id).values(cover_local=f"/api/covers/{filename}")
        )
        await session.commit()
        await dolt_commit(session, "Cache cover image")
