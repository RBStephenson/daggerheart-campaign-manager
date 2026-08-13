"""Tests for the GM encounter-budget endpoint."""

import json

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.deps import get_current_user
from app.models import AppSetting, User
from tests.conftest import make_user


def _enable(db: Session) -> None:
    db.add(AppSetting(key="campaigns_enabled", value=json.dumps(True)))
    db.add(AppSetting(key="combat_tools_enabled", value=json.dumps(True)))
    db.add(AppSetting(key="player_area_enabled", value=json.dumps(True)))
    db.commit()


def _as(client: TestClient, user: User) -> TestClient:
    client.app.dependency_overrides[get_current_user] = lambda: user
    return client


def _create_campaign(gm: TestClient) -> int:
    resp = gm.post("/api/campaigns", json={"name": "Windmere"})
    assert resp.status_code == 200
    return int(resp.json()["id"])


def _add_member(gm: TestClient, campaign_id: int, username: str) -> None:
    resp = gm.post(f"/api/campaigns/{campaign_id}/members", json={"username": username})
    assert resp.status_code == 200


def _create_character(player: TestClient, campaign_id: int, name: str) -> None:
    resp = player.post(
        "/api/player/characters",
        json={"campaign_id": campaign_id, "name": name, "char_class": "Bard"},
    )
    assert resp.status_code == 200


def test_returns_404_when_combat_tools_flag_off(as_user, db: Session) -> None:
    db.add(AppSetting(key="campaigns_enabled", value=json.dumps(True)))
    db.commit()
    gm = as_user("gm")
    campaign_id = _create_campaign(gm)
    resp = gm.get(f"/api/campaigns/{campaign_id}/encounter-budget")
    assert resp.status_code == 404


def test_player_forbidden(as_user, db: Session) -> None:
    _enable(db)
    gm = as_user("gm", username="gm-user")
    campaign_id = _create_campaign(gm)
    resp = as_user("player", username="player-user").get(
        f"/api/campaigns/{campaign_id}/encounter-budget"
    )
    assert resp.status_code == 403


def test_budget_with_no_party(as_user, db: Session) -> None:
    _enable(db)
    gm = as_user("gm")
    campaign_id = _create_campaign(gm)
    resp = gm.get(f"/api/campaigns/{campaign_id}/encounter-budget")
    assert resp.status_code == 200
    assert resp.json() == {"party_size": 0, "budget": 2}


def test_budget_reflects_real_party_size(client: TestClient, db: Session) -> None:
    _enable(db)
    gm_user = make_user(db, username="gm-user", role="gm")
    alice = make_user(db, username="alice", role="player")
    bob = make_user(db, username="bob", role="player")

    campaign_id = _create_campaign(_as(client, gm_user))
    _add_member(_as(client, gm_user), campaign_id, "alice")
    _add_member(_as(client, gm_user), campaign_id, "bob")
    _create_character(_as(client, alice), campaign_id, "Restwell")
    _create_character(_as(client, bob), campaign_id, "Grimtooth")

    resp = _as(client, gm_user).get(f"/api/campaigns/{campaign_id}/encounter-budget")
    assert resp.status_code == 200
    assert resp.json() == {"party_size": 2, "budget": 8}


def test_budget_applies_query_param_adjustments(as_user, db: Session) -> None:
    _enable(db)
    gm = as_user("gm")
    campaign_id = _create_campaign(gm)
    resp = gm.get(
        f"/api/campaigns/{campaign_id}/encounter-budget",
        params={"harder_fight": True, "lower_tier_adversary": True},
    )
    assert resp.status_code == 200
    # base 2, +2 harder, +1 lower tier = 5
    assert resp.json() == {"party_size": 0, "budget": 5}


def test_other_gms_campaign_is_404(as_user, db: Session) -> None:
    _enable(db)
    gm_a = as_user("gm", username="gm-a")
    campaign_id = _create_campaign(gm_a)

    gm_b = as_user("gm", username="gm-b")
    resp = gm_b.get(f"/api/campaigns/{campaign_id}/encounter-budget")
    assert resp.status_code == 404
