import re
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import String as SAString
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.deps import require_admin
from app.models.book import Book
from app.models.copy import Copy
from app.models.loan import Loan
from app.schemas.book import BookCreate, BookResponse, BookUpdate
from app.services.covers import cache_cover, delete_cached_cover
from app.services.dolt import dolt_commit

router = APIRouter()


def _book_to_response(book: Book, copy_count: int = 0, available_copies: int = 0) -> BookResponse:
    response = BookResponse.model_validate(book)
    response.series_name = book.series.name if book.series else None
    response.copy_count = copy_count
    response.available_copies = available_copies
    return response


def _escape_like(value: str) -> str:
    """Escape LIKE metacharacters so user input matches literally."""
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


@router.get("", response_model=list[BookResponse])
async def list_books(
    db: AsyncSession = Depends(get_db),
    search: str | None = Query(None),
    genre: str | None = Query(None),
    tag: str | None = Query(None),
    series_id: str | None = Query(None),
    is_favourite: bool | None = Query(None),
    availability: str | None = Query(None, pattern="^(all|available|on_loan)$"),
    sort: str = Query("title", pattern="^(title|authors|author|created_at|rating)$"),
    order: str = Query("asc", pattern="^(asc|desc)$"),
    limit: int | None = Query(None, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    # Copy/loan counts as aggregates so we never load every copy and loan
    # row just to compute availability.
    copy_counts = (
        select(Copy.book_id, func.count(Copy.id).label("total"))
        .group_by(Copy.book_id)
        .subquery()
    )
    loan_counts = (
        select(Copy.book_id, func.count(Loan.id).label("on_loan"))
        .join(Loan, (Loan.copy_id == Copy.id) & Loan.returned_date.is_(None))
        .group_by(Copy.book_id)
        .subquery()
    )
    total_col = func.coalesce(copy_counts.c.total, 0)
    on_loan_col = func.coalesce(loan_counts.c.on_loan, 0)

    query = (
        select(Book, total_col, on_loan_col)
        .outerjoin(copy_counts, copy_counts.c.book_id == Book.id)
        .outerjoin(loan_counts, loan_counts.c.book_id == Book.id)
        .options(selectinload(Book.series))
    )

    if search:
        like = f"%{_escape_like(search)}%"
        query = query.where(
            Book.title.ilike(like, escape="\\")
            | Book.isbn13.ilike(like, escape="\\")
            | Book.isbn10.ilike(like, escape="\\")
            | func.cast(Book.authors, SAString).ilike(like, escape="\\")
        )
    if genre:
        query = query.where(Book.genres.like(f'%"{_escape_like(genre)}"%', escape="\\"))
    if tag:
        query = query.where(Book.tags.like(f'%"{_escape_like(tag)}"%', escape="\\"))
    if series_id:
        query = query.where(Book.series_id == series_id)
    if is_favourite is not None:
        query = query.where(Book.is_favourite == is_favourite)
    if availability == "available":
        query = query.where(total_col - on_loan_col > 0)
    elif availability == "on_loan":
        query = query.where(on_loan_col > 0)

    sort_col = {
        "title": Book.title,
        "authors": Book.authors,
        "author": Book.authors,
        "created_at": Book.created_at,
        "rating": Book.rating,
    }[sort]
    query = query.order_by(sort_col.desc() if order == "desc" else sort_col.asc())

    if limit is not None:
        query = query.limit(limit).offset(offset)
    elif offset:
        query = query.offset(offset)

    result = await db.execute(query)
    return [
        _book_to_response(book, total, total - on_loan)
        for book, total, on_loan in result.unique().all()
    ]


@router.get("/facets")
async def book_facets(db: AsyncSession = Depends(get_db)):
    """Distinct genres, tags and authors for filter dropdowns — one narrow
    scan instead of shipping the whole collection to the client."""
    result = await db.execute(select(Book.genres, Book.tags, Book.authors))
    genres: set[str] = set()
    tags: set[str] = set()
    authors: set[str] = set()
    for row_genres, row_tags, row_authors in result.all():
        genres.update(row_genres or [])
        tags.update(row_tags or [])
        authors.update(row_authors or [])
    return {
        "genres": sorted(genres),
        "tags": sorted(tags),
        "authors": sorted(authors),
    }


@router.get("/by-isbn/{isbn}", response_model=BookResponse)
async def get_book_by_isbn(isbn: str, db: AsyncSession = Depends(get_db)):
    """Owned-book check for the scanner: 200 with the book or plain 404."""
    normalized = re.sub(r"[-\s]", "", isbn.upper())
    result = await db.execute(
        select(Book)
        .where((Book.isbn13 == normalized) | (Book.isbn10 == normalized))
        .options(selectinload(Book.series), selectinload(Book.copies).selectinload(Copy.loans))
    )
    book = result.scalars().first()
    if not book:
        raise HTTPException(status_code=404, detail="Not in your library")

    total = len(book.copies)
    on_loan = sum(1 for c in book.copies if any(loan.returned_date is None for loan in c.loans))
    return _book_to_response(book, total, total - on_loan)


@router.get("/stats")
async def book_stats(db: AsyncSession = Depends(get_db)):
    total_value = (
        await db.execute(select(func.coalesce(func.sum(Copy.acquisition_price), 0)))
    ).scalar()
    priced_copies = (
        await db.execute(
            select(func.count(Copy.id)).where(Copy.acquisition_price.is_not(None))
        )
    ).scalar()
    return {"total_value": float(total_value or 0), "priced_copies": priced_copies}


@router.get("/{book_id}", response_model=BookResponse)
async def get_book(book_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Book)
        .where(Book.id == book_id)
        .options(selectinload(Book.series), selectinload(Book.copies).selectinload(Copy.loans))
    )
    book = result.scalar_one_or_none()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    total = len(book.copies)
    on_loan = sum(1 for c in book.copies if any(loan.returned_date is None for loan in c.loans))
    return _book_to_response(book, total, total - on_loan)


@router.post("", response_model=BookResponse, status_code=201)
async def create_book(
    data: BookCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(require_admin),
):
    # Check for duplicate ISBN
    if data.isbn13:
        existing = await db.execute(select(Book).where(Book.isbn13 == data.isbn13))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail=f"A book with ISBN {data.isbn13} already exists")
    if data.isbn10 and not data.isbn13:
        existing = await db.execute(select(Book).where(Book.isbn10 == data.isbn10))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail=f"A book with ISBN {data.isbn10} already exists")

    book = Book(id=str(uuid.uuid4()), **data.model_dump())
    db.add(book)
    await db.commit()
    await dolt_commit(db, f"Add book: {book.title}")

    if book.cover_url:
        background_tasks.add_task(cache_cover, book.id, book.cover_url)

    # Re-query with relationships loaded
    result = await db.execute(
        select(Book)
        .where(Book.id == book.id)
        .options(selectinload(Book.series), selectinload(Book.copies))
    )
    book = result.scalar_one()
    return _book_to_response(book)


@router.put("/{book_id}", response_model=BookResponse)
async def update_book(
    book_id: str,
    data: BookUpdate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(require_admin),
):
    result = await db.execute(select(Book).where(Book.id == book_id).options(selectinload(Book.series)))
    book = result.scalar_one_or_none()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    updates = data.model_dump(exclude_unset=True)

    # Re-cache the cover when the URL changes; drop the stale cache when it
    # is cleared.
    new_cover_url = updates.get("cover_url")
    cover_changed = "cover_url" in updates and updates["cover_url"] != book.cover_url
    if cover_changed:
        delete_cached_cover(book_id)
        updates["cover_local"] = None
        if new_cover_url:
            background_tasks.add_task(cache_cover, book_id, new_cover_url)

    # Same duplicate-ISBN guard as create; without it the unique constraint
    # surfaces as an unhandled 500.
    new_isbn13 = updates.get("isbn13")
    if new_isbn13 and new_isbn13 != book.isbn13:
        existing = await db.execute(select(Book).where(Book.isbn13 == new_isbn13, Book.id != book_id))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail=f"A book with ISBN {new_isbn13} already exists")

    for key, value in updates.items():
        setattr(book, key, value)

    await db.commit()
    await db.refresh(book)
    await dolt_commit(db, f"Update book: {book.title}")
    return _book_to_response(book)


@router.delete("/{book_id}", status_code=204)
async def delete_book(
    book_id: str,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(require_admin),
):
    result = await db.execute(select(Book).where(Book.id == book_id))
    book = result.scalar_one_or_none()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    title = book.title
    await db.delete(book)
    await db.commit()
    await dolt_commit(db, f"Delete book: {title}")
    delete_cached_cover(book_id)
