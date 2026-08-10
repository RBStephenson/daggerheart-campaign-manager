"""Tests for the player-facing read-only Fear pool and countdown views."""

from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.models import Countdown, User
from tests.conftest import make_user
from tests.test_player import enable, make_campaign, make_membership


def _add_countdown(db: Session, *, campaign_id: int, name: str = "Ashen Cloud") -> Countdown:
    countdown = Countdown(
        campaign_id=campaign_id,
        name=name,
        starting_value=3,
        current_value=3,
        loop=False,
        created_at=datetime.now(UTC),
    )
    db.add(countdown)
    db.commit()
    db.refresh(countdown)
    return countdown


def test_fear_returns_404_when_flag_off(as_user, db: Session) -> None:
    enable(db, "player_area_enabled")
    gm = make_user(db, username="gm1", role="gm")
    campaign = make_campaign(db, gm_id=gm.id)
    client = as_user("player", username="alice")
    alice_id = db.query(User).filter_by(username="alice").one().id
    make_membership(db, campaign_id=campaign.id, player_id=alice_id)

    resp = client.get(f"/api/player/campaigns/{campaign.id}/fear")
    assert resp.status_code == 404


def test_fear_requires_membership(as_user, db: Session) -> None:
    enable(db, "player_area_enabled", "combat_tools_enabled")
    gm = make_user(db, username="gm1", role="gm")
    campaign = make_campaign(db, gm_id=gm.id)
    client = as_user("player", username="alice")

    resp = client.get(f"/api/player/campaigns/{campaign.id}/fear")
    assert resp.status_code == 404


def test_fear_returns_the_campaigns_current_value(as_user, db: Session) -> None:
    enable(db, "player_area_enabled", "combat_tools_enabled")
    gm = make_user(db, username="gm1", role="gm")
    campaign = make_campaign(db, gm_id=gm.id)
    campaign.fear = 5
    db.commit()

    client = as_user("player", username="alice")
    make_membership(
        db, campaign_id=campaign.id, player_id=db.query(User).filter_by(username="alice").one().id
    )

    resp = client.get(f"/api/player/campaigns/{campaign.id}/fear")
    assert resp.status_code == 200
    assert resp.json() == {"fear": 5}


def test_countdowns_returns_404_when_flag_off(as_user, db: Session) -> None:
    enable(db, "player_area_enabled")
    gm = make_user(db, username="gm1", role="gm")
    campaign = make_campaign(db, gm_id=gm.id)
    client = as_user("player", username="alice")
    make_membership(
        db, campaign_id=campaign.id, player_id=db.query(User).filter_by(username="alice").one().id
    )

    resp = client.get(f"/api/player/campaigns/{campaign.id}/countdowns")
    assert resp.status_code == 404


def test_countdowns_requires_membership(as_user, db: Session) -> None:
    enable(db, "player_area_enabled", "combat_tools_enabled")
    gm = make_user(db, username="gm1", role="gm")
    campaign = make_campaign(db, gm_id=gm.id)
    _add_countdown(db, campaign_id=campaign.id)
    client = as_user("player", username="alice")

    resp = client.get(f"/api/player/campaigns/{campaign.id}/countdowns")
    assert resp.status_code == 404


def test_countdowns_lists_the_campaigns_countdowns(as_user, db: Session) -> None:
    enable(db, "player_area_enabled", "combat_tools_enabled")
    gm = make_user(db, username="gm1", role="gm")
    campaign = make_campaign(db, gm_id=gm.id)
    _add_countdown(db, campaign_id=campaign.id, name="Ashen Cloud")
    _add_countdown(db, campaign_id=campaign.id, name="Volley of Arrows")

    client = as_user("player", username="alice")
    make_membership(
        db, campaign_id=campaign.id, player_id=db.query(User).filter_by(username="alice").one().id
    )

    resp = client.get(f"/api/player/campaigns/{campaign.id}/countdowns")
    assert resp.status_code == 200
    names = sorted(c["name"] for c in resp.json())
    assert names == ["Ashen Cloud", "Volley of Arrows"]


def test_countdowns_scoped_to_campaign(as_user, db: Session) -> None:
    enable(db, "player_area_enabled", "combat_tools_enabled")
    gm = make_user(db, username="gm1", role="gm")
    campaign_a = make_campaign(db, gm_id=gm.id, name="A")
    campaign_b = make_campaign(db, gm_id=gm.id, name="B")
    _add_countdown(db, campaign_id=campaign_a.id, name="In A")
    _add_countdown(db, campaign_id=campaign_b.id, name="In B")

    client = as_user("player", username="alice")
    alice_id = db.query(User).filter_by(username="alice").one().id
    make_membership(db, campaign_id=campaign_a.id, player_id=alice_id)
    make_membership(db, campaign_id=campaign_b.id, player_id=alice_id)

    resp = client.get(f"/api/player/campaigns/{campaign_a.id}/countdowns")
    assert [c["name"] for c in resp.json()] == ["In A"]
