from datetime import datetime

from pydantic import BaseModel


class SeriesCreate(BaseModel):
    name: str
    description: str | None = None


class SeriesUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class SeriesResponse(BaseModel):
    id: str
    name: str
    description: str | None = None
    created_at: datetime | None = None
    book_count: int = 0

    model_config = {"from_attributes": True}
