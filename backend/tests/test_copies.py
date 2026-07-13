async def test_copy_lifecycle(client, admin_headers, sample_book, sample_copy):
    assert sample_copy["barcode"].startswith("BKSHF-")
    assert sample_copy["book_title"] == "The Hobbit"

    # Lookup by barcode
    resp = await client.get(f"/api/copies/by-barcode/{sample_copy['barcode']}")
    assert resp.status_code == 200
    assert resp.json()["id"] == sample_copy["id"]

    # Book response now counts it
    resp = await client.get(f"/api/books/{sample_book['id']}")
    assert resp.json()["copy_count"] == 1
    assert resp.json()["available_copies"] == 1

    # Update
    resp = await client.put(
        f"/api/copies/{sample_copy['id']}",
        json={"location": "Shelf A", "condition": "good"},
        headers=admin_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["location"] == "Shelf A"

    # Barcode image endpoints
    resp = await client.get(f"/api/copies/{sample_copy['id']}/barcode")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "image/svg+xml"
    resp = await client.get(f"/api/copies/{sample_copy['id']}/barcode", params={"format": "qr"})
    assert resp.headers["content-type"] == "image/png"

    # Delete
    resp = await client.delete(f"/api/copies/{sample_copy['id']}", headers=admin_headers)
    assert resp.status_code == 204
    resp = await client.get(f"/api/copies/by-barcode/{sample_copy['barcode']}")
    assert resp.status_code == 404


async def test_copy_uses_default_barcode_format_setting(client, admin_headers, sample_book):
    await client.put(
        "/api/settings/default_barcode_format", json={"value": "qr"}, headers=admin_headers
    )
    resp = await client.post(f"/api/copies/book/{sample_book['id']}", json={}, headers=admin_headers)
    assert resp.json()["barcode_format"] == "qr"

    # Explicit format still wins
    resp = await client.post(
        f"/api/copies/book/{sample_book['id']}",
        json={"barcode_format": "code128"},
        headers=admin_headers,
    )
    assert resp.json()["barcode_format"] == "code128"


async def test_copies_grouped_by_location(client, admin_headers, sample_book):
    for location in ("Study", "Study", "Bedroom", None):
        await client.post(
            f"/api/copies/book/{sample_book['id']}",
            json={"location": location} if location else {},
            headers=admin_headers,
        )

    resp = await client.get("/api/copies/locations")
    assert resp.status_code == 200
    groups = resp.json()
    assert [(g["location"], len(g["copies"])) for g in groups] == [
        ("Bedroom", 1),
        ("Study", 2),
        (None, 1),
    ]
    assert groups[0]["copies"][0]["book_title"] == "The Hobbit"


async def test_copy_for_missing_book_404(client, admin_headers):
    resp = await client.post("/api/copies/book/nope", json={}, headers=admin_headers)
    assert resp.status_code == 404
