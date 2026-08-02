"""GM world-building library: Worlds plus Regions/Factions/NPCs/Adversaries.

Gated by library_enabled. The four entity types share an identical shape
(name, summary, extra, timestamps), so their routes are built once by
_add_entity_routes instead of writing the same CRUD block four times.
"""

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_role
from app.models import Adversary, Base, Faction, Npc, Region, User, World
from app.routers.settings import get_settings
from app.schemas.library import (
    LibraryEntityCreate,
    LibraryEntityOut,
    LibraryEntityUpdate,
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


def _get_entity(model: type[Base], world_id: int, entity_id: int, db: Session) -> Base:
    entity = db.get(model, entity_id)
    if entity is None or entity.world_id != world_id:  # type: ignore[attr-defined]
        raise HTTPException(status_code=404, detail="Not found")
    return entity


def _add_entity_routes(model: type[Base], segment: str) -> None:
    prefix = f"/worlds/{{world_id}}/{segment}"

    @router.get(prefix, response_model=list[LibraryEntityOut], name=f"list_{segment}")
    def list_entities(
        world_id: int,
        db: Annotated[Session, Depends(get_db)],
        _gm: Annotated[User, Depends(require_role("gm"))],
    ) -> list[Base]:
        _get_world(world_id, db)
        return list(db.scalars(select(model).where(model.world_id == world_id)))  # type: ignore[attr-defined]

    @router.post(prefix, response_model=LibraryEntityOut, name=f"create_{segment}")
    def create_entity(
        world_id: int,
        body: LibraryEntityCreate,
        db: Annotated[Session, Depends(get_db)],
        _gm: Annotated[User, Depends(require_role("gm"))],
    ) -> Base:
        _get_world(world_id, db)
        now = datetime.now(UTC)
        entity = model(
            world_id=world_id,
            name=body.name,
            summary=body.summary,
            extra=body.extra,
            created_at=now,
            updated_at=now,
        )
        db.add(entity)
        db.commit()
        db.refresh(entity)
        return entity

    @router.get(f"{prefix}/{{entity_id}}", response_model=LibraryEntityOut, name=f"get_{segment}")
    def get_entity(
        world_id: int,
        entity_id: int,
        db: Annotated[Session, Depends(get_db)],
        _gm: Annotated[User, Depends(require_role("gm"))],
    ) -> Base:
        return _get_entity(model, world_id, entity_id, db)

    @router.put(
        f"{prefix}/{{entity_id}}", response_model=LibraryEntityOut, name=f"update_{segment}"
    )
    def update_entity(
        world_id: int,
        entity_id: int,
        body: LibraryEntityUpdate,
        db: Annotated[Session, Depends(get_db)],
        _gm: Annotated[User, Depends(require_role("gm"))],
    ) -> Base:
        entity = _get_entity(model, world_id, entity_id, db)
        if body.name is not None:
            entity.name = body.name  # type: ignore[attr-defined]
        if body.summary is not None:
            entity.summary = body.summary  # type: ignore[attr-defined]
        if body.extra is not None:
            entity.extra = body.extra  # type: ignore[attr-defined]
        entity.updated_at = datetime.now(UTC)  # type: ignore[attr-defined]
        db.commit()
        db.refresh(entity)
        return entity

    @router.delete(f"{prefix}/{{entity_id}}", status_code=204, name=f"delete_{segment}")
    def delete_entity(
        world_id: int,
        entity_id: int,
        db: Annotated[Session, Depends(get_db)],
        _gm: Annotated[User, Depends(require_role("gm"))],
    ) -> None:
        entity = _get_entity(model, world_id, entity_id, db)
        db.delete(entity)
        db.commit()


for _model, _segment in (
    (Region, "regions"),
    (Faction, "factions"),
    (Npc, "npcs"),
    (Adversary, "adversaries"),
):
    _add_entity_routes(_model, _segment)
