from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db_session

router = APIRouter()


@router.get("")
async def get_history(
    db: AsyncSession = Depends(get_db_session),
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


@router.get("/diff/{table}")
async def get_diff(
    table: str,
    from_commit: str = Query(...),
    to_commit: str = Query(...),
    db: AsyncSession = Depends(get_db_session),
):
    # Validate table name against allowed tables to prevent SQL injection
    allowed = {"books", "series", "copies", "loans", "settings"}
    if table not in allowed:
        return {"error": f"Table must be one of: {', '.join(allowed)}"}

    result = await db.execute(
        text(f"SELECT * FROM dolt_diff_{table} WHERE from_commit = :from_c AND to_commit = :to_c"),
        {"from_c": from_commit, "to_c": to_commit},
    )
    columns = list(result.keys())
    return [dict(zip(columns, row)) for row in result.fetchall()]
