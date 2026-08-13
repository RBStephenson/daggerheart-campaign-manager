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
    Clue,
    Continent,
    Environment,
    Faction,
    Location,
    Npc,
    Region,
    User,
    World,
)
from app.routers.session_plans import _LIBRARY_MODELS
from app.routers.settings import get_settings
from app.schemas.clues import ClueCreate, ClueOut, ClueUpdate
from app.schemas.library import (
    AdversaryCreate,
    AdversaryOut,
    AdversaryUpdate,
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
    has_notes: bool = False,
) -> None:
    prefix = f"/{parent_segment}/{{parent_id}}/{segment}"
    # has_kind and has_notes never both apply to the same segment (kind is
    # the place-hierarchy's field, notes is Adversary-only), so a simple
    # if/elif is enough rather than a full matrix of schema combinations.
    if has_kind:
        create_schema: type[BaseModel] = LibraryEntityWithKindCreate
        update_schema: type[BaseModel] = LibraryEntityWithKindUpdate
    elif has_notes:
        create_schema = AdversaryCreate
        update_schema = AdversaryUpdate
    else:
        create_schema = LibraryEntityCreate
        update_schema = LibraryEntityUpdate
    out_schemas: dict[str, type[BaseModel]] = {
        "continents": ContinentOut,
        "regions": RegionOut,
        "locations": LocationOut,
        "adversaries": AdversaryOut,
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
        if has_notes:
            kwargs["notes"] = body.notes  # type: ignore[attr-defined]
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
        if has_notes and body.notes is not None:  # type: ignore[attr-defined]
            entity.notes = body.notes  # type: ignore[attr-defined]
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


_ENTITY_ROUTE_SPECS = (
    (Continent, "continents", World, "worlds", "world_id", "World", True, False),
    (Faction, "factions", World, "worlds", "world_id", "World", False, False),
    (Npc, "npcs", World, "worlds", "world_id", "World", False, False),
    (Adversary, "adversaries", World, "worlds", "world_id", "World", False, True),
    (Environment, "environments", World, "worlds", "world_id", "World", False, False),
    (Region, "regions", Continent, "continents", "continent_id", "Continent", True, False),
    (Location, "locations", Region, "regions", "region_id", "Region", True, False),
)

for _spec in _ENTITY_ROUTE_SPECS:
    _add_entity_routes(*_spec)


# Clue (DHCM-63/DHCM-86) doesn't share the name/summary/extra shape the
# _add_entity_routes factory assumes (it's text/revelation/entity_type/
# entity_id), so it gets its own small CRUD block instead of a factory entry.

_CLUE_PREFIX = "/worlds/{world_id}/clues"


def _validate_clue_attachment(entity_type: str | None, entity_id: int | None, db: Session) -> None:
    if entity_type is None and entity_id is None:
        return
    if entity_type is None or entity_id is None:
        raise HTTPException(
            status_code=400, detail="entity_type and entity_id must both be set or both be null"
        )
    model = _LIBRARY_MODELS.get(entity_type)
    if model is None:
        raise HTTPException(status_code=400, detail=f"Unknown entity_type: {entity_type}")
    if db.get(model, entity_id) is None:
        raise HTTPException(status_code=404, detail=f"No such {entity_type}")


def _get_clue(world_id: int, clue_id: int, db: Session) -> Clue:
    clue = db.get(Clue, clue_id)
    if clue is None or clue.world_id != world_id:
        raise HTTPException(status_code=404, detail="Not found")
    return clue


@router.get(_CLUE_PREFIX, response_model=list[ClueOut], name="list_clues")
def list_clues(
    world_id: int,
    db: Annotated[Session, Depends(get_db)],
    _gm: Annotated[User, Depends(require_role("gm"))],
) -> list[Clue]:
    _get_world(world_id, db)
    return list(db.scalars(select(Clue).where(Clue.world_id == world_id)))


@router.post(_CLUE_PREFIX, response_model=ClueOut, name="create_clue")
def create_clue(
    world_id: int,
    body: ClueCreate,
    db: Annotated[Session, Depends(get_db)],
    _gm: Annotated[User, Depends(require_role("gm"))],
) -> Clue:
    _get_world(world_id, db)
    _validate_clue_attachment(body.entity_type, body.entity_id, db)
    now = datetime.now(UTC)
    clue = Clue(
        world_id=world_id,
        text=body.text,
        revelation=body.revelation,
        entity_type=body.entity_type,
        entity_id=body.entity_id,
        created_at=now,
        updated_at=now,
    )
    db.add(clue)
    db.commit()
    db.refresh(clue)
    return clue


@router.get(f"{_CLUE_PREFIX}/{{clue_id}}", response_model=ClueOut, name="get_clue")
def get_clue(
    world_id: int,
    clue_id: int,
    db: Annotated[Session, Depends(get_db)],
    _gm: Annotated[User, Depends(require_role("gm"))],
) -> Clue:
    return _get_clue(world_id, clue_id, db)


@router.put(f"{_CLUE_PREFIX}/{{clue_id}}", response_model=ClueOut, name="update_clue")
def update_clue(
    world_id: int,
    clue_id: int,
    body: ClueUpdate,
    db: Annotated[Session, Depends(get_db)],
    _gm: Annotated[User, Depends(require_role("gm"))],
) -> Clue:
    clue = _get_clue(world_id, clue_id, db)
    next_entity_type = body.entity_type if body.entity_type is not None else clue.entity_type
    next_entity_id = body.entity_id if body.entity_id is not None else clue.entity_id
    if body.entity_type is not None or body.entity_id is not None:
        _validate_clue_attachment(next_entity_type, next_entity_id, db)
    if body.text is not None:
        clue.text = body.text
    if body.revelation is not None:
        clue.revelation = body.revelation
    if body.entity_type is not None:
        clue.entity_type = body.entity_type
    if body.entity_id is not None:
        clue.entity_id = body.entity_id
    clue.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(clue)
    return clue


@router.delete(f"{_CLUE_PREFIX}/{{clue_id}}", status_code=204, name="delete_clue")
def delete_clue(
    world_id: int,
    clue_id: int,
    db: Annotated[Session, Depends(get_db)],
    _gm: Annotated[User, Depends(require_role("gm"))],
) -> None:
    clue = _get_clue(world_id, clue_id, db)
    db.delete(clue)
    db.commit()
