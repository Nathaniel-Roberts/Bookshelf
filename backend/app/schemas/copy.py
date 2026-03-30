from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel


class CopyCreate(BaseModel):
    barcode_format: str = "code128"
    location: str | None = None
    condition: str | None = None
    acquisition_date: date | None = None
    acquisition_price: Decimal | None = None
    acquisition_source: str | None = None
    notes: str | None = None


class CopyUpdate(BaseModel):
    location: str | None = None
    condition: str | None = None
    acquisition_date: date | None = None
    acquisition_price: Decimal | None = None
    acquisition_source: str | None = None
    notes: str | None = None


class CopyResponse(BaseModel):
    id: str
    book_id: str
    barcode: str
    barcode_format: str
    location: str | None = None
    condition: str | None = None
    acquisition_date: date | None = None
    acquisition_price: Decimal | None = None
    acquisition_source: str | None = None
    notes: str | None = None
    created_at: datetime | None = None
    book_title: str | None = None
    is_on_loan: bool = False
    borrower_name: str | None = None
    active_loan_id: str | None = None

    model_config = {"from_attributes": True}
