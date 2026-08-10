"""Tests for the GM Fear pool endpoint."""

import json

from sqlalchemy.orm import Session

from app.models import AppSetting


def _enable(db: Session, *, combat_tools: bool = True) -> None:
    db.add(AppSetting(key="campaigns_enabled", value=json.dumps(True)))
    if combat_tools:
        db.add(AppSetting(key="combat_tools_enabled", value=json.dumps(True)))
    db.commit()


def _create_campaign(client) -> int:
    resp = client.post("/api/campaigns", json={"name": "Windmere"})
    assert resp.status_code == 200
    return int(resp.json()["id"])


def test_new_campaign_starts_at_zero_fear(as_user, db: Session) -> None:
    _enable(db)
    gm = as_user("gm")
    campaign_id = _create_campaign(gm)
    assert gm.get(f"/api/campaigns/{campaign_id}").json()["fear"] == 0


def test_returns_404_when_flag_off(as_user, db: Session) -> None:
    _enable(db, combat_tools=False)
    gm = as_user("gm")
    campaign_id = _create_campaign(gm)
    resp = gm.patch(f"/api/campaigns/{campaign_id}/fear", json={"delta": 1})
    assert resp.status_code == 404


def test_player_forbidden(as_user, db: Session) -> None:
    _enable(db)
    gm = as_user("gm", username="gm-user")
    campaign_id = _create_campaign(gm)
    resp = as_user("player", username="player-user").patch(
        f"/api/campaigns/{campaign_id}/fear", json={"delta": 1}
    )
    assert resp.status_code == 403


def test_gain_and_spend_fear(as_user, db: Session) -> None:
    _enable(db)
    gm = as_user("gm")
    campaign_id = _create_campaign(gm)

    resp = gm.patch(f"/api/campaigns/{campaign_id}/fear", json={"delta": 3})
    assert resp.status_code == 200
    assert resp.json()["fear"] == 3

    resp = gm.patch(f"/api/campaigns/{campaign_id}/fear", json={"delta": -1})
    assert resp.json()["fear"] == 2


def test_fear_is_clamped_to_zero(as_user, db: Session) -> None:
    _enable(db)
    gm = as_user("gm")
    campaign_id = _create_campaign(gm)
    resp = gm.patch(f"/api/campaigns/{campaign_id}/fear", json={"delta": -5})
    assert resp.json()["fear"] == 0


def test_fear_is_clamped_to_twelve(as_user, db: Session) -> None:
    _enable(db)
    gm = as_user("gm")
    campaign_id = _create_campaign(gm)
    resp = gm.patch(f"/api/campaigns/{campaign_id}/fear", json={"delta": 99})
    assert resp.json()["fear"] == 12


def test_fear_carries_across_multiple_adjustments(as_user, db: Session) -> None:
    _enable(db)
    gm = as_user("gm")
    campaign_id = _create_campaign(gm)
    gm.patch(f"/api/campaigns/{campaign_id}/fear", json={"delta": 4})
    gm.patch(f"/api/campaigns/{campaign_id}/fear", json={"delta": 4})
    resp = gm.patch(f"/api/campaigns/{campaign_id}/fear", json={"delta": 4})
    assert resp.json()["fear"] == 12


def test_other_gms_campaign_is_404(as_user, db: Session) -> None:
    _enable(db)
    gm_a = as_user("gm", username="gm-a")
    campaign_id = _create_campaign(gm_a)

    gm_b = as_user("gm", username="gm-b")
    resp = gm_b.patch(f"/api/campaigns/{campaign_id}/fear", json={"delta": 1})
    assert resp.status_code == 404
