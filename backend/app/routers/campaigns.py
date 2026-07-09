"""GM campaign CRUD and session lifecycle. Gated by campaigns_enabled."""

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_role
from app.models import Campaign, CampaignMembership, GameSession, User
from app.routers.settings import get_settings
from app.schemas.campaigns import CampaignCreate, CampaignOut, CampaignUpdate, GameSessionOut
from app.schemas.player import AddMemberRequest, CampaignMemberOut


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


@router.get("/{campaign_id}/members", response_model=list[CampaignMemberOut])
def list_members(
    campaign_id: int,
    db: Annotated[Session, Depends(get_db)],
    gm: Annotated[User, Depends(require_role("gm"))],
) -> list[CampaignMemberOut]:
    _get_owned_campaign(campaign_id, db, gm)
    rows = db.execute(
        select(CampaignMembership, User.username)
        .join(User, CampaignMembership.player_user_id == User.id)
        .where(CampaignMembership.campaign_id == campaign_id)
    ).all()
    return [
        CampaignMemberOut(
            id=member.id,
            campaign_id=member.campaign_id,
            player_user_id=member.player_user_id,
            player_username=username,
            joined_at=member.joined_at,
        )
        for member, username in rows
    ]


@router.post("/{campaign_id}/members", response_model=CampaignMemberOut)
def add_member(
    campaign_id: int,
    body: AddMemberRequest,
    db: Annotated[Session, Depends(get_db)],
    gm: Annotated[User, Depends(require_role("gm"))],
) -> CampaignMemberOut:
    _get_owned_campaign(campaign_id, db, gm)
    player = db.scalar(select(User).where(User.username == body.username))
    if player is None or player.role != "player":
        raise HTTPException(status_code=404, detail="No such player")

    existing = db.scalar(
        select(CampaignMembership).where(
            CampaignMembership.campaign_id == campaign_id,
            CampaignMembership.player_user_id == player.id,
        )
    )
    if existing is not None:
        raise HTTPException(status_code=409, detail="Already a member")

    member = CampaignMembership(
        campaign_id=campaign_id, player_user_id=player.id, joined_at=datetime.now(UTC)
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    return CampaignMemberOut(
        id=member.id,
        campaign_id=member.campaign_id,
        player_user_id=member.player_user_id,
        player_username=player.username,
        joined_at=member.joined_at,
    )


@router.delete("/{campaign_id}/members/{user_id}", status_code=204)
def remove_member(
    campaign_id: int,
    user_id: int,
    db: Annotated[Session, Depends(get_db)],
    gm: Annotated[User, Depends(require_role("gm"))],
) -> None:
    _get_owned_campaign(campaign_id, db, gm)
    member = db.scalar(
        select(CampaignMembership).where(
            CampaignMembership.campaign_id == campaign_id,
            CampaignMembership.player_user_id == user_id,
        )
    )
    if member is None:
        raise HTTPException(status_code=404, detail="Not a member")
    db.delete(member)
    db.commit()
