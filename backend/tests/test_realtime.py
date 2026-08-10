"""Unit tests for the broadcast-to-campaign helper."""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch

from sqlalchemy.orm import Session

from app.models import Campaign, GameSession, User
from app.services.realtime import broadcast_to_campaign
from tests.conftest import make_user


def _make_campaign(db: Session, gm: User) -> Campaign:
    campaign = Campaign(
        name="Windmere", description="", gm_user_id=gm.id, created_at=datetime.now(UTC)
    )
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return campaign


async def test_no_op_when_no_active_session(db: Session) -> None:
    gm = make_user(db, username="gm1", role="gm")
    campaign = _make_campaign(db, gm)

    with patch("app.services.realtime.manager.broadcast", new_callable=AsyncMock) as mock_broadcast:
        await broadcast_to_campaign(campaign.id, db, {"type": "fear", "payload": {"fear": 1}})
    mock_broadcast.assert_not_called()


async def test_broadcasts_to_the_active_sessions_room(db: Session) -> None:
    gm = make_user(db, username="gm1", role="gm")
    campaign = _make_campaign(db, gm)
    session = GameSession(
        campaign_id=campaign.id, status="active", started_at=datetime.now(UTC)
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    with patch("app.services.realtime.manager.broadcast", new_callable=AsyncMock) as mock_broadcast:
        await broadcast_to_campaign(campaign.id, db, {"type": "fear", "payload": {"fear": 1}})
    mock_broadcast.assert_called_once_with(session.room, {"type": "fear", "payload": {"fear": 1}})


async def test_ignores_an_ended_session(db: Session) -> None:
    gm = make_user(db, username="gm1", role="gm")
    campaign = _make_campaign(db, gm)
    db.add(
        GameSession(
            campaign_id=campaign.id,
            status="ended",
            started_at=datetime.now(UTC),
            ended_at=datetime.now(UTC),
        )
    )
    db.commit()

    with patch("app.services.realtime.manager.broadcast", new_callable=AsyncMock) as mock_broadcast:
        await broadcast_to_campaign(campaign.id, db, {"type": "fear", "payload": {"fear": 1}})
    mock_broadcast.assert_not_called()
