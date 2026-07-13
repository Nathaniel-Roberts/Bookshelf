import asyncio
import re

import httpx

from app.config import settings


def _normalize_isbn(isbn: str) -> str:
    return re.sub(r"[^0-9X]", "", isbn.upper())


# Google's "image not available" placeholder is ~9-12KB; real covers are
# always larger.
_MIN_COVER_BYTES = 20000


async def _check_cover_url(client: httpx.AsyncClient, url: str) -> str | None:
    """Verify a cover URL returns an actual image (not a placeholder).

    Streams the response so we can stop as soon as the size threshold is
    reached instead of downloading the whole image.
    """
    try:
        async with client.stream("GET", url, follow_redirects=True) as resp:
            final_url = str(resp.url)
            # Google Books redirects to a "nophoto" URL for missing covers
            if "nophoto" in final_url or "image_not_available" in final_url:
                return None
            if resp.status_code != 200:
                return None
            if "image" not in resp.headers.get("content-type", ""):
                return None
            content_length = resp.headers.get("content-length")
            if content_length is not None:
                return url if int(content_length) >= _MIN_COVER_BYTES else None
            size = 0
            async for chunk in resp.aiter_bytes(8192):
                size += len(chunk)
                if size >= _MIN_COVER_BYTES:
                    return url
    except Exception:
        pass
    return None


async def _lookup_openlibrary(isbn: str) -> dict | None:
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(f"https://openlibrary.org/isbn/{isbn}.json", follow_redirects=True)
        if resp.status_code != 200:
            return None
        data = resp.json()

        # Resolve author names concurrently, along with the cover check
        author_keys = [ref.get("key", "") for ref in data.get("authors", []) if ref.get("key")]
        author_responses, cover_url = await asyncio.gather(
            asyncio.gather(
                *(client.get(f"https://openlibrary.org{key}.json") for key in author_keys)
            ),
            # OL returns a tiny 1x1 gif for missing covers
            _check_cover_url(client, f"https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg"),
        )
        authors = [
            resp.json().get("name", "Unknown")
            for resp in author_responses
            if resp.status_code == 200
        ]

        return {
            "title": data.get("title"),
            "subtitle": data.get("subtitle"),
            "authors": authors or None,
            "publisher": (data.get("publishers") or [None])[0],
            "publish_date": data.get("publish_date"),
            "description": data.get("description", {}).get("value")
            if isinstance(data.get("description"), dict)
            else data.get("description"),
            "page_count": data.get("number_of_pages"),
            "cover_url": cover_url,
            "language": None,
            "isbn13": isbn if len(isbn) == 13 else None,
            "isbn10": isbn if len(isbn) == 10 else None,
            "metadata_source": "openlibrary",
        }


async def _lookup_google(isbn: str) -> dict | None:
    api_key = settings.google_books_api_key
    if not api_key:
        return None

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            "https://www.googleapis.com/books/v1/volumes",
            params={"q": f"isbn:{isbn}", "key": api_key},
        )
        if resp.status_code != 200:
            return None
        data = resp.json()
        items = data.get("items", [])
        if not items:
            return None

        item = items[0]
        info = item.get("volumeInfo", {})
        identifiers = {i["type"]: i["identifier"] for i in info.get("industryIdentifiers", [])}

        # Build cover URL — try zoom=0 (largest), fall back to zoom=1 (thumbnail as-is)
        cover_url = None
        image_links = info.get("imageLinks", {})
        thumbnail = (
            image_links.get("extraLarge")
            or image_links.get("large")
            or image_links.get("medium")
            or image_links.get("small")
            or image_links.get("thumbnail")
            or image_links.get("smallThumbnail")
        )
        if thumbnail:
            # Force https and clean up the URL
            thumbnail = thumbnail.replace("http://", "https://").replace("&edge=curl", "")
            # Try zoom=0 first (best quality), validate it's a real image
            zoom0_url = thumbnail.replace("zoom=1", "zoom=0")
            cover_url = await _check_cover_url(client, zoom0_url)
            if not cover_url:
                # Fall back to original thumbnail URL
                cover_url = await _check_cover_url(client, thumbnail)

        return {
            "title": info.get("title"),
            "subtitle": info.get("subtitle"),
            "authors": info.get("authors"),
            "publisher": info.get("publisher"),
            "publish_date": info.get("publishedDate"),
            "description": info.get("description"),
            "page_count": info.get("pageCount"),
            "cover_url": cover_url,
            "language": info.get("language"),
            "genres": info.get("categories"),
            "isbn13": identifiers.get("ISBN_13", isbn if len(isbn) == 13 else None),
            "isbn10": identifiers.get("ISBN_10", isbn if len(isbn) == 10 else None),
            "metadata_source": "googlebooks",
        }


async def lookup_isbn(isbn: str, preferred_source: str | None = None) -> dict | None:
    isbn = _normalize_isbn(isbn)

    if preferred_source == "googlebooks":
        result = await _lookup_google(isbn)
    elif preferred_source == "openlibrary":
        result = await _lookup_openlibrary(isbn)
    else:
        # Default: try Open Library first, fall back to Google
        result = await _lookup_openlibrary(isbn)
        if not result or not result.get("title"):
            result = await _lookup_google(isbn)

    if not result:
        return None

    # If primary source has no cover, try the other source just for the cover
    if not result.get("cover_url"):
        alt_source = "openlibrary" if result.get("metadata_source") == "googlebooks" else "googlebooks"
        if alt_source == "googlebooks":
            alt = await _lookup_google(isbn)
        else:
            alt = await _lookup_openlibrary(isbn)
        if alt and alt.get("cover_url"):
            result["cover_url"] = alt["cover_url"]

    return result
