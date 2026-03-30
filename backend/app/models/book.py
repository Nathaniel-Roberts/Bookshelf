import uuid

from sqlalchemy import JSON, Boolean, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from datetime import datetime


class Base(DeclarativeBase):
    pass


class Book(Base):
    __tablename__ = "books"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    isbn13: Mapped[str | None] = mapped_column(String(13), unique=True)
    isbn10: Mapped[str | None] = mapped_column(String(10))
    title: Mapped[str] = mapped_column(String(500))
    subtitle: Mapped[str | None] = mapped_column(String(500))
    authors: Mapped[list | None] = mapped_column(JSON)
    publisher: Mapped[str | None] = mapped_column(String(255))
    publish_date: Mapped[str | None] = mapped_column(String(50))
    description: Mapped[str | None] = mapped_column(Text)
    page_count: Mapped[int | None] = mapped_column(Integer)
    cover_url: Mapped[str | None] = mapped_column(String(1000))
    cover_local: Mapped[str | None] = mapped_column(String(255))
    genres: Mapped[list | None] = mapped_column(JSON)
    language: Mapped[str | None] = mapped_column(String(10))
    series_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("series.id", ondelete="SET NULL"))
    series_position: Mapped[str | None] = mapped_column(String(10))
    tags: Mapped[list | None] = mapped_column(JSON)
    is_favourite: Mapped[bool] = mapped_column(Boolean, default=False)
    rating: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text)
    metadata_source: Mapped[str | None] = mapped_column(
        Enum("openlibrary", "googlebooks", "manual"), default="manual"
    )
    created_at: Mapped[datetime] = mapped_column(default=func.now())
    updated_at: Mapped[datetime] = mapped_column(default=func.now(), onupdate=func.now())

    series = relationship("Series", back_populates="books")
    copies = relationship("Copy", back_populates="book", cascade="all, delete-orphan")
