import logging

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


async def dolt_commit(session: AsyncSession, message: str) -> str | None:
    """Stage all changes and create a Dolt commit. Returns the commit hash."""
    try:
        await session.execute(text("CALL DOLT_ADD('-A')"))
        result = await session.execute(
            text("CALL DOLT_COMMIT('-m', :msg, '--author', 'bookshelf <bookshelf@local>')"),
            {"msg": message},
        )
        row = result.fetchone()
        return row[0] if row else None
    except Exception as exc:
        # Dolt raises when there is nothing to commit; that's expected on
        # no-op updates. Anything else is a broken audit trail — log it.
        if "nothing to commit" in str(exc).lower():
            return None
        logger.error("Dolt commit failed for %r: %s", message, exc)
        return None
