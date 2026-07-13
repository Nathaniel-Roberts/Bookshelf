async def test_series_total_books_roundtrip(client, admin_headers):
    resp = await client.post(
        "/api/series",
        json={"name": "Discworld", "total_books": 41},
        headers=admin_headers,
    )
    assert resp.status_code == 201
    series = resp.json()
    assert series["total_books"] == 41

    resp = await client.put(
        f"/api/series/{series['id']}", json={"total_books": 40}, headers=admin_headers
    )
    assert resp.json()["total_books"] == 40

    # Clearing works, and invalid totals are rejected
    resp = await client.put(
        f"/api/series/{series['id']}", json={"total_books": None}, headers=admin_headers
    )
    assert resp.json()["total_books"] is None
    resp = await client.put(
        f"/api/series/{series['id']}", json={"total_books": 0}, headers=admin_headers
    )
    assert resp.status_code == 422


async def test_series_book_count(client, admin_headers, sample_book):
    resp = await client.post("/api/series", json={"name": "Middle Earth"}, headers=admin_headers)
    series = resp.json()
    await client.put(
        f"/api/books/{sample_book['id']}",
        json={"series_id": series["id"], "series_position": "1"},
        headers=admin_headers,
    )
    resp = await client.get(f"/api/series/{series['id']}")
    assert resp.json()["book_count"] == 1
