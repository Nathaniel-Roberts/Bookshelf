"""Cover cache service with httpx stubbed and a sqlite session."""

import httpx
import pytest
from sqlalchemy import select

from app.config import settings
from app.models.book import Book
from app.services import covers
from app.services.covers import cache_cover, delete_cached_cover


class StubClient:
    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def get(self, url, **kwargs):
        request = httpx.Request("GET", url)
        if url.endswith("cover.jpg"):
            return httpx.Response(
                200, content=b"\xff" * 100, headers={"content-type": "image/jpeg"}, request=request
            )
        if url.endswith("page.html"):
            return httpx.Response(
                200, content=b"<html>", headers={"content-type": "text/html"}, request=request
            )
        return httpx.Response(404, request=request)


@pytest.fixture
def covers_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "covers_dir", str(tmp_path / "covers"))
    monkeypatch.setattr(covers.httpx, "AsyncClient", StubClient)
    return tmp_path / "covers"


async def test_cache_cover_downloads_and_updates_book(
    client, admin_headers, sample_book, covers_dir, db_engine
):
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

    factory = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    book_id = sample_book["id"]

    await cache_cover(book_id, "https://example.com/cover.jpg", session_factory=factory)

    assert (covers_dir / f"{book_id}.jpg").read_bytes() == b"\xff" * 100
    async with factory() as session:
        book = (await session.execute(select(Book).where(Book.id == book_id))).scalar_one()
        assert book.cover_local == f"/api/covers/{book_id}.jpg"

    # Deleting removes the file
    delete_cached_cover(book_id)
    assert not (covers_dir / f"{book_id}.jpg").exists()


async def test_cache_cover_ignores_non_images(covers_dir):
    await cache_cover("some-id", "https://example.com/page.html")
    assert list(covers_dir.glob("some-id.*")) == []


async def test_cache_cover_survives_network_failure(covers_dir):
    # 404 and connection-level failures must not raise
    await cache_cover("some-id", "https://example.com/missing")
    assert list(covers_dir.glob("some-id.*")) == []
