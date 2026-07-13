async def test_revert_requires_admin(client):
    resp = await client.post("/api/history/revert/" + "0" * 32)
    assert resp.status_code in (401, 403)


async def test_revert_rejects_bad_hash(client, admin_headers):
    resp = await client.post("/api/history/revert/not-a-hash", headers=admin_headers)
    assert resp.status_code == 422


async def test_diff_rejects_unknown_table(client):
    resp = await client.get(
        "/api/history/diff/users", params={"from_commit": "a", "to_commit": "b"}
    )
    assert resp.status_code == 422
