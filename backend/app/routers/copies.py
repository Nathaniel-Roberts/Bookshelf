import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.deps import get_db_session, require_admin
from app.models.book import Book
from app.models.copy import Copy
from app.models.loan import Loan
from app.schemas.copy import CopyCreate, CopyResponse, CopyUpdate
from app.services.barcode import generate_code128_svg, generate_qr_png
from app.services.dolt import dolt_commit

router = APIRouter()


def _short_id() -> str:
    return uuid.uuid4().hex[:8].upper()


def _copy_to_response(copy: Copy) -> CopyResponse:
    active_loan = next((l for l in copy.loans if l.returned_date is None), None)
    return CopyResponse(
        id=copy.id,
        book_id=copy.book_id,
        barcode=copy.barcode,
        barcode_format=copy.barcode_format,
        location=copy.location,
        condition=copy.condition,
        acquisition_date=copy.acquisition_date,
        acquisition_price=copy.acquisition_price,
        acquisition_source=copy.acquisition_source,
        notes=copy.notes,
        created_at=copy.created_at,
        book_title=copy.book.title if copy.book else None,
        is_on_loan=active_loan is not None,
        borrower_name=active_loan.borrower_name if active_loan else None,
        active_loan_id=active_loan.id if active_loan else None,
    )


@router.get("/by-barcode/{barcode}", response_model=CopyResponse)
async def get_copy_by_barcode(barcode: str, db: AsyncSession = Depends(get_db_session)):
    result = await db.execute(
        select(Copy)
        .where(Copy.barcode == barcode)
        .options(selectinload(Copy.book), selectinload(Copy.loans))
    )
    copy = result.scalar_one_or_none()
    if not copy:
        raise HTTPException(status_code=404, detail="Copy not found")
    return _copy_to_response(copy)


@router.get("/book/{book_id}", response_model=list[CopyResponse])
async def list_copies_for_book(book_id: str, db: AsyncSession = Depends(get_db_session)):
    result = await db.execute(
        select(Copy)
        .where(Copy.book_id == book_id)
        .options(selectinload(Copy.book), selectinload(Copy.loans))
        .order_by(Copy.created_at)
    )
    return [_copy_to_response(c) for c in result.scalars().all()]


@router.post("/book/{book_id}", response_model=CopyResponse, status_code=201)
async def create_copy(
    book_id: str,
    data: CopyCreate,
    db: AsyncSession = Depends(get_db_session),
    _: bool = Depends(require_admin),
):
    # Verify book exists
    book = (await db.execute(select(Book).where(Book.id == book_id))).scalar_one_or_none()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    copy = Copy(
        id=str(uuid.uuid4()),
        book_id=book_id,
        barcode=f"BKSHF-{_short_id()}",
        **data.model_dump(),
    )
    db.add(copy)
    await db.commit()
    await dolt_commit(db, f"Add copy of: {book.title}")

    result = await db.execute(
        select(Copy).where(Copy.id == copy.id).options(selectinload(Copy.book), selectinload(Copy.loans))
    )
    copy = result.scalar_one()
    return _copy_to_response(copy)


@router.put("/{copy_id}", response_model=CopyResponse)
async def update_copy(
    copy_id: str,
    data: CopyUpdate,
    db: AsyncSession = Depends(get_db_session),
    _: bool = Depends(require_admin),
):
    result = await db.execute(
        select(Copy).where(Copy.id == copy_id).options(selectinload(Copy.book), selectinload(Copy.loans))
    )
    copy = result.scalar_one_or_none()
    if not copy:
        raise HTTPException(status_code=404, detail="Copy not found")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(copy, key, value)

    await db.commit()
    await db.refresh(copy)
    await dolt_commit(db, f"Update copy: {copy.barcode}")
    return _copy_to_response(copy)


@router.delete("/{copy_id}", status_code=204)
async def delete_copy(
    copy_id: str,
    db: AsyncSession = Depends(get_db_session),
    _: bool = Depends(require_admin),
):
    result = await db.execute(select(Copy).where(Copy.id == copy_id))
    copy = result.scalar_one_or_none()
    if not copy:
        raise HTTPException(status_code=404, detail="Copy not found")

    barcode = copy.barcode
    await db.delete(copy)
    await db.commit()
    await dolt_commit(db, f"Delete copy: {barcode}")


@router.get("/{copy_id}/barcode")
async def get_barcode(
    copy_id: str,
    format: str = Query("code128", regex="^(code128|qr)$"),
    db: AsyncSession = Depends(get_db_session),
):
    result = await db.execute(select(Copy).where(Copy.id == copy_id))
    copy = result.scalar_one_or_none()
    if not copy:
        raise HTTPException(status_code=404, detail="Copy not found")

    if format == "qr":
        data = generate_qr_png(copy.barcode)
        return Response(content=data, media_type="image/png")
    else:
        data = generate_code128_svg(copy.barcode)
        return Response(content=data, media_type="image/svg+xml")
