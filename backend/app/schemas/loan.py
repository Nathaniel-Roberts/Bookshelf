from datetime import date, datetime

from pydantic import BaseModel


class LoanCreate(BaseModel):
    borrower_name: str
    borrowed_date: date | None = None
    notes: str | None = None


class LoanResponse(BaseModel):
    id: str
    copy_id: str
    borrower_name: str
    borrowed_date: date
    returned_date: date | None = None
    notes: str | None = None
    created_at: datetime | None = None
    book_title: str | None = None
    barcode: str | None = None

    model_config = {"from_attributes": True}
