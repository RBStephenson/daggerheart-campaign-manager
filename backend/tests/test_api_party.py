"""Tests for the GM's read-only party view."""

import json

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.deps import get_current_user
from app.models import AppSetting, User
from tests.conftest import make_user


def _enable(db: Session) -> None:
    db.add(AppSetting(key="campaigns_enabled", value=json.dumps(True)))
    db.add(AppSetting(key="player_area_enabled", value=json.dumps(True)))
    db.commit()


def _as(client: TestClient, user: User) -> TestClient:
    """Switch the shared test client's identity to an already-created user,
    without re-creating it (as_user's own make_user call would collide on
    the unique username when a test needs to switch back and forth between
    two already-existing identities, e.g. gm -> player -> gm)."""
    client.app.dependency_overrides[get_current_user] = lambda: user
    return client


def _create_campaign(gm: TestClient) -> int:
    resp = gm.post("/api/campaigns", json={"name": "Windmere"})
    assert resp.status_code == 200
    return int(resp.json()["id"])


def _add_member(gm: TestClient, campaign_id: int, username: str) -> None:
    resp = gm.post(f"/api/campaigns/{campaign_id}/members", json={"username": username})
    assert resp.status_code == 200


def _create_character(player: TestClient, campaign_id: int, name: str) -> int:
    resp = player.post(
        "/api/player/characters",
        json={"campaign_id": campaign_id, "name": name, "char_class": "Bard"},
    )
    assert resp.status_code == 200
    return int(resp.json()["id"])


def test_returns_404_when_flag_off(as_user, db: Session) -> None:
    db.add(AppSetting(key="player_area_enabled", value=json.dumps(True)))
    db.commit()
    gm = as_user("gm")
    resp = gm.get("/api/campaigns/1/party")
    assert resp.status_code == 404


def test_player_forbidden(as_user, db: Session) -> None:
    _enable(db)
    gm = as_user("gm", username="gm-user")
    campaign_id = _create_campaign(gm)
    resp = as_user("player", username="player-user").get(f"/api/campaigns/{campaign_id}/party")
    assert resp.status_code == 403


def test_empty_party_when_no_characters(as_user, db: Session) -> None:
    _enable(db)
    gm = as_user("gm")
    campaign_id = _create_campaign(gm)
    resp = gm.get(f"/api/campaigns/{campaign_id}/party")
    assert resp.status_code == 200
    assert resp.json() == []


def test_lists_a_members_character(client: TestClient, db: Session) -> None:
    _enable(db)
    gm_user = make_user(db, username="gm-user", role="gm")
    alice = make_user(db, username="alice", role="player")

    campaign_id = _create_campaign(_as(client, gm_user))
    _add_member(_as(client, gm_user), campaign_id, "alice")
    _create_character(_as(client, alice), campaign_id, "Restwell")

    resp = _as(client, gm_user).get(f"/api/campaigns/{campaign_id}/party")
    assert resp.status_code == 200
    party = resp.json()
    assert len(party) == 1
    assert party[0]["player_username"] == "alice"
    assert party[0]["character"]["name"] == "Restwell"
    assert party[0]["character"]["hp_marked"] == 0


def test_lists_multiple_characters_from_multiple_members(client: TestClient, db: Session) -> None:
    _enable(db)
    gm_user = make_user(db, username="gm-user", role="gm")
    alice = make_user(db, username="alice", role="player")
    bob = make_user(db, username="bob", role="player")

    campaign_id = _create_campaign(_as(client, gm_user))
    _add_member(_as(client, gm_user), campaign_id, "alice")
    _add_member(_as(client, gm_user), campaign_id, "bob")
    _create_character(_as(client, alice), campaign_id, "Restwell")
    _create_character(_as(client, bob), campaign_id, "Grimtooth")

    resp = _as(client, gm_user).get(f"/api/campaigns/{campaign_id}/party")
    names = sorted(c["character"]["name"] for c in resp.json())
    assert names == ["Grimtooth", "Restwell"]


def test_a_player_can_have_multiple_characters(client: TestClient, db: Session) -> None:
    _enable(db)
    gm_user = make_user(db, username="gm-user", role="gm")
    alice = make_user(db, username="alice", role="player")

    campaign_id = _create_campaign(_as(client, gm_user))
    _add_member(_as(client, gm_user), campaign_id, "alice")
    _create_character(_as(client, alice), campaign_id, "Restwell")
    _create_character(_as(client, alice), campaign_id, "Backup Bard")

    resp = _as(client, gm_user).get(f"/api/campaigns/{campaign_id}/party")
    party = resp.json()
    assert len(party) == 2
    assert all(c["player_username"] == "alice" for c in party)


def test_other_gms_campaign_is_404(as_user, db: Session) -> None:
    _enable(db)
    gm_a = as_user("gm", username="gm-a")
    campaign_id = _create_campaign(gm_a)

    gm_b = as_user("gm", username="gm-b")
    resp = gm_b.get(f"/api/campaigns/{campaign_id}/party")
    assert resp.status_code == 404
