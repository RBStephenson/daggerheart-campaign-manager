"""Clue schemas (DHCM-63/DHCM-86): investigation-prep notes, world-scoped.

entity_type/entity_id form an optional attachment to whatever Library entity
the clue was found on -- validated against the same `_LIBRARY_MODELS` keys
`session_plans.py` already uses for its own polymorphic link, rather than
duplicating that set here.
"""

from datetime import datetime

from pydantic import BaseModel, Field


class ClueCreate(BaseModel):
    text: str = Field(min_length=1)
    revelation: str = ""
    entity_type: str | None = None
    entity_id: int | None = None


class ClueUpdate(BaseModel):
    text: str | None = Field(default=None, min_length=1)
    revelation: str | None = None
    entity_type: str | None = None
    entity_id: int | None = None

    model_config = {"extra": "forbid"}


class ClueOut(BaseModel):
    id: int
    world_id: int
    text: str
    revelation: str
    entity_type: str | None
    entity_id: int | None
    created_at: datetime
    updated_at: datetime
