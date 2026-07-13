async def test_login_success(client):
    resp = await client.post("/api/auth/login", json={"password": "changeme"})
    assert resp.status_code == 200
    assert resp.json()["token"]


async def test_login_wrong_password(client):
    resp = await client.post("/api/auth/login", json={"password": "wrong"})
    assert resp.status_code == 401


async def test_login_rate_limited_after_failures(client):
    for _ in range(5):
        resp = await client.post("/api/auth/login", json={"password": "wrong"})
        assert resp.status_code == 401
    resp = await client.post("/api/auth/login", json={"password": "wrong"})
    assert resp.status_code == 429
    # Even the correct password is blocked while limited
    resp = await client.post("/api/auth/login", json={"password": "changeme"})
    assert resp.status_code == 429


async def test_rate_limit_is_per_ip(client):
    for _ in range(6):
        await client.post("/api/auth/login", json={"password": "wrong"})
    resp = await client.post(
        "/api/auth/login",
        json={"password": "changeme"},
        headers={"x-forwarded-for": "203.0.113.7"},
    )
    assert resp.status_code == 200


async def test_admin_endpoints_require_token(client):
    resp = await client.post("/api/books", json={"title": "X"})
    assert resp.status_code in (401, 403)


async def test_admin_endpoints_reject_bad_token(client):
    resp = await client.post(
        "/api/books", json={"title": "X"}, headers={"Authorization": "Bearer not-a-jwt"}
    )
    assert resp.status_code == 401
