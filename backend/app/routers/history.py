import logging
import re

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import require_admin

logger = logging.getLogger(__name__)

router = APIRouter()

# Tables with dolt_diff_* system tables; validated to prevent SQL injection
DIFFABLE_TABLES = ("books", "copies", "loans", "series", "settings")


@router.get("")
async def get_history(
    db: AsyncSession = Depends(get_db),
    limit: int = Query(50, le=200),
):
    result = await db.execute(
        text("SELECT commit_hash, committer, message, date FROM dolt_log ORDER BY date DESC LIMIT :limit"),
        {"limit": limit},
    )
    return [
        {
            "commit_hash": row[0],
            "committer": row[1],
            "message": row[2],
            "date": str(row[3]),
        }
        for row in result.fetchall()
    ]


async def _table_diff(db: AsyncSession, table: str, from_commit: str, to_commit: str) -> list[dict]:
    result = await db.execute(
        text(f"SELECT * FROM dolt_diff_{table} WHERE from_commit = :from_c AND to_commit = :to_c"),
        {"from_c": from_commit, "to_c": to_commit},
    )
    columns = list(result.keys())
    return [dict(zip(columns, row, strict=True)) for row in result.fetchall()]


@router.get("/diff-all")
async def get_diff_all(
    from_commit: str = Query(...),
    to_commit: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Diffs for every table between two commits, keyed by table name.
    Tables without changes are omitted."""
    out = {}
    for table in DIFFABLE_TABLES:
        rows = await _table_diff(db, table, from_commit, to_commit)
        if rows:
            out[table] = rows
    return out


@router.post("/revert/{commit_hash}")
async def revert_commit(
    commit_hash: str,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(require_admin),
):
    """Undo a commit with DOLT_REVERT — restores deleted rows or rolls back
    a bad edit as a new commit, keeping the full history intact."""
    if not re.fullmatch(r"[0-9a-v]{32}", commit_hash):
        raise HTTPException(status_code=422, detail="Not a valid commit hash")

    try:
        await db.execute(
            text("CALL DOLT_REVERT(:hash, '--author', 'bookshelf <bookshelf@local>')"),
            {"hash": commit_hash},
        )
        await db.commit()
    except Exception as exc:
        logger.warning("Revert of %s failed: %s", commit_hash, exc)
        raise HTTPException(
            status_code=409,
            detail="Could not revert this commit (it may conflict with later changes)",
        ) from exc
    return {"reverted": commit_hash}


@router.get("/diff/{table}")
async def get_diff(
    table: str,
    from_commit: str = Query(...),
    to_commit: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    if table not in DIFFABLE_TABLES:
        raise HTTPException(
            status_code=422, detail=f"Table must be one of: {', '.join(DIFFABLE_TABLES)}"
        )

    return await _table_diff(db, table, from_commit, to_commit)
