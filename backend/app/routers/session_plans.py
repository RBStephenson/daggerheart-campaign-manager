"""GM session planning: SessionPlan CRUD plus its Library links.

Gated by session_planning_enabled. Nested under a campaign and scoped by the
same GM-ownership check campaigns.py uses for its own session lifecycle
endpoints (app.deps.get_owned_campaign), since SessionPlan.campaign_id has a
real owner unlike Library's world_id (see DHCM-36's flagged gap).
"""

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_owned_campaign, require_role
from app.models import Adversary, Faction, Npc, Region, SessionPlan, SessionPlanLibraryLink, User
from app.routers.settings import get_settings
from app.schemas.session_plans import (
    SessionPlanContent,
    SessionPlanCreate,
    SessionPlanLibraryLinkCreate,
    SessionPlanLibraryLinkOut,
    SessionPlanOut,
    SessionPlanUpdate,
)

_LIBRARY_MODELS: dict[str, type] = {
    "region": Region,
    "faction": Faction,
    "npc": Npc,
    "adversary": Adversary,
}


def _require_session_planning_enabled(db: Annotated[Session, Depends(get_db)]) -> None:
    if not get_settings(db).get("session_planning_enabled", False):
        raise HTTPException(status_code=404)


router = APIRouter(
    prefix="/api/campaigns/{campaign_id}/session-plans",
    tags=["session-plans"],
    dependencies=[Depends(_require_session_planning_enabled)],
)


def _to_out(plan: SessionPlan) -> SessionPlanOut:
    return SessionPlanOut(
        id=plan.id,
        campaign_id=plan.campaign_id,
        title=plan.title,
        summary=plan.summary,
        order=plan.order,
        content=SessionPlanContent.model_validate_json(plan.extra),
        created_at=plan.created_at,
        updated_at=plan.updated_at,
    )


def _get_plan(campaign_id: int, plan_id: int, db: Session) -> SessionPlan:
    plan = db.get(SessionPlan, plan_id)
    if plan is None or plan.campaign_id != campaign_id:
        raise HTTPException(status_code=404, detail="Session plan not found")
    return plan


@router.get("", response_model=list[SessionPlanOut])
def list_session_plans(
    campaign_id: int,
    db: Annotated[Session, Depends(get_db)],
    gm: Annotated[User, Depends(require_role("gm"))],
) -> list[SessionPlanOut]:
    get_owned_campaign(campaign_id, db, gm)
    plans = db.scalars(
        select(SessionPlan)
        .where(SessionPlan.campaign_id == campaign_id)
        .order_by(SessionPlan.order)
    )
    return [_to_out(plan) for plan in plans]


@router.post("", response_model=SessionPlanOut)
def create_session_plan(
    campaign_id: int,
    body: SessionPlanCreate,
    db: Annotated[Session, Depends(get_db)],
    gm: Annotated[User, Depends(require_role("gm"))],
) -> SessionPlanOut:
    get_owned_campaign(campaign_id, db, gm)
    now = datetime.now(UTC)
    plan = SessionPlan(
        campaign_id=campaign_id,
        title=body.title,
        summary=body.summary,
        order=body.order,
        extra=body.content.model_dump_json(),
        created_at=now,
        updated_at=now,
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return _to_out(plan)


@router.get("/{plan_id}", response_model=SessionPlanOut)
def get_session_plan(
    campaign_id: int,
    plan_id: int,
    db: Annotated[Session, Depends(get_db)],
    gm: Annotated[User, Depends(require_role("gm"))],
) -> SessionPlanOut:
    get_owned_campaign(campaign_id, db, gm)
    return _to_out(_get_plan(campaign_id, plan_id, db))


@router.put("/{plan_id}", response_model=SessionPlanOut)
def update_session_plan(
    campaign_id: int,
    plan_id: int,
    body: SessionPlanUpdate,
    db: Annotated[Session, Depends(get_db)],
    gm: Annotated[User, Depends(require_role("gm"))],
) -> SessionPlanOut:
    get_owned_campaign(campaign_id, db, gm)
    plan = _get_plan(campaign_id, plan_id, db)
    if body.title is not None:
        plan.title = body.title
    if body.summary is not None:
        plan.summary = body.summary
    if body.order is not None:
        plan.order = body.order
    if body.content is not None:
        plan.extra = body.content.model_dump_json()
    plan.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(plan)
    return _to_out(plan)


@router.delete("/{plan_id}", status_code=204)
def delete_session_plan(
    campaign_id: int,
    plan_id: int,
    db: Annotated[Session, Depends(get_db)],
    gm: Annotated[User, Depends(require_role("gm"))],
) -> None:
    get_owned_campaign(campaign_id, db, gm)
    plan = _get_plan(campaign_id, plan_id, db)
    db.delete(plan)
    db.commit()


@router.get("/{plan_id}/links", response_model=list[SessionPlanLibraryLinkOut])
def list_links(
    campaign_id: int,
    plan_id: int,
    db: Annotated[Session, Depends(get_db)],
    gm: Annotated[User, Depends(require_role("gm"))],
) -> list[SessionPlanLibraryLink]:
    get_owned_campaign(campaign_id, db, gm)
    _get_plan(campaign_id, plan_id, db)
    return list(
        db.scalars(
            select(SessionPlanLibraryLink).where(
                SessionPlanLibraryLink.session_plan_id == plan_id
            )
        )
    )


@router.post("/{plan_id}/links", response_model=SessionPlanLibraryLinkOut)
def create_link(
    campaign_id: int,
    plan_id: int,
    body: SessionPlanLibraryLinkCreate,
    db: Annotated[Session, Depends(get_db)],
    gm: Annotated[User, Depends(require_role("gm"))],
) -> SessionPlanLibraryLink:
    get_owned_campaign(campaign_id, db, gm)
    _get_plan(campaign_id, plan_id, db)

    model = _LIBRARY_MODELS[body.entity_type]
    if db.get(model, body.entity_id) is None:
        raise HTTPException(status_code=404, detail=f"No such {body.entity_type}")

    existing = db.scalar(
        select(SessionPlanLibraryLink).where(
            SessionPlanLibraryLink.session_plan_id == plan_id,
            SessionPlanLibraryLink.entity_type == body.entity_type,
            SessionPlanLibraryLink.entity_id == body.entity_id,
        )
    )
    if existing is not None:
        raise HTTPException(status_code=409, detail="Already linked")

    link = SessionPlanLibraryLink(
        session_plan_id=plan_id,
        entity_type=body.entity_type,
        entity_id=body.entity_id,
        created_at=datetime.now(UTC),
    )
    db.add(link)
    db.commit()
    db.refresh(link)
    return link


@router.delete("/{plan_id}/links/{link_id}", status_code=204)
def delete_link(
    campaign_id: int,
    plan_id: int,
    link_id: int,
    db: Annotated[Session, Depends(get_db)],
    gm: Annotated[User, Depends(require_role("gm"))],
) -> None:
    get_owned_campaign(campaign_id, db, gm)
    _get_plan(campaign_id, plan_id, db)
    link = db.get(SessionPlanLibraryLink, link_id)
    if link is None or link.session_plan_id != plan_id:
        raise HTTPException(status_code=404, detail="Link not found")
    db.delete(link)
    db.commit()
