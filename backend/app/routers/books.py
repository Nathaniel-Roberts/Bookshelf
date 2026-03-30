import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.deps import get_db_session, require_admin
from app.models.book import Book
from app.models.copy import Copy
from app.models.loan import Loan
from app.models.series import Series
from app.schemas.book import BookCreate, BookResponse, BookUpdate
from app.services.dolt import dolt_commit

router = APIRouter()


def _book_to_response(book: Book, copy_count: int = 0, available_copies: int = 0) -> BookResponse:
    return BookResponse(
        id=book.id,
        isbn13=book.isbn13,
        isbn10=book.isbn10,
        title=book.title,
        subtitle=book.subtitle,
        authors=book.authors,
        publisher=book.publisher,
        publish_date=book.publish_date,
        description=book.description,
        page_count=book.page_count,
        cover_url=book.cover_url,
        cover_local=book.cover_local,
        genres=book.genres,
        language=book.language,
        series_id=book.series_id,
        series_position=book.series_position,
        tags=book.tags,
        is_favourite=book.is_favourite,
        rating=book.rating,
        notes=book.notes,
        metadata_source=book.metadata_source,
        created_at=book.created_at,
        updated_at=book.updated_at,
        series_name=book.series.name if book.series else None,
        copy_count=copy_count,
        available_copies=available_copies,
    )


@router.get("", response_model=list[BookResponse])
async def list_books(
    db: AsyncSession = Depends(get_db_session),
    search: str | None = Query(None),
    genre: str | None = Query(None),
    tag: str | None = Query(None),
    series_id: str | None = Query(None),
    is_favourite: bool | None = Query(None),
    availability: str | None = Query(None, regex="^(all|available|on_loan)$"),
    sort: str = Query("title", regex="^(title|author|created_at|rating|series)$"),
    order: str = Query("asc", regex="^(asc|desc)$"),
):
    query = select(Book).options(selectinload(Book.series), selectinload(Book.copies).selectinload(Copy.loans))

    if search:
        like = f"%{search}%"
        query = query.where(
            Book.title.ilike(like) | Book.isbn13.ilike(like) | Book.isbn10.ilike(like)
        )
    if genre:
        query = query.where(Book.genres.like(f'%"{genre}"%'))
    if tag:
        query = query.where(Book.tags.like(f'%"{tag}"%'))
    if series_id:
        query = query.where(Book.series_id == series_id)
    if is_favourite is not None:
        query = query.where(Book.is_favourite == is_favourite)

    sort_col = {
        "title": Book.title,
        "author": Book.authors,
        "created_at": Book.created_at,
        "rating": Book.rating,
        "series": Book.series_position,
    }[sort]
    query = query.order_by(sort_col.desc() if order == "desc" else sort_col.asc())

    result = await db.execute(query)
    books = result.scalars().unique().all()

    responses = []
    for book in books:
        total = len(book.copies)
        on_loan = sum(
            1 for c in book.copies if any(l.returned_date is None for l in c.loans)
        )
        available = total - on_loan

        if availability == "available" and available == 0:
            continue
        if availability == "on_loan" and on_loan == 0:
            continue

        responses.append(_book_to_response(book, total, available))

    return responses


@router.get("/{book_id}", response_model=BookResponse)
async def get_book(book_id: str, db: AsyncSession = Depends(get_db_session)):
    result = await db.execute(
        select(Book)
        .where(Book.id == book_id)
        .options(selectinload(Book.series), selectinload(Book.copies).selectinload(Copy.loans))
    )
    book = result.scalar_one_or_none()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    total = len(book.copies)
    on_loan = sum(1 for c in book.copies if any(l.returned_date is None for l in c.loans))
    return _book_to_response(book, total, total - on_loan)


@router.post("", response_model=BookResponse, status_code=201)
async def create_book(
    data: BookCreate,
    db: AsyncSession = Depends(get_db_session),
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
    await db.refresh(book)
    await dolt_commit(db, f"Add book: {book.title}")
    return _book_to_response(book)


@router.put("/{book_id}", response_model=BookResponse)
async def update_book(
    book_id: str,
    data: BookUpdate,
    db: AsyncSession = Depends(get_db_session),
    _: bool = Depends(require_admin),
):
    result = await db.execute(select(Book).where(Book.id == book_id).options(selectinload(Book.series)))
    book = result.scalar_one_or_none()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(book, key, value)

    await db.commit()
    await db.refresh(book)
    await dolt_commit(db, f"Update book: {book.title}")
    return _book_to_response(book)


@router.delete("/{book_id}", status_code=204)
async def delete_book(
    book_id: str,
    db: AsyncSession = Depends(get_db_session),
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
