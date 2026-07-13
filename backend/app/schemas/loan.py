from datetime import date, datetime

from pydantic import BaseModel, computed_field


class LoanCreate(BaseModel):
    borrower_name: str
    borrowed_date: date | None = None
    due_date: date | None = None
    notes: str | None = None


class LoanResponse(BaseModel):
    id: str
    copy_id: str
    borrower_name: str
    borrowed_date: date
    due_date: date | None = None
    returned_date: date | None = None
    notes: str | None = None
    created_at: datetime | None = None
    book_title: str | None = None
    barcode: str | None = None

    model_config = {"from_attributes": True}

    @computed_field
    @property
    def is_overdue(self) -> bool:
        return self.returned_date is None and self.due_date is not None and self.due_date < date.today()
