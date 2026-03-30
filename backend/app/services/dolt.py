from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


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
    except Exception:
        # If there are no changes to commit, Dolt raises an error
        return None
