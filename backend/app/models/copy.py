import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, Enum, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.book import Base


class Copy(Base):
    __tablename__ = "copies"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    book_id: Mapped[str] = mapped_column(String(36), ForeignKey("books.id", ondelete="CASCADE"))
    barcode: Mapped[str] = mapped_column(String(50), unique=True)
    barcode_format: Mapped[str] = mapped_column(Enum("code128", "qr"), default="code128")
    location: Mapped[str | None] = mapped_column(String(255))
    condition: Mapped[str | None] = mapped_column(Enum("new", "like_new", "good", "fair", "poor"))
    acquisition_date: Mapped[date | None] = mapped_column(Date)
    acquisition_price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    acquisition_source: Mapped[str | None] = mapped_column(String(255))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(default=func.now())

    book = relationship("Book", back_populates="copies")
    loans = relationship("Loan", back_populates="copy", cascade="all, delete-orphan")
