from pydantic import BaseModel


class SettingResponse(BaseModel):
    key: str
    value: str | None = None

    model_config = {"from_attributes": True}


class SettingUpdate(BaseModel):
    value: str
