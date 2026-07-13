"""Goodreads / StoryGraph library CSV parsing and post-import enrichment."""

import csv
import io
import logging
import re

from sqlalchemy import select

from app.database import async_session
from app.models.book import Book
from app.services.covers import cache_cover
from app.services.dolt import dolt_commit
from app.services.isbn_lookup import lookup_isbn

logger = logging.getLogger(__name__)

_STATUS_MAP = {
    "read": "read",
    "currently-reading": "reading",
    "to-read": "want",
}


def _clean_isbn(value: str | None) -> str | None:
    # Goodreads wraps ISBNs like ="9780261103283" to stop Excel mangling them
    cleaned = re.sub(r"[^0-9X]", "", (value or "").upper())
    return cleaned or None


def _map_status(value: str | None) -> str:
    return _STATUS_MAP.get((value or "").strip().lower(), "owned")


def _parse_rating(value: str | None) -> int | None:
    try:
        rating = round(float(value or 0))
    except ValueError:
        return None
    return rating if 1 <= rating <= 5 else None


def _int_or_none(value: str | None) -> int | None:
    try:
        number = int(value or "")
        return number if number > 0 else None
    except ValueError:
        return None


def parse_import_csv(text: str) -> list[dict]:
    """Detect Goodreads vs StoryGraph by their headers and normalise rows to
    BookCreate-shaped dicts. Raises ValueError for unrecognised files."""
    reader = csv.DictReader(io.StringIO(text))
    fields = set(reader.fieldnames or [])

    if "Exclusive Shelf" in fields or "Bookshelves" in fields:
        source = "goodreads"
    elif "Read Status" in fields:
        source = "storygraph"
    else:
        raise ValueError(
            "Unrecognised CSV format — expected a Goodreads or StoryGraph library export"
        )

    rows = []
    for row in reader:
        title = (row.get("Title") or "").strip()
        if not title:
            continue

        if source == "goodreads":
            authors = [a.strip() for a in [row.get("Author") or ""] if a.strip()]
            authors += [
                a.strip() for a in (row.get("Additional Authors") or "").split(",") if a.strip()
            ]
            isbn13 = _clean_isbn(row.get("ISBN13"))
            isbn10 = _clean_isbn(row.get("ISBN"))
            status = _map_status(row.get("Exclusive Shelf"))
            rating = _parse_rating(row.get("My Rating"))
            publisher = (row.get("Publisher") or "").strip() or None
            publish_date = (row.get("Year Published") or "").strip() or None
            page_count = _int_or_none(row.get("Number of Pages"))
        else:
            authors = [a.strip() for a in (row.get("Authors") or "").split(",") if a.strip()]
            uid = _clean_isbn(row.get("ISBN/UID"))
            isbn13 = uid if uid and len(uid) == 13 else None
            isbn10 = uid if uid and len(uid) == 10 else None
            status = _map_status(row.get("Read Status"))
            rating = _parse_rating(row.get("Star Rating"))
            publisher = None
            publish_date = None
            page_count = None

        rows.append(
            {
                "title": title,
                "authors": authors or None,
                "isbn13": isbn13 if isbn13 and len(isbn13) == 13 else None,
                "isbn10": isbn10 if isbn10 and len(isbn10) == 10 else None,
                "status": status,
                "rating": rating,
                "publisher": publisher,
                "publish_date": publish_date,
                "page_count": page_count,
                "metadata_source": "manual",
            }
        )
    return rows


async def enrich_imported_books(items: list[tuple[str, str]], session_factory=None) -> None:
    """Background task: fill in metadata and covers for imported books via
    the normal ISBN lookup pipeline. Sequential on purpose — gentle on the
    external APIs, and an import is a one-off."""
    factory = session_factory or async_session
    for book_id, isbn in items:
        try:
            data = await lookup_isbn(isbn)
            if not data:
                continue
            async with factory() as session:
                book = (
                    await session.execute(select(Book).where(Book.id == book_id))
                ).scalar_one_or_none()
                if not book:
                    continue
                for field in (
                    "subtitle",
                    "publisher",
                    "publish_date",
                    "description",
                    "page_count",
                    "cover_url",
                    "genres",
                    "language",
                ):
                    if getattr(book, field) in (None, "", []) and data.get(field):
                        setattr(book, field, data[field])
                if data.get("metadata_source"):
                    book.metadata_source = data["metadata_source"]
                cover_url = book.cover_url
                await session.commit()
                await dolt_commit(session, f"Enrich imported book: {book.title}")
            if cover_url:
                await cache_cover(book_id, cover_url, session_factory=session_factory)
        except Exception as exc:
            logger.warning("Enrichment failed for %s (%s): %s", book_id, isbn, exc)
