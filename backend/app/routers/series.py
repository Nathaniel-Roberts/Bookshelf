import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.deps import get_db_session, require_admin
from app.models.book import Book
from app.models.series import Series
from app.schemas.series import SeriesCreate, SeriesResponse, SeriesUpdate
from app.services.dolt import dolt_commit

router = APIRouter()


@router.get("", response_model=list[SeriesResponse])
async def list_series(db: AsyncSession = Depends(get_db_session)):
    result = await db.execute(
        select(Series, func.count(Book.id).label("book_count"))
        .outerjoin(Book, Book.series_id == Series.id)
        .group_by(Series.id)
        .order_by(Series.name)
    )
    return [
        SeriesResponse(id=s.id, name=s.name, description=s.description, created_at=s.created_at, book_count=count)
        for s, count in result.all()
    ]


@router.get("/{series_id}", response_model=SeriesResponse)
async def get_series(series_id: str, db: AsyncSession = Depends(get_db_session)):
    result = await db.execute(
        select(Series, func.count(Book.id).label("book_count"))
        .outerjoin(Book, Book.series_id == Series.id)
        .where(Series.id == series_id)
        .group_by(Series.id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Series not found")
    s, count = row
    return SeriesResponse(id=s.id, name=s.name, description=s.description, created_at=s.created_at, book_count=count)


@router.post("", response_model=SeriesResponse, status_code=201)
async def create_series(
    data: SeriesCreate,
    db: AsyncSession = Depends(get_db_session),
    _: bool = Depends(require_admin),
):
    series = Series(id=str(uuid.uuid4()), **data.model_dump())
    db.add(series)
    await db.commit()
    await db.refresh(series)
    await dolt_commit(db, f"Add series: {series.name}")
    return SeriesResponse(id=series.id, name=series.name, description=series.description, created_at=series.created_at)


@router.put("/{series_id}", response_model=SeriesResponse)
async def update_series(
    series_id: str,
    data: SeriesUpdate,
    db: AsyncSession = Depends(get_db_session),
    _: bool = Depends(require_admin),
):
    result = await db.execute(select(Series).where(Series.id == series_id))
    series = result.scalar_one_or_none()
    if not series:
        raise HTTPException(status_code=404, detail="Series not found")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(series, key, value)

    await db.commit()
    await db.refresh(series)
    await dolt_commit(db, f"Update series: {series.name}")
    return SeriesResponse(id=series.id, name=series.name, description=series.description, created_at=series.created_at)


@router.delete("/{series_id}", status_code=204)
async def delete_series(
    series_id: str,
    db: AsyncSession = Depends(get_db_session),
    _: bool = Depends(require_admin),
):
    result = await db.execute(select(Series).where(Series.id == series_id))
    series = result.scalar_one_or_none()
    if not series:
        raise HTTPException(status_code=404, detail="Series not found")

    name = series.name
    await db.delete(series)
    await db.commit()
    await dolt_commit(db, f"Delete series: {name}")
