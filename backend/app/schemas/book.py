import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

_OPTIONAL_STR_FIELDS = (
    "isbn13",
    "isbn10",
    "subtitle",
    "publisher",
    "publish_date",
    "description",
    "cover_url",
    "language",
    "series_id",
    "series_position",
    "notes",
)


class _BookValidators(BaseModel):
    @field_validator(*_OPTIONAL_STR_FIELDS, mode="before", check_fields=False)
    @classmethod
    def _empty_str_to_none(cls, v):
        # The frontend sends '' for cleared fields; storing '' would collide
        # on the isbn13 unique constraint and pollute filters.
        if isinstance(v, str) and not v.strip():
            return None
        return v

    @field_validator("page_count", "rating", mode="before", check_fields=False)
    @classmethod
    def _zero_or_empty_to_none(cls, v):
        if v == 0 or v == "":
            return None
        return v

    @field_validator("isbn13", check_fields=False)
    @classmethod
    def _validate_isbn13(cls, v):
        if v is None:
            return v
        cleaned = re.sub(r"[-\s]", "", v)
        if not re.fullmatch(r"\d{13}", cleaned):
            raise ValueError("ISBN-13 must be 13 digits")
        return cleaned

    @field_validator("isbn10", check_fields=False)
    @classmethod
    def _validate_isbn10(cls, v):
        if v is None:
            return v
        cleaned = re.sub(r"[-\s]", "", v.upper())
        if not re.fullmatch(r"\d{9}[\dX]", cleaned):
            raise ValueError("ISBN-10 must be 9 digits followed by a digit or X")
        return cleaned


class BookCreate(_BookValidators):
    isbn13: str | None = None
    isbn10: str | None = None
    title: str = Field(min_length=1)
    subtitle: str | None = None
    authors: list[str] | None = None
    publisher: str | None = None
    publish_date: str | None = None
    description: str | None = None
    page_count: int | None = Field(None, ge=1)
    cover_url: str | None = None
    genres: list[str] | None = None
    language: str | None = None
    series_id: str | None = None
    series_position: str | None = None
    tags: list[str] | None = None
    is_favourite: bool = False
    rating: int | None = Field(None, ge=1, le=5)
    notes: str | None = None
    metadata_source: Literal["openlibrary", "googlebooks", "manual"] = "manual"

    @field_validator("metadata_source", mode="before")
    @classmethod
    def _default_metadata_source(cls, v):
        return v or "manual"


class BookUpdate(_BookValidators):
    isbn13: str | None = None
    isbn10: str | None = None
    title: str | None = Field(None, min_length=1)
    subtitle: str | None = None
    authors: list[str] | None = None
    publisher: str | None = None
    publish_date: str | None = None
    description: str | None = None
    page_count: int | None = Field(None, ge=1)
    cover_url: str | None = None
    genres: list[str] | None = None
    language: str | None = None
    series_id: str | None = None
    series_position: str | None = None
    tags: list[str] | None = None
    is_favourite: bool | None = None
    rating: int | None = Field(None, ge=1, le=5)
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
