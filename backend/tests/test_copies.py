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


async def test_copy_for_missing_book_404(client, admin_headers):
    resp = await client.post("/api/copies/book/nope", json={}, headers=admin_headers)
    assert resp.status_code == 404
