async def test_create_and_get_book(client, admin_headers, sample_book):
    resp = await client.get(f"/api/books/{sample_book['id']}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["title"] == "The Hobbit"
    assert body["isbn13"] == "9780261103283"
    assert body["copy_count"] == 0


async def test_get_missing_book_404(client):
    resp = await client.get("/api/books/nope")
    assert resp.status_code == 404


async def test_duplicate_isbn_on_create(client, admin_headers, sample_book):
    resp = await client.post(
        "/api/books",
        json={"title": "Duplicate", "isbn13": "9780261103283"},
        headers=admin_headers,
    )
    assert resp.status_code == 409


async def test_duplicate_isbn_on_update(client, admin_headers, sample_book):
    resp = await client.post(
        "/api/books", json={"title": "Other", "isbn13": "9780261102217"}, headers=admin_headers
    )
    other = resp.json()
    resp = await client.put(
        f"/api/books/{other['id']}", json={"isbn13": "9780261103283"}, headers=admin_headers
    )
    assert resp.status_code == 409


async def test_update_own_isbn_is_not_duplicate(client, admin_headers, sample_book):
    resp = await client.put(
        f"/api/books/{sample_book['id']}",
        json={"isbn13": "9780261103283", "rating": 5},
        headers=admin_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["rating"] == 5


async def test_validation_rejects_bad_values(client, admin_headers):
    for payload in (
        {"title": "X", "rating": 6},
        {"title": "X", "rating": 200},
        {"title": "X", "page_count": -1},
        {"title": "X", "isbn13": "123"},
        {"title": "X", "isbn10": "ZZZ"},
        {"title": ""},
        {"title": "X", "metadata_source": "wikipedia"},
    ):
        resp = await client.post("/api/books", json=payload, headers=admin_headers)
        assert resp.status_code == 422, payload


async def test_empty_strings_coerced_to_null(client, admin_headers):
    resp = await client.post(
        "/api/books",
        json={"title": "Blanks", "isbn13": "", "isbn10": "", "subtitle": "", "metadata_source": ""},
        headers=admin_headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["isbn13"] is None
    assert body["subtitle"] is None
    assert body["metadata_source"] == "manual"

    # A second book with blank ISBN must not collide on the unique constraint
    resp = await client.post(
        "/api/books", json={"title": "Blanks 2", "isbn13": ""}, headers=admin_headers
    )
    assert resp.status_code == 201


async def test_lookup_by_isbn(client, admin_headers, sample_book):
    # Exact, hyphenated, and 404 cases
    resp = await client.get("/api/books/by-isbn/9780261103283")
    assert resp.status_code == 200
    assert resp.json()["id"] == sample_book["id"]

    resp = await client.get("/api/books/by-isbn/978-0-261-10328-3")
    assert resp.status_code == 200

    resp = await client.get("/api/books/by-isbn/9999999999999")
    assert resp.status_code == 404


async def test_search_and_filters(client, admin_headers, sample_book):
    await client.post(
        "/api/books",
        json={"title": "Dune", "genres": ["Sci-Fi"], "tags": ["space"], "is_favourite": True},
        headers=admin_headers,
    )

    resp = await client.get("/api/books", params={"search": "dune"})
    assert [b["title"] for b in resp.json()] == ["Dune"]

    resp = await client.get("/api/books", params={"genre": "Sci-Fi"})
    assert [b["title"] for b in resp.json()] == ["Dune"]

    resp = await client.get("/api/books", params={"tag": "space"})
    assert [b["title"] for b in resp.json()] == ["Dune"]

    resp = await client.get("/api/books", params={"is_favourite": "true"})
    assert [b["title"] for b in resp.json()] == ["Dune"]

    # LIKE wildcards are escaped: '%' must not match everything
    resp = await client.get("/api/books", params={"search": "%"})
    assert resp.json() == []


async def test_sort_rejects_unknown_field(client):
    resp = await client.get("/api/books", params={"sort": "series"})
    assert resp.status_code == 422


async def test_delete_book(client, admin_headers, sample_book):
    resp = await client.delete(f"/api/books/{sample_book['id']}", headers=admin_headers)
    assert resp.status_code == 204
    resp = await client.get(f"/api/books/{sample_book['id']}")
    assert resp.status_code == 404
