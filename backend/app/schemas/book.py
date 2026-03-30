from datetime import datetime

from pydantic import BaseModel


class BookCreate(BaseModel):
    isbn13: str | None = None
    isbn10: str | None = None
    title: str
    subtitle: str | None = None
    authors: list[str] | None = None
    publisher: str | None = None
    publish_date: str | None = None
    description: str | None = None
    page_count: int | None = None
    cover_url: str | None = None
    genres: list[str] | None = None
    language: str | None = None
    series_id: str | None = None
    series_position: str | None = None
    tags: list[str] | None = None
    is_favourite: bool = False
    rating: int | None = None
    notes: str | None = None
    metadata_source: str | None = "manual"


class BookUpdate(BaseModel):
    isbn13: str | None = None
    isbn10: str | None = None
    title: str | None = None
    subtitle: str | None = None
    authors: list[str] | None = None
    publisher: str | None = None
    publish_date: str | None = None
    description: str | None = None
    page_count: int | None = None
    cover_url: str | None = None
    genres: list[str] | None = None
    language: str | None = None
    series_id: str | None = None
    series_position: str | None = None
    tags: list[str] | None = None
    is_favourite: bool | None = None
    rating: int | None = None
    notes: str | None = None


class BookResponse(BaseModel):
    id: str
    isbn13: str | None = None
    isbn10: str | None = None
    title: str
    subtitle: str | None = None
    authors: list[str] | None = None
    publisher: str | None = None
    publish_date: str | None = None
    description: str | None = None
    page_count: int | None = None
    cover_url: str | None = None
    cover_local: str | None = None
    genres: list[str] | None = None
    language: str | None = None
    series_id: str | None = None
    series_position: str | None = None
    tags: list[str] | None = None
    is_favourite: bool = False
    rating: int | None = None
    notes: str | None = None
    metadata_source: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    series_name: str | None = None
    copy_count: int = 0
    available_copies: int = 0

    model_config = {"from_attributes": True}
