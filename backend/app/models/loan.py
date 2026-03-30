import uuid
from datetime import date, datetime

from sqlalchemy import Date, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.book import Base


class Loan(Base):
    __tablename__ = "loans"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    copy_id: Mapped[str] = mapped_column(String(36), ForeignKey("copies.id", ondelete="CASCADE"))
    borrower_name: Mapped[str] = mapped_column(String(255))
    borrowed_date: Mapped[date] = mapped_column(Date)
    returned_date: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(default=func.now())

    copy = relationship("Copy", back_populates="loans")
