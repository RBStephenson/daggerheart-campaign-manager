"""GM combat tools: the shared Fear pool (DHCM-54) and countdowns (DHCM-55).

Gated by combat_tools_enabled. Nested under a campaign and scoped by the same
GM-ownership check campaigns.py's own lifecycle endpoints use
(app.deps.get_owned_campaign).
"""

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_owned_campaign, require_role
from app.models import Countdown, User
from app.routers.settings import get_settings
from app.schemas.combat import CountdownAdjust, CountdownCreate, CountdownOut, FearAdjust, FearOut

# The SRD: "You start a campaign with 1 Fear per PC... You can never have
# more than 12 Fear at one time."
FEAR_MAX = 12


def _require_combat_tools_enabled(db: Annotated[Session, Depends(get_db)]) -> None:
    if not get_settings(db).get("combat_tools_enabled", False):
        raise HTTPException(status_code=404)


fear_router = APIRouter(
    prefix="/api/campaigns/{campaign_id}/fear",
    tags=["combat"],
    dependencies=[Depends(_require_combat_tools_enabled)],
)


@fear_router.patch("", response_model=FearOut)
def adjust_fear(
    campaign_id: int,
    body: FearAdjust,
    db: Annotated[Session, Depends(get_db)],
    gm: Annotated[User, Depends(require_role("gm"))],
) -> FearOut:
    campaign = get_owned_campaign(campaign_id, db, gm)
    campaign.fear = max(0, min(FEAR_MAX, campaign.fear + body.delta))
    db.commit()
    return FearOut(fear=campaign.fear)


countdown_router = APIRouter(
    prefix="/api/campaigns/{campaign_id}/countdowns",
    tags=["combat"],
    dependencies=[Depends(_require_combat_tools_enabled)],
)


def _get_countdown(campaign_id: int, countdown_id: int, db: Session) -> Countdown:
    countdown = db.get(Countdown, countdown_id)
    if countdown is None or countdown.campaign_id != campaign_id:
        raise HTTPException(status_code=404, detail="Countdown not found")
    return countdown


@countdown_router.get("", response_model=list[CountdownOut])
def list_countdowns(
    campaign_id: int,
    db: Annotated[Session, Depends(get_db)],
    gm: Annotated[User, Depends(require_role("gm"))],
) -> list[Countdown]:
    get_owned_campaign(campaign_id, db, gm)
    return list(
        db.scalars(
            select(Countdown).where(Countdown.campaign_id == campaign_id).order_by(Countdown.id)
        )
    )


@countdown_router.post("", response_model=CountdownOut)
def create_countdown(
    campaign_id: int,
    body: CountdownCreate,
    db: Annotated[Session, Depends(get_db)],
    gm: Annotated[User, Depends(require_role("gm"))],
) -> Countdown:
    get_owned_campaign(campaign_id, db, gm)
    countdown = Countdown(
        campaign_id=campaign_id,
        name=body.name,
        starting_value=body.starting_value,
        current_value=body.starting_value,
        loop=body.loop,
        created_at=datetime.now(UTC),
    )
    db.add(countdown)
    db.commit()
    db.refresh(countdown)
    return countdown


@countdown_router.patch("/{countdown_id}", response_model=CountdownOut)
def adjust_countdown(
    campaign_id: int,
    countdown_id: int,
    body: CountdownAdjust,
    db: Annotated[Session, Depends(get_db)],
    gm: Annotated[User, Depends(require_role("gm"))],
) -> Countdown:
    get_owned_campaign(campaign_id, db, gm)
    countdown = _get_countdown(campaign_id, countdown_id, db)
    new_value = countdown.current_value - body.delta
    if new_value <= 0:
        countdown.triggered_at = datetime.now(UTC)
        countdown.current_value = countdown.starting_value if countdown.loop else 0
    else:
        countdown.current_value = new_value
    db.commit()
    return countdown


@countdown_router.delete("/{countdown_id}", status_code=204)
def delete_countdown(
    campaign_id: int,
    countdown_id: int,
    db: Annotated[Session, Depends(get_db)],
    gm: Annotated[User, Depends(require_role("gm"))],
) -> None:
    get_owned_campaign(campaign_id, db, gm)
    countdown = _get_countdown(campaign_id, countdown_id, db)
    db.delete(countdown)
    db.commit()
