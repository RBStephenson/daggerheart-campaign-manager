"""GM campaign CRUD and session lifecycle. Gated by campaigns_enabled."""

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_role
from app.models import Campaign, GameSession, User
from app.routers.settings import get_settings
from app.schemas.campaigns import CampaignCreate, CampaignOut, CampaignUpdate, GameSessionOut


def _require_campaigns_enabled(db: Annotated[Session, Depends(get_db)]) -> None:
    if not get_settings(db).get("campaigns_enabled", False):
        raise HTTPException(status_code=404)


router = APIRouter(
    prefix="/api/campaigns",
    tags=["campaigns"],
    dependencies=[Depends(_require_campaigns_enabled)],
)


def _get_owned_campaign(campaign_id: int, db: Session, gm: User) -> Campaign:
    campaign = db.get(Campaign, campaign_id)
    if campaign is None or campaign.gm_user_id != gm.id:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign


@router.get("", response_model=list[CampaignOut])
def list_campaigns(
    db: Annotated[Session, Depends(get_db)],
    gm: Annotated[User, Depends(require_role("gm"))],
) -> list[Campaign]:
    return list(db.scalars(select(Campaign).where(Campaign.gm_user_id == gm.id)))


@router.post("", response_model=CampaignOut)
def create_campaign(
    body: CampaignCreate,
    db: Annotated[Session, Depends(get_db)],
    gm: Annotated[User, Depends(require_role("gm"))],
) -> Campaign:
    campaign = Campaign(
        name=body.name,
        description=body.description,
        gm_user_id=gm.id,
        created_at=datetime.now(UTC),
    )
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return campaign


@router.get("/{campaign_id}", response_model=CampaignOut)
def get_campaign(
    campaign_id: int,
    db: Annotated[Session, Depends(get_db)],
    gm: Annotated[User, Depends(require_role("gm"))],
) -> Campaign:
    return _get_owned_campaign(campaign_id, db, gm)


@router.put("/{campaign_id}", response_model=CampaignOut)
def update_campaign(
    campaign_id: int,
    body: CampaignUpdate,
    db: Annotated[Session, Depends(get_db)],
    gm: Annotated[User, Depends(require_role("gm"))],
) -> Campaign:
    campaign = _get_owned_campaign(campaign_id, db, gm)
    if body.name is not None:
        campaign.name = body.name
    if body.description is not None:
        campaign.description = body.description
    db.commit()
    db.refresh(campaign)
    return campaign


@router.delete("/{campaign_id}", status_code=204)
def delete_campaign(
    campaign_id: int,
    db: Annotated[Session, Depends(get_db)],
    gm: Annotated[User, Depends(require_role("gm"))],
) -> None:
    campaign = _get_owned_campaign(campaign_id, db, gm)
    db.delete(campaign)
    db.commit()


@router.get("/{campaign_id}/sessions", response_model=list[GameSessionOut])
def list_sessions(
    campaign_id: int,
    db: Annotated[Session, Depends(get_db)],
    gm: Annotated[User, Depends(require_role("gm"))],
) -> list[GameSession]:
    _get_owned_campaign(campaign_id, db, gm)
    return list(
        db.scalars(
            select(GameSession)
            .where(GameSession.campaign_id == campaign_id)
            .order_by(GameSession.started_at.desc())
        )
    )


@router.post("/{campaign_id}/sessions", response_model=GameSessionOut)
def start_session(
    campaign_id: int,
    db: Annotated[Session, Depends(get_db)],
    gm: Annotated[User, Depends(require_role("gm"))],
) -> GameSession:
    _get_owned_campaign(campaign_id, db, gm)
    existing = db.scalar(
        select(GameSession).where(
            GameSession.campaign_id == campaign_id, GameSession.status == "active"
        )
    )
    if existing is not None:
        raise HTTPException(status_code=409, detail="A session is already active")

    session = GameSession(
        campaign_id=campaign_id, status="active", started_at=datetime.now(UTC)
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.post("/{campaign_id}/sessions/{session_id}/end", response_model=GameSessionOut)
def end_session(
    campaign_id: int,
    session_id: int,
    db: Annotated[Session, Depends(get_db)],
    gm: Annotated[User, Depends(require_role("gm"))],
) -> GameSession:
    _get_owned_campaign(campaign_id, db, gm)
    session = db.get(GameSession, session_id)
    if session is None or session.campaign_id != campaign_id:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status != "active":
        raise HTTPException(status_code=409, detail="Session is not active")

    session.status = "ended"
    session.ended_at = datetime.now(UTC)
    db.commit()
    db.refresh(session)
    return session
