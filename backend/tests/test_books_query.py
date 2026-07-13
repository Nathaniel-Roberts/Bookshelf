"""Aggregate-based list endpoint: availability filters, pagination, facets."""

import pytest


@pytest.fixture
async def library(client, admin_headers):
    """Three books: one with an available copy, one fully on loan, one with no copies."""
    books = {}
    for title, genres, tags, authors in (
        ("Available Book", ["Fantasy"], ["own"], ["Alice Author"]),
        ("Loaned Book", ["Sci-Fi"], ["lent"], ["Bob Writer"]),
        ("Copyless Book", ["Fantasy"], [], ["Alice Author"]),
    ):
        resp = await client.post(
            "/api/books",
            json={"title": title, "genres": genres, "tags": tags, "authors": authors},
            headers=admin_headers,
        )
        books[title] = resp.json()

    for title in ("Available Book", "Loaned Book"):
        resp = await client.post(
            f"/api/copies/book/{books[title]['id']}", json={}, headers=admin_headers
        )
        books[title]["copy"] = resp.json()

    await client.post(
        f"/api/loans/copy/{books['Loaned Book']['copy']['id']}",
        json={"borrower_name": "Sam"},
        headers=admin_headers,
    )
    return books


async def test_counts_reflect_loans(client, library):
    resp = await client.get("/api/books")
    by_title = {b["title"]: b for b in resp.json()}
    assert by_title["Available Book"]["copy_count"] == 1
    assert by_title["Available Book"]["available_copies"] == 1
    assert by_title["Loaned Book"]["copy_count"] == 1
    assert by_title["Loaned Book"]["available_copies"] == 0
    assert by_title["Copyless Book"]["copy_count"] == 0


async def test_availability_filters(client, library):
    resp = await client.get("/api/books", params={"availability": "available"})
    assert [b["title"] for b in resp.json()] == ["Available Book"]

    resp = await client.get("/api/books", params={"availability": "on_loan"})
    assert [b["title"] for b in resp.json()] == ["Loaned Book"]


async def test_pagination(client, library):
    resp = await client.get("/api/books", params={"limit": 2, "sort": "title"})
    assert [b["title"] for b in resp.json()] == ["Available Book", "Copyless Book"]

    resp = await client.get("/api/books", params={"limit": 2, "offset": 2, "sort": "title"})
    assert [b["title"] for b in resp.json()] == ["Loaned Book"]


async def test_stats_collection_value(client, admin_headers, sample_book):
    resp = await client.get("/api/books/stats")
    assert resp.json() == {"total_value": 0.0, "priced_copies": 0}

    for price in ("12.50", "7.25", None):
        await client.post(
            f"/api/copies/book/{sample_book['id']}",
            json={"acquisition_price": price},
            headers=admin_headers,
        )

    resp = await client.get("/api/books/stats")
    assert resp.json() == {"total_value": 19.75, "priced_copies": 2}


async def test_author_filter(client, library):
    resp = await client.get("/api/books", params={"author": "Alice Author"})
    assert sorted(b["title"] for b in resp.json()) == ["Available Book", "Copyless Book"]

    resp = await client.get("/api/books", params={"author": "Nobody"})
    assert resp.json() == []


async def test_facets(client, library):
    resp = await client.get("/api/books/facets")
    assert resp.status_code == 200
    facets = resp.json()
    assert facets["genres"] == ["Fantasy", "Sci-Fi"]
    assert facets["tags"] == ["lent", "own"]
    assert facets["authors"] == ["Alice Author", "Bob Writer"]
