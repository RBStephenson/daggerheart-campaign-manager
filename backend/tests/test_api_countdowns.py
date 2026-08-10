"""Tests for the GM countdown-tracker endpoints."""

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


def _create_countdown(client, campaign_id: int, **overrides) -> dict:
    body = {"name": "Ashen Cloud", "starting_value": 3, "loop": False, **overrides}
    resp = client.post(f"/api/campaigns/{campaign_id}/countdowns", json=body)
    assert resp.status_code == 200
    return resp.json()


def test_returns_404_when_flag_off(as_user, db: Session) -> None:
    _enable(db, combat_tools=False)
    gm = as_user("gm")
    campaign_id = _create_campaign(gm)
    resp = gm.get(f"/api/campaigns/{campaign_id}/countdowns")
    assert resp.status_code == 404


def test_player_forbidden(as_user, db: Session) -> None:
    _enable(db)
    gm = as_user("gm", username="gm-user")
    campaign_id = _create_campaign(gm)
    resp = as_user("player", username="player-user").get(f"/api/campaigns/{campaign_id}/countdowns")
    assert resp.status_code == 403


def test_create_and_list(as_user, db: Session) -> None:
    _enable(db)
    gm = as_user("gm")
    campaign_id = _create_campaign(gm)

    created = _create_countdown(
        gm, campaign_id, name="Volley of Arrows", starting_value=3, loop=True
    )
    assert created["current_value"] == 3
    assert created["triggered_at"] is None

    resp = gm.get(f"/api/campaigns/{campaign_id}/countdowns")
    assert resp.status_code == 200
    assert [c["name"] for c in resp.json()] == ["Volley of Arrows"]


def test_advance_ticks_down(as_user, db: Session) -> None:
    _enable(db)
    gm = as_user("gm")
    campaign_id = _create_campaign(gm)
    countdown = _create_countdown(gm, campaign_id, starting_value=3)

    resp = gm.patch(
        f"/api/campaigns/{campaign_id}/countdowns/{countdown['id']}", json={"delta": 1}
    )
    assert resp.status_code == 200
    assert resp.json()["current_value"] == 2
    assert resp.json()["triggered_at"] is None


def test_dynamic_advance_ticks_down_by_more_than_one(as_user, db: Session) -> None:
    _enable(db)
    gm = as_user("gm")
    campaign_id = _create_campaign(gm)
    countdown = _create_countdown(gm, campaign_id, starting_value=6)

    resp = gm.patch(
        f"/api/campaigns/{campaign_id}/countdowns/{countdown['id']}", json={"delta": 3}
    )
    assert resp.json()["current_value"] == 3


def test_non_loop_countdown_sticks_at_zero_when_triggered(as_user, db: Session) -> None:
    _enable(db)
    gm = as_user("gm")
    campaign_id = _create_campaign(gm)
    countdown = _create_countdown(gm, campaign_id, starting_value=2, loop=False)

    resp = gm.patch(
        f"/api/campaigns/{campaign_id}/countdowns/{countdown['id']}", json={"delta": 5}
    )
    assert resp.json()["current_value"] == 0
    assert resp.json()["triggered_at"] is not None


def test_loop_countdown_resets_to_starting_value_when_triggered(as_user, db: Session) -> None:
    _enable(db)
    gm = as_user("gm")
    campaign_id = _create_campaign(gm)
    countdown = _create_countdown(gm, campaign_id, starting_value=3, loop=True)

    resp = gm.patch(
        f"/api/campaigns/{campaign_id}/countdowns/{countdown['id']}", json={"delta": 3}
    )
    assert resp.json()["current_value"] == 3
    assert resp.json()["triggered_at"] is not None


def test_delete_countdown(as_user, db: Session) -> None:
    _enable(db)
    gm = as_user("gm")
    campaign_id = _create_campaign(gm)
    countdown = _create_countdown(gm, campaign_id)

    resp = gm.delete(f"/api/campaigns/{campaign_id}/countdowns/{countdown['id']}")
    assert resp.status_code == 204
    assert gm.get(f"/api/campaigns/{campaign_id}/countdowns").json() == []


def test_other_gms_campaign_is_404(as_user, db: Session) -> None:
    _enable(db)
    gm_a = as_user("gm", username="gm-a")
    campaign_id = _create_campaign(gm_a)
    countdown = _create_countdown(gm_a, campaign_id)

    gm_b = as_user("gm", username="gm-b")
    resp = gm_b.get(f"/api/campaigns/{campaign_id}/countdowns")
    assert resp.status_code == 404
    resp = gm_b.patch(
        f"/api/campaigns/{campaign_id}/countdowns/{countdown['id']}", json={"delta": 1}
    )
    assert resp.status_code == 404
