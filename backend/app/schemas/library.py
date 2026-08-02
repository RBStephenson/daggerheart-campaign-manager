"""Library schemas: worlds and the shared shape for Regions/Factions/NPCs/Adversaries."""

from datetime import datetime

from pydantic import BaseModel, Field


class WorldCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)


class WorldOut(BaseModel):
    id: int
    name: str
    created_at: datetime


class LibraryEntityCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    summary: str = ""
    extra: str = "{}"


class LibraryEntityUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    summary: str | None = None
    extra: str | None = None

    model_config = {"extra": "forbid"}


class LibraryEntityOut(BaseModel):
    id: int
    world_id: int
    name: str
    summary: str
    extra: str
    created_at: datetime
    updated_at: datetime
