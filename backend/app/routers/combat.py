"""GM combat tools: the shared Fear pool (DHCM-54) and, later, countdowns.

Gated by combat_tools_enabled. Nested under a campaign and scoped by the same
GM-ownership check campaigns.py's own lifecycle endpoints use
(app.deps.get_owned_campaign).
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_owned_campaign, require_role
from app.models import User
from app.routers.settings import get_settings
from app.schemas.combat import FearAdjust, FearOut

# The SRD: "You start a campaign with 1 Fear per PC... You can never have
# more than 12 Fear at one time."
FEAR_MAX = 12


def _require_combat_tools_enabled(db: Annotated[Session, Depends(get_db)]) -> None:
    if not get_settings(db).get("combat_tools_enabled", False):
        raise HTTPException(status_code=404)


router = APIRouter(
    prefix="/api/campaigns/{campaign_id}/fear",
    tags=["combat"],
    dependencies=[Depends(_require_combat_tools_enabled)],
)


@router.patch("", response_model=FearOut)
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
