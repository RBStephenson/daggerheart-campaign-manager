"""Campaign and game-session schemas."""

from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.player import CharacterOut


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
    fear: int


class GameSessionOut(BaseModel):
    id: int
    campaign_id: int
    status: str
    room: str
    started_at: datetime
    ended_at: datetime | None


class PartyMemberOut(BaseModel):
    """A campaign member's character, from the GM's read-only party view."""

    player_username: str
    character: CharacterOut


class EncounterBudgetOut(BaseModel):
    party_size: int
    budget: int
