"""Parsing tests for the ISBN lookup service with httpx stubbed out."""

import httpx
import pytest

from app.services import isbn_lookup
from app.services.isbn_lookup import _normalize_isbn, lookup_isbn

OL_BOOK = {
    "title": "The Hobbit",
    "subtitle": "or There and Back Again",
    "authors": [{"key": "/authors/OL26320A"}],
    "publishers": ["Allen & Unwin"],
    "publish_date": "1937",
    "description": {"value": "A hobbit goes on an adventure."},
    "number_of_pages": 310,
}

OL_AUTHOR = {"name": "J. R. R. Tolkien"}

GOOGLE_VOLUME = {
    "items": [
        {
            "volumeInfo": {
                "title": "The Hobbit",
                "authors": ["J. R. R. Tolkien"],
                "publisher": "HarperCollins",
                "publishedDate": "2012",
                "description": "An adventure.",
                "pageCount": 300,
                "language": "en",
                "categories": ["Fiction"],
                "industryIdentifiers": [
                    {"type": "ISBN_13", "identifier": "9780261103283"},
                    {"type": "ISBN_10", "identifier": "0261103288"},
                ],
                "imageLinks": {"thumbnail": "http://books.google.com/thumb?zoom=1"},
            }
        }
    ]
}


class StubClient:
    """Minimal httpx.AsyncClient stand-in returning canned responses by URL."""

    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    def stream(self, method, url, **kwargs):
        client = self

        class _StreamCM:
            async def __aenter__(self):
                self._resp = await client.get(url, **kwargs)
                return self._resp

            async def __aexit__(self, *exc):
                return False

        return _StreamCM()

    async def get(self, url, **kwargs):
        request = httpx.Request("GET", url)
        if "openlibrary.org/isbn" in url:
            return httpx.Response(200, json=OL_BOOK, request=request)
        if "openlibrary.org/authors" in url:
            return httpx.Response(200, json=OL_AUTHOR, request=request)
        if "googleapis.com" in url:
            return httpx.Response(200, json=GOOGLE_VOLUME, request=request)
        if "covers.openlibrary.org" in url or "books.google.com" in url:
            # Big enough to pass the placeholder-size check
            return httpx.Response(
                200, content=b"\xff" * 30000, headers={"content-type": "image/jpeg"}, request=request
            )
        return httpx.Response(404, request=request)


@pytest.fixture
def stub_httpx(monkeypatch):
    monkeypatch.setattr(isbn_lookup.httpx, "AsyncClient", StubClient)


def test_normalize_isbn():
    assert _normalize_isbn("978-0-261-10328-3") == "9780261103283"
    assert _normalize_isbn("0 8044 2957 x") == "080442957X"


async def test_openlibrary_parsing(stub_httpx):
    result = await lookup_isbn("9780261103283", preferred_source="openlibrary")
    assert result["title"] == "The Hobbit"
    assert result["authors"] == ["J. R. R. Tolkien"]
    assert result["publisher"] == "Allen & Unwin"
    assert result["description"] == "A hobbit goes on an adventure."
    assert result["page_count"] == 310
    assert result["isbn13"] == "9780261103283"
    assert result["metadata_source"] == "openlibrary"
    assert result["cover_url"]


async def test_google_parsing(stub_httpx, monkeypatch):
    monkeypatch.setattr(isbn_lookup.settings, "google_books_api_key", "test-key")
    result = await lookup_isbn("9780261103283", preferred_source="googlebooks")
    assert result["title"] == "The Hobbit"
    assert result["publisher"] == "HarperCollins"
    assert result["genres"] == ["Fiction"]
    assert result["isbn10"] == "0261103288"
    assert result["metadata_source"] == "googlebooks"
    # http thumbnail is upgraded to https
    assert result["cover_url"].startswith("https://")


async def test_google_without_api_key_returns_none(monkeypatch):
    monkeypatch.setattr(isbn_lookup.settings, "google_books_api_key", "")
    assert await isbn_lookup._lookup_google("9780261103283") is None
