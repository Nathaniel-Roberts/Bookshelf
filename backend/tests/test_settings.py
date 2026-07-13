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
