"""Overdue webhook service with httpx stubbed and a sqlite session."""

import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.services import notifications
from app.services.notifications import check_overdue_and_notify

posted: list[dict] = []


class StubClient:
    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def post(self, url, content=b"", headers=None, **kwargs):
        posted.append({"url": url, "body": content.decode(), "headers": headers or {}})
        return httpx.Response(200, request=httpx.Request("POST", url))


@pytest.fixture
def stub_post(monkeypatch):
    posted.clear()
    monkeypatch.setattr(notifications.httpx, "AsyncClient", StubClient)
    return posted


@pytest.fixture
def session_factory(db_engine):
    return async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)


async def test_no_webhook_configured_sends_nothing(client, stub_post, session_factory):
    result = await check_overdue_and_notify(session_factory=session_factory)
    assert result == {"overdue": 0, "sent": False}
    assert posted == []


async def test_overdue_loan_triggers_webhook(
    client, admin_headers, sample_copy, stub_post, session_factory
):
    await client.put(
        "/api/settings/overdue_webhook_url",
        json={"value": "https://ntfy.sh/test-topic"},
        headers=admin_headers,
    )
    await client.post(
        f"/api/loans/copy/{sample_copy['id']}",
        json={"borrower_name": "Sam", "due_date": "2020-01-01"},
        headers=admin_headers,
    )

    result = await check_overdue_and_notify(session_factory=session_factory)
    assert result == {"overdue": 1, "sent": True}
    assert len(posted) == 1
    assert posted[0]["url"] == "https://ntfy.sh/test-topic"
    assert "The Hobbit" in posted[0]["body"]
    assert "Sam" in posted[0]["body"]


async def test_nothing_overdue_sends_nothing(
    client, admin_headers, sample_copy, stub_post, session_factory
):
    await client.put(
        "/api/settings/overdue_webhook_url",
        json={"value": "https://ntfy.sh/test-topic"},
        headers=admin_headers,
    )
    await client.post(
        f"/api/loans/copy/{sample_copy['id']}",
        json={"borrower_name": "Sam", "due_date": "2099-01-01"},
        headers=admin_headers,
    )
    result = await check_overdue_and_notify(session_factory=session_factory)
    assert result == {"overdue": 0, "sent": False}
    assert posted == []
