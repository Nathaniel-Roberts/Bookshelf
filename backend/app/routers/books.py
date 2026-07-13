import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import String as SAString
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.deps import require_admin
from app.models.book import Book
from app.models.copy import Copy
from app.schemas.book import BookCreate, BookResponse, BookUpdate
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
):
    query = select(Book).options(
        selectinload(Book.series), selectinload(Book.copies).selectinload(Copy.loans)
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

    sort_col = {
        "title": Book.title,
        "authors": Book.authors,
        "author": Book.authors,
        "created_at": Book.created_at,
        "rating": Book.rating,
    }[sort]
    query = query.order_by(sort_col.desc() if order == "desc" else sort_col.asc())

    result = await db.execute(query)
    books = result.scalars().unique().all()

    responses = []
    for book in books:
        total = len(book.copies)
        on_loan = sum(
            1 for c in book.copies if any(loan.returned_date is None for loan in c.loans)
        )
        available = total - on_loan

        if availability == "available" and available == 0:
            continue
        if availability == "on_loan" and on_loan == 0:
            continue

        responses.append(_book_to_response(book, total, available))

    return responses


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
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(require_admin),
):
    result = await db.execute(select(Book).where(Book.id == book_id).options(selectinload(Book.series)))
    book = result.scalar_one_or_none()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    updates = data.model_dump(exclude_unset=True)

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
