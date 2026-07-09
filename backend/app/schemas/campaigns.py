"""Campaign and game-session schemas."""

from datetime import datetime

from pydantic import BaseModel, Field


class CampaignCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = ""


class CampaignUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None

    model_config = {"extra": "forbid"}


class CampaignOut(BaseModel):
    id: int
    name: str
    description: str
    gm_user_id: int
    created_at: datetime


class GameSessionOut(BaseModel):
    id: int
    campaign_id: int
    status: str
    room: str
    started_at: datetime
    ended_at: datetime | None
