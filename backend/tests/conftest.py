"""Shared fixtures: in-memory sqlite DB, dolt stubbed out, admin auth."""

from unittest.mock import AsyncMock, patch

import httpx
import pytest
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.database import get_db
from app.main import app
from app.models.book import Base
from app.routers import auth as auth_router


@pytest.fixture
async def db_engine():
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    # sqlite doesn't enforce foreign keys by default; MySQL does. Turn it on
    # so tests match production semantics.
    @event.listens_for(engine.sync_engine, "connect")
    def _enable_fks(dbapi_conn, _record):
        dbapi_conn.execute("PRAGMA foreign_keys=ON")

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest.fixture
async def client(db_engine):
    session_factory = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)

    async def override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    auth_router._failures.clear()

    # dolt_commit issues Dolt-specific CALL statements; stub it everywhere
    # it was imported so sqlite tests don't log spurious errors.
    dolt_patches = [
        patch(f"app.routers.{mod}.dolt_commit", new=AsyncMock(return_value="stubhash"))
        for mod in ("books", "copies", "loans", "series", "settings")
    ]
    for p in dolt_patches:
        p.start()

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c

    for p in dolt_patches:
        p.stop()
    app.dependency_overrides.clear()


@pytest.fixture
async def admin_headers(client):
    resp = await client.post("/api/auth/login", json={"password": "changeme"})
    assert resp.status_code == 200
    return {"Authorization": f"Bearer {resp.json()['token']}"}


@pytest.fixture
async def sample_book(client, admin_headers):
    resp = await client.post(
        "/api/books",
        json={"title": "The Hobbit", "isbn13": "9780261103283", "authors": ["J. R. R. Tolkien"]},
        headers=admin_headers,
    )
    assert resp.status_code == 201
    return resp.json()


@pytest.fixture
async def sample_copy(client, admin_headers, sample_book):
    resp = await client.post(f"/api/copies/book/{sample_book['id']}", json={}, headers=admin_headers)
    assert resp.status_code == 201
    return resp.json()
