import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.deps import get_db_session, require_admin
from app.models.book import Book
from app.models.copy import Copy
from app.models.loan import Loan
from app.schemas.loan import LoanCreate, LoanResponse
from app.services.dolt import dolt_commit

router = APIRouter()


def _loan_to_response(loan: Loan) -> LoanResponse:
    return LoanResponse(
        id=loan.id,
        copy_id=loan.copy_id,
        borrower_name=loan.borrower_name,
        borrowed_date=loan.borrowed_date,
        returned_date=loan.returned_date,
        notes=loan.notes,
        created_at=loan.created_at,
        book_title=loan.copy.book.title if loan.copy and loan.copy.book else None,
        barcode=loan.copy.barcode if loan.copy else None,
    )


@router.get("", response_model=list[LoanResponse])
async def list_active_loans(db: AsyncSession = Depends(get_db_session)):
    result = await db.execute(
        select(Loan)
        .where(Loan.returned_date.is_(None))
        .options(selectinload(Loan.copy).selectinload(Copy.book))
        .order_by(Loan.borrowed_date.desc())
    )
    return [_loan_to_response(l) for l in result.scalars().all()]


@router.get("/history", response_model=list[LoanResponse])
async def loan_history(db: AsyncSession = Depends(get_db_session)):
    result = await db.execute(
        select(Loan)
        .options(selectinload(Loan.copy).selectinload(Copy.book))
        .order_by(Loan.borrowed_date.desc())
    )
    return [_loan_to_response(l) for l in result.scalars().all()]


@router.get("/borrowers", response_model=list[str])
async def list_borrowers(db: AsyncSession = Depends(get_db_session)):
    result = await db.execute(select(Loan.borrower_name).distinct().order_by(Loan.borrower_name))
    return [row[0] for row in result.all()]


@router.post("/copy/{copy_id}", response_model=LoanResponse, status_code=201)
async def create_loan(
    copy_id: str,
    data: LoanCreate,
    db: AsyncSession = Depends(get_db_session),
    _: bool = Depends(require_admin),
):
    result = await db.execute(
        select(Copy).where(Copy.id == copy_id).options(selectinload(Copy.book), selectinload(Copy.loans))
    )
    copy = result.scalar_one_or_none()
    if not copy:
        raise HTTPException(status_code=404, detail="Copy not found")

    # Check if already on loan
    if any(l.returned_date is None for l in copy.loans):
        raise HTTPException(status_code=400, detail="Copy is already on loan")

    loan = Loan(
        id=str(uuid.uuid4()),
        copy_id=copy_id,
        borrower_name=data.borrower_name,
        borrowed_date=data.borrowed_date or date.today(),
        notes=data.notes,
    )
    db.add(loan)
    await db.commit()
    await dolt_commit(db, f"Loan {copy.barcode} to {loan.borrower_name}")

    # Re-query with relationships loaded
    result = await db.execute(
        select(Loan).where(Loan.id == loan.id).options(selectinload(Loan.copy).selectinload(Copy.book))
    )
    loan = result.scalar_one()
    return _loan_to_response(loan)


@router.put("/{loan_id}/return", response_model=LoanResponse)
async def return_loan(
    loan_id: str,
    db: AsyncSession = Depends(get_db_session),
    _: bool = Depends(require_admin),
):
    result = await db.execute(
        select(Loan).where(Loan.id == loan_id).options(selectinload(Loan.copy).selectinload(Copy.book))
    )
    loan = result.scalar_one_or_none()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    if loan.returned_date is not None:
        raise HTTPException(status_code=400, detail="Loan already returned")

    loan.returned_date = date.today()
    await db.commit()
    await db.refresh(loan)
    await dolt_commit(db, f"Return {loan.copy.barcode} from {loan.borrower_name}")
    return _loan_to_response(loan)
