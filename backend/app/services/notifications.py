import logging
from datetime import date

import httpx
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import async_session
from app.models.copy import Copy
from app.models.loan import Loan
from app.models.setting import Setting

logger = logging.getLogger(__name__)


async def check_overdue_and_notify(session_factory=None) -> dict:
    """POST a plain-text digest of overdue loans to the configured webhook
    (ntfy.sh, Slack-compatible proxies, or anything that accepts text).

    Returns {"overdue": n, "sent": bool}; used by the daily loop and the
    manual trigger in Settings."""
    factory = session_factory or async_session
    async with factory() as session:
        setting = (
            await session.execute(select(Setting).where(Setting.key == "overdue_webhook_url"))
        ).scalar_one_or_none()
        url = (setting.value or "").strip() if setting else ""

        result = await session.execute(
            select(Loan)
            .where(Loan.returned_date.is_(None), Loan.due_date < date.today())
            .options(selectinload(Loan.copy).selectinload(Copy.book))
            .order_by(Loan.due_date)
        )
        loans = result.scalars().all()

    if not url or not loans:
        return {"overdue": len(loans), "sent": False}

    lines = []
    for loan in loans:
        title = loan.copy.book.title if loan.copy and loan.copy.book else loan.copy_id
        days = (date.today() - loan.due_date).days
        lines.append(f"{title} is {days} day{'s' if days != 1 else ''} overdue with {loan.borrower_name}")
    body = "Overdue books:\n" + "\n".join(lines)

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                url,
                content=body.encode(),
                headers={"content-type": "text/plain; charset=utf-8", "title": "Bookshelf overdue loans"},
            )
            resp.raise_for_status()
    except Exception as exc:
        logger.warning("Overdue webhook failed: %s", exc)
        return {"overdue": len(loans), "sent": False}

    return {"overdue": len(loans), "sent": True}
