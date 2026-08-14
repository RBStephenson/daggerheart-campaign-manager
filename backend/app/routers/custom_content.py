"""GM-authored custom content: CRUD for the 7 custom entity types that sit
alongside the SRD's static datasets (DHCM-20).

Global/instance-wide, not per-campaign — same shape as `library.py`'s
CRUD but these entities have no parent and each has its own field shape,
so routes are built with a lighter per-type factory rather than
`library.py`'s parent-scoped `_add_entity_routes`.

Gated by `custom_content_enabled` (404 when off) and requires an
authenticated GM, matching `app.routers.bestiary`'s pattern.
"""

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import commit_or_409, get_db
from app.deps import require_role
from app.models import (
    Base,
    CustomAncestry,
    CustomArmor,
    CustomClass,
    CustomCommunity,
    CustomDomain,
    CustomDomainCard,
    CustomWeapon,
)
from app.routers.settings import get_settings
from app.schemas.custom_content import (
    CustomAncestryCreate,
    CustomAncestryOut,
    CustomAncestryUpdate,
    CustomArmorCreate,
    CustomArmorOut,
    CustomArmorUpdate,
    CustomClassCreate,
    CustomClassOut,
    CustomClassUpdate,
    CustomCommunityCreate,
    CustomCommunityOut,
    CustomCommunityUpdate,
    CustomDomainCardCreate,
    CustomDomainCardOut,
    CustomDomainCardUpdate,
    CustomDomainCreate,
    CustomDomainOut,
    CustomDomainUpdate,
    CustomWeaponCreate,
    CustomWeaponOut,
    CustomWeaponUpdate,
)


def _require_custom_content_enabled(db: Annotated[Session, Depends(get_db)]) -> None:
    if not get_settings(db).get("custom_content_enabled", False):
        raise HTTPException(status_code=404)


router = APIRouter(
    prefix="/api/custom-content",
    tags=["custom-content"],
    dependencies=[Depends(_require_custom_content_enabled), Depends(require_role("gm"))],
)


def _get_entity(model: type[Base], entity_id: int, db: Session) -> Base:
    entity = db.get(model, entity_id)
    if entity is None:
        raise HTTPException(status_code=404, detail="Not found")
    return entity


def _add_crud_routes(
    model: type[Base],
    segment: str,
    fields: tuple[str, ...],
    create_schema: type[BaseModel],
    update_schema: type[BaseModel],
    out_schema: type[BaseModel],
) -> None:
    prefix = f"/{segment}"
    conflict_detail = f"A custom {segment.replace('-', ' ')} entry with that name already exists"

    @router.get(prefix, response_model=list[out_schema], name=f"list_custom_{segment}")  # type: ignore[valid-type]
    def list_entities(db: Annotated[Session, Depends(get_db)]) -> list[Base]:
        return list(db.scalars(select(model)))

    @router.post(prefix, response_model=out_schema, name=f"create_custom_{segment}")
    def create_entity(
        body: create_schema,  # type: ignore[valid-type]
        db: Annotated[Session, Depends(get_db)],
    ) -> Base:
        kwargs = {field: getattr(body, field) for field in fields}
        entity = model(created_at=datetime.now(UTC), **kwargs)
        db.add(entity)
        commit_or_409(db, conflict_detail)
        db.refresh(entity)
        return entity

    @router.get(f"{prefix}/{{entity_id}}", response_model=out_schema, name=f"get_custom_{segment}")
    def get_entity(entity_id: int, db: Annotated[Session, Depends(get_db)]) -> Base:
        return _get_entity(model, entity_id, db)

    @router.put(
        f"{prefix}/{{entity_id}}", response_model=out_schema, name=f"update_custom_{segment}"
    )
    def update_entity(
        entity_id: int,
        body: update_schema,  # type: ignore[valid-type]
        db: Annotated[Session, Depends(get_db)],
    ) -> Base:
        entity = _get_entity(model, entity_id, db)
        for field in fields:
            value = getattr(body, field)
            if value is not None:
                setattr(entity, field, value)
        commit_or_409(db, conflict_detail)
        db.refresh(entity)
        return entity

    @router.delete(f"{prefix}/{{entity_id}}", status_code=204, name=f"delete_custom_{segment}")
    def delete_entity(entity_id: int, db: Annotated[Session, Depends(get_db)]) -> None:
        entity = _get_entity(model, entity_id, db)
        db.delete(entity)
        db.commit()


_CrudSpec = tuple[
    type[Base], str, tuple[str, ...], type[BaseModel], type[BaseModel], type[BaseModel]
]

_CRUD_SPECS: tuple[_CrudSpec, ...] = (
    (
        CustomClass,
        "classes",
        (
            "name",
            "domains_json",
            "starting_evasion",
            "starting_hp",
            "class_items_json",
            "subclasses_json",
        ),
        CustomClassCreate,
        CustomClassUpdate,
        CustomClassOut,
    ),
    (
        CustomAncestry,
        "ancestries",
        ("name", "features_json"),
        CustomAncestryCreate,
        CustomAncestryUpdate,
        CustomAncestryOut,
    ),
    (
        CustomCommunity,
        "communities",
        ("name", "adjectives_json", "feature_json"),
        CustomCommunityCreate,
        CustomCommunityUpdate,
        CustomCommunityOut,
    ),
    (
        CustomDomain,
        "domains",
        ("name", "classes_json"),
        CustomDomainCreate,
        CustomDomainUpdate,
        CustomDomainOut,
    ),
    (
        CustomDomainCard,
        "domain-cards",
        ("domain", "name", "type", "recall_cost"),
        CustomDomainCardCreate,
        CustomDomainCardUpdate,
        CustomDomainCardOut,
    ),
    (
        CustomWeapon,
        "weapons",
        ("name", "trait", "range", "damage", "burden", "is_magic", "feature"),
        CustomWeaponCreate,
        CustomWeaponUpdate,
        CustomWeaponOut,
    ),
    (
        CustomArmor,
        "armor",
        ("name", "threshold_low", "threshold_high", "base_score", "feature"),
        CustomArmorCreate,
        CustomArmorUpdate,
        CustomArmorOut,
    ),
)

for _spec in _CRUD_SPECS:
    _add_crud_routes(*_spec)
