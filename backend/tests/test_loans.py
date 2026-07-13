async def test_loan_lifecycle(client, admin_headers, sample_copy):
    resp = await client.post(
        f"/api/loans/copy/{sample_copy['id']}",
        json={"borrower_name": "Sam"},
        headers=admin_headers,
    )
    assert resp.status_code == 201
    loan = resp.json()
    assert loan["borrower_name"] == "Sam"
    assert loan["returned_date"] is None
    assert loan["book_title"] == "The Hobbit"

    # Active loans list shows it
    resp = await client.get("/api/loans")
    assert len(resp.json()) == 1

    # Copy can't be double-loaned
    resp = await client.post(
        f"/api/loans/copy/{sample_copy['id']}",
        json={"borrower_name": "Frodo"},
        headers=admin_headers,
    )
    assert resp.status_code == 400

    # Return it
    resp = await client.put(f"/api/loans/{loan['id']}/return", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["returned_date"] is not None

    # Can't return twice
    resp = await client.put(f"/api/loans/{loan['id']}/return", headers=admin_headers)
    assert resp.status_code == 400

    # No active loans left; history keeps the record
    resp = await client.get("/api/loans")
    assert resp.json() == []
    resp = await client.get("/api/loans/history")
    assert len(resp.json()) == 1


async def test_loan_missing_copy_404(client, admin_headers):
    resp = await client.post(
        "/api/loans/copy/nope", json={"borrower_name": "Sam"}, headers=admin_headers
    )
    assert resp.status_code == 404


async def test_return_by_barcode(client, admin_headers, sample_copy):
    # No active loan yet
    resp = await client.put(
        f"/api/loans/return-by-barcode/{sample_copy['barcode']}", headers=admin_headers
    )
    assert resp.status_code == 404

    await client.post(
        f"/api/loans/copy/{sample_copy['id']}",
        json={"borrower_name": "Sam"},
        headers=admin_headers,
    )
    resp = await client.put(
        f"/api/loans/return-by-barcode/{sample_copy['barcode']}", headers=admin_headers
    )
    assert resp.status_code == 200
    assert resp.json()["returned_date"] is not None

    # Unknown barcode
    resp = await client.put("/api/loans/return-by-barcode/NOPE", headers=admin_headers)
    assert resp.status_code == 404


async def test_borrowers_list(client, admin_headers, sample_copy):
    await client.post(
        f"/api/loans/copy/{sample_copy['id']}",
        json={"borrower_name": "Sam"},
        headers=admin_headers,
    )
    resp = await client.get("/api/loans/borrowers")
    assert resp.json() == ["Sam"]
