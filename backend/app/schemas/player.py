"""Player-area schemas: characters, campaign membership, notes."""

from datetime import datetime

from pydantic import BaseModel, Field


class CharacterCreate(BaseModel):
    campaign_id: int
    name: str = Field(min_length=1, max_length=200)
    char_class: str = ""
    ancestry: str = ""
    community: str = ""
    level: int = Field(default=1, ge=1, le=20)
    extra: str = "{}"


class CharacterUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    char_class: str | None = None
    ancestry: str | None = None
    community: str | None = None
    level: int | None = Field(default=None, ge=1, le=20)
    extra: str | None = None

    model_config = {"extra": "forbid"}


class CharacterOut(BaseModel):
    id: int
    player_user_id: int
    campaign_id: int
    name: str
    char_class: str
    ancestry: str
    community: str
    level: int
    extra: str
    created_at: datetime


class MemberCampaignOut(BaseModel):
    id: int
    name: str
    description: str
    gm_user_id: int
    created_at: datetime


class CampaignMemberOut(BaseModel):
    id: int
    campaign_id: int
    player_user_id: int
    player_username: str
    joined_at: datetime


class AddMemberRequest(BaseModel):
    username: str


class NoteOut(BaseModel):
    campaign_id: int
    body: str
    updated_at: datetime


class NoteUpdate(BaseModel):
    body: str = Field(max_length=20000)
