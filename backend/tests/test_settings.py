import json


async def test_update_and_list_settings(client, admin_headers):
    resp = await client.put(
        "/api/settings/library_name", json={"value": "Test Library"}, headers=admin_headers
    )
    assert resp.status_code == 200
    assert resp.json()["value"] == "Test Library"

    resp = await client.get("/api/settings")
    values = {s["key"]: s["value"] for s in resp.json()}
    assert values["library_name"] == "Test Library"


async def test_unknown_setting_key_rejected(client, admin_headers):
    resp = await client.put("/api/settings/evil_key", json={"value": "x"}, headers=admin_headers)
    assert resp.status_code == 422


async def test_settings_update_requires_admin(client):
    resp = await client.put("/api/settings/library_name", json={"value": "x"})
    assert resp.status_code in (401, 403)


async def test_backup_contains_data(client, admin_headers, sample_copy):
    resp = await client.post("/api/settings/backup", headers=admin_headers)
    assert resp.status_code == 200
    assert "attachment" in resp.headers["content-disposition"]
    backup = json.loads(resp.content)
    assert len(backup["books"]) == 1
    assert len(backup["copies"]) == 1
    assert backup["books"][0]["title"] == "The Hobbit"


async def test_csv_export(client, admin_headers, sample_copy):
    resp = await client.post("/api/settings/export-csv", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/csv")
    lines = resp.text.strip().splitlines()
    assert lines[0].startswith("title,subtitle,authors,isbn13")
    assert lines[1].startswith("The Hobbit,")
    assert "J. R. R. Tolkien" in lines[1]


async def test_backup_restore_roundtrip(client, admin_headers, sample_copy):
    # Loan the copy so every table has data, then export
    await client.post(
        f"/api/loans/copy/{sample_copy['id']}",
        json={"borrower_name": "Sam"},
        headers=admin_headers,
    )
    backup = json.loads((await client.post("/api/settings/backup", headers=admin_headers)).content)

    # Wipe the library
    await client.delete(f"/api/books/{sample_copy['book_id']}", headers=admin_headers)
    assert (await client.get("/api/books")).json() == []

    # Restore and verify everything came back
    resp = await client.post("/api/settings/restore", json=backup, headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["restored"] == {
        "series": 0,
        "books": 1,
        "copies": 1,
        "loans": 1,
        "settings": 0,
    }

    books = (await client.get("/api/books")).json()
    assert books[0]["title"] == "The Hobbit"
    assert books[0]["copy_count"] == 1
    loans = (await client.get("/api/loans")).json()
    assert loans[0]["borrower_name"] == "Sam"
    assert loans[0]["barcode"] == sample_copy["barcode"]


async def test_restore_rejects_unknown_fields(client, admin_headers):
    resp = await client.post(
        "/api/settings/restore",
        json={"books": [{"id": "x", "title": "T", "hacker_field": 1}]},
        headers=admin_headers,
    )
    assert resp.status_code == 422
    assert "hacker_field" in resp.json()["detail"]


async def test_restore_rejects_broken_references(client, admin_headers, sample_book):
    resp = await client.post(
        "/api/settings/restore",
        json={"copies": [{"id": "c1", "book_id": "missing", "barcode": "B-1"}]},
        headers=admin_headers,
    )
    assert resp.status_code == 422
    # Nothing was changed — the original book is still there
    assert len((await client.get("/api/books")).json()) == 1


async def test_restore_requires_admin(client):
    resp = await client.post("/api/settings/restore", json={"books": []})
    assert resp.status_code in (401, 403)
