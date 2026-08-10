"""GM combat-tools schemas: Fear pool, countdowns."""

from pydantic import BaseModel


class FearAdjust(BaseModel):
    delta: int

    model_config = {"extra": "forbid"}


class FearOut(BaseModel):
    fear: int
