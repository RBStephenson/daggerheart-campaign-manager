"""Library schemas: worlds, Continents/Regions/Locations, and Factions/NPCs/Adversaries.

Factions/NPCs/Adversaries share one shape (name, summary, extra, timestamps).
Continents/Regions/Locations share that same shape plus a free-text `kind`
field, but each has a different parent id (world_id, continent_id, region_id
respectively), so they get their own Out schemas rather than forcing one
shape to fit three different foreign keys.
"""

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


class LibraryEntityWithKindCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    summary: str = ""
    extra: str = "{}"
    kind: str = ""


class LibraryEntityWithKindUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    summary: str | None = None
    extra: str | None = None
    kind: str | None = None

    model_config = {"extra": "forbid"}


class ContinentOut(BaseModel):
    id: int
    world_id: int
    name: str
    summary: str
    extra: str
    kind: str
    created_at: datetime
    updated_at: datetime


class RegionOut(BaseModel):
    id: int
    continent_id: int
    name: str
    summary: str
    extra: str
    kind: str
    created_at: datetime
    updated_at: datetime


class LocationOut(BaseModel):
    id: int
    region_id: int
    name: str
    summary: str
    extra: str
    kind: str
    created_at: datetime
    updated_at: datetime
