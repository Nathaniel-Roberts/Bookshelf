from datetime import datetime

from pydantic import BaseModel, Field


class SeriesCreate(BaseModel):
    name: str
    description: str | None = None
    total_books: int | None = Field(None, ge=1)


class SeriesUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    total_books: int | None = Field(None, ge=1)


class SeriesResponse(BaseModel):
    id: str
    name: str
    description: str | None = None
    total_books: int | None = None
    created_at: datetime | None = None
    book_count: int = 0

    model_config = {"from_attributes": True}
