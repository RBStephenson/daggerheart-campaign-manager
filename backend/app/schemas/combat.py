"""GM combat-tools schemas: Fear pool, countdowns."""

from datetime import datetime

from pydantic import BaseModel, Field


class FearAdjust(BaseModel):
    delta: int

    model_config = {"extra": "forbid"}


class FearOut(BaseModel):
    fear: int


class CountdownCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    starting_value: int = Field(gt=0)
    loop: bool = False

    model_config = {"extra": "forbid"}


class CountdownAdjust(BaseModel):
    delta: int

    model_config = {"extra": "forbid"}


class CountdownOut(BaseModel):
    id: int
    campaign_id: int
    name: str
    starting_value: int
    current_value: int
    loop: bool
    triggered_at: datetime | None
    created_at: datetime
