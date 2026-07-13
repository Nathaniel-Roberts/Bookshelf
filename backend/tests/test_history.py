async def test_diff_rejects_unknown_table(client):
    resp = await client.get(
        "/api/history/diff/users", params={"from_commit": "a", "to_commit": "b"}
    )
    assert resp.status_code == 422
