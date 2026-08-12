"""GM world-building library.

World > Continent > Region > Location is the place hierarchy; Factions/NPCs/
Adversaries/Environments hang directly off World. Gated by library_enabled. Entity types
that share a shape get their routes built once by _add_entity_routes instead
of writing the same CRUD block repeatedly.
"""

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_role
from app.models import (
    Adversary,
    Base,
    Continent,
    Environment,
    Faction,
    Location,
    Npc,
    Region,
    User,
    World,
)
from app.routers.settings import get_settings
from app.schemas.library import (
    ContinentOut,
    LibraryEntityCreate,
    LibraryEntityOut,
    LibraryEntityUpdate,
    LibraryEntityWithKindCreate,
    LibraryEntityWithKindUpdate,
    LocationOut,
    RegionOut,
    WorldCreate,
    WorldOut,
)


def _require_library_enabled(db: Annotated[Session, Depends(get_db)]) -> None:
    if not get_settings(db).get("library_enabled", False):
        raise HTTPException(status_code=404)


router = APIRouter(
    prefix="/api/library",
    tags=["library"],
    dependencies=[Depends(_require_library_enabled)],
)


def _get_world(world_id: int, db: Session) -> World:
    world = db.get(World, world_id)
    if world is None:
        raise HTTPException(status_code=404, detail="World not found")
    return world


@router.get("/worlds", response_model=list[WorldOut])
def list_worlds(
    db: Annotated[Session, Depends(get_db)],
    _gm: Annotated[User, Depends(require_role("gm"))],
) -> list[World]:
    return list(db.scalars(select(World)))


@router.post("/worlds", response_model=WorldOut)
def create_world(
    body: WorldCreate,
    db: Annotated[Session, Depends(get_db)],
    _gm: Annotated[User, Depends(require_role("gm"))],
) -> World:
    world = World(name=body.name, created_at=datetime.now(UTC))
    db.add(world)
    db.commit()
    db.refresh(world)
    return world


@router.get("/worlds/{world_id}", response_model=WorldOut)
def get_world(
    world_id: int,
    db: Annotated[Session, Depends(get_db)],
    _gm: Annotated[User, Depends(require_role("gm"))],
) -> World:
    return _get_world(world_id, db)


def _get_parent(parent_model: type[Base], parent_id: int, db: Session, label: str) -> Base:
    parent = db.get(parent_model, parent_id)
    if parent is None:
        raise HTTPException(status_code=404, detail=f"{label} not found")
    return parent


def _get_entity(
    model: type[Base], parent_attr: str, parent_id: int, entity_id: int, db: Session
) -> Base:
    entity = db.get(model, entity_id)
    if entity is None or getattr(entity, parent_attr) != parent_id:
        raise HTTPException(status_code=404, detail="Not found")
    return entity


def _add_entity_routes(
    model: type[Base],
    segment: str,
    parent_model: type[Base],
    parent_segment: str,
    parent_attr: str,
    parent_label: str,
    has_kind: bool,
) -> None:
    prefix = f"/{parent_segment}/{{parent_id}}/{segment}"
    create_schema = LibraryEntityWithKindCreate if has_kind else LibraryEntityCreate
    update_schema = LibraryEntityWithKindUpdate if has_kind else LibraryEntityUpdate
    out_schemas: dict[str, type[BaseModel]] = {
        "continents": ContinentOut,
        "regions": RegionOut,
        "locations": LocationOut,
    }
    out_schema = out_schemas.get(segment, LibraryEntityOut)

    @router.get(prefix, response_model=list[out_schema], name=f"list_{segment}")  # type: ignore[valid-type]
    def list_entities(
        parent_id: int,
        db: Annotated[Session, Depends(get_db)],
        _gm: Annotated[User, Depends(require_role("gm"))],
    ) -> list[Base]:
        _get_parent(parent_model, parent_id, db, parent_label)
        return list(db.scalars(select(model).where(getattr(model, parent_attr) == parent_id)))

    @router.post(prefix, response_model=out_schema, name=f"create_{segment}")
    def create_entity(
        parent_id: int,
        body: create_schema,  # type: ignore[valid-type]
        db: Annotated[Session, Depends(get_db)],
        _gm: Annotated[User, Depends(require_role("gm"))],
    ) -> Base:
        _get_parent(parent_model, parent_id, db, parent_label)
        now = datetime.now(UTC)
        kwargs: dict[str, object] = {
            parent_attr: parent_id,
            "name": body.name,  # type: ignore[attr-defined]
            "summary": body.summary,  # type: ignore[attr-defined]
            "extra": body.extra,  # type: ignore[attr-defined]
            "created_at": now,
            "updated_at": now,
        }
        if has_kind:
            kwargs["kind"] = body.kind  # type: ignore[attr-defined]
        entity = model(**kwargs)
        db.add(entity)
        db.commit()
        db.refresh(entity)
        return entity

    @router.get(f"{prefix}/{{entity_id}}", response_model=out_schema, name=f"get_{segment}")
    def get_entity(
        parent_id: int,
        entity_id: int,
        db: Annotated[Session, Depends(get_db)],
        _gm: Annotated[User, Depends(require_role("gm"))],
    ) -> Base:
        return _get_entity(model, parent_attr, parent_id, entity_id, db)

    @router.put(
        f"{prefix}/{{entity_id}}", response_model=out_schema, name=f"update_{segment}"
    )
    def update_entity(
        parent_id: int,
        entity_id: int,
        body: update_schema,  # type: ignore[valid-type]
        db: Annotated[Session, Depends(get_db)],
        _gm: Annotated[User, Depends(require_role("gm"))],
    ) -> Base:
        entity = _get_entity(model, parent_attr, parent_id, entity_id, db)
        if body.name is not None:  # type: ignore[attr-defined]
            entity.name = body.name  # type: ignore[attr-defined]
        if body.summary is not None:  # type: ignore[attr-defined]
            entity.summary = body.summary  # type: ignore[attr-defined]
        if body.extra is not None:  # type: ignore[attr-defined]
            entity.extra = body.extra  # type: ignore[attr-defined]
        if has_kind and body.kind is not None:  # type: ignore[attr-defined]
            entity.kind = body.kind  # type: ignore[attr-defined]
        entity.updated_at = datetime.now(UTC)  # type: ignore[attr-defined]
        db.commit()
        db.refresh(entity)
        return entity

    @router.delete(f"{prefix}/{{entity_id}}", status_code=204, name=f"delete_{segment}")
    def delete_entity(
        parent_id: int,
        entity_id: int,
        db: Annotated[Session, Depends(get_db)],
        _gm: Annotated[User, Depends(require_role("gm"))],
    ) -> None:
        entity = _get_entity(model, parent_attr, parent_id, entity_id, db)
        db.delete(entity)
        db.commit()


for _model, _segment, _parent_model, _parent_segment, _parent_attr, _parent_label, _has_kind in (
    (Continent, "continents", World, "worlds", "world_id", "World", True),
    (Faction, "factions", World, "worlds", "world_id", "World", False),
    (Npc, "npcs", World, "worlds", "world_id", "World", False),
    (Adversary, "adversaries", World, "worlds", "world_id", "World", False),
    (Environment, "environments", World, "worlds", "world_id", "World", False),
    (Region, "regions", Continent, "continents", "continent_id", "Continent", True),
    (Location, "locations", Region, "regions", "region_id", "Region", True),
):
    _add_entity_routes(
        _model, _segment, _parent_model, _parent_segment, _parent_attr, _parent_label, _has_kind
    )
