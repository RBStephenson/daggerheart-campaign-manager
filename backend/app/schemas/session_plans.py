"""Session planning schemas: SessionPlan and its structured planned content.

`SessionPlanContent` models the shape Brent already plans sessions in by hand
(see the Hillford Raid on Hillford Session 1/2 prep): a sequence of story
`beats`, parallel `countdowns` (Daggerheart's countdown mechanic — segments,
what ticks them, what happens on completion vs. early intervention), and a
flat list of seeded `hooks`. All three are optional and `notes` is a plain
freeform bucket, so a session with no combat countdowns at all (pure
roleplay, investigation) is just as valid as a raid. `extra="allow"` on the
model means an unanticipated future planning shape isn't rejected outright —
it round-trips through `SessionPlan.extra` even before the schema grows a
named field for it.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

LibraryEntityType = Literal["continent", "region", "location", "faction", "npc", "adversary"]


class SessionBeat(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = ""
    npc_ids: list[int] = Field(default_factory=list)


class SessionCountdown(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    max_segments: int = Field(gt=0)
    trigger: str = ""
    on_complete: str = ""
    on_intervention: str = ""


class SessionPlanContent(BaseModel):
    beats: list[SessionBeat] = Field(default_factory=list)
    countdowns: list[SessionCountdown] = Field(default_factory=list)
    hooks: list[str] = Field(default_factory=list)
    notes: str = ""

    model_config = {"extra": "allow"}


class SessionPlanCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    summary: str = ""
    order: int = 0
    content: SessionPlanContent = Field(default_factory=SessionPlanContent)


class SessionPlanUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    summary: str | None = None
    order: int | None = None
    content: SessionPlanContent | None = None

    model_config = {"extra": "forbid"}


class SessionPlanOut(BaseModel):
    id: int
    campaign_id: int
    title: str
    summary: str
    order: int
    content: SessionPlanContent
    created_at: datetime
    updated_at: datetime


class SessionPlanLibraryLinkCreate(BaseModel):
    entity_type: LibraryEntityType
    entity_id: int


class SessionPlanLibraryLinkOut(BaseModel):
    id: int
    session_plan_id: int
    entity_type: LibraryEntityType
    entity_id: int
    created_at: datetime
