"""Real WebSocket integration tests: a REST mutation broadcasts to a room a
client is actually connected to, not just a mocked call assertion."""

import json

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import AppSetting
from tests.conftest import make_user
from tests.test_character_sheet import valid_bard_sheet


def _enable(db: Session, *keys: str) -> None:
    for key in keys:
        db.add(AppSetting(key=key, value=json.dumps(True)))
    db.commit()


def _login(client: TestClient, *, username: str, password: str = "s3cret-pass") -> None:
    resp = client.post("/api/auth/login", json={"username": username, "password": password})
    assert resp.status_code == 200


def test_fear_change_broadcasts_to_the_active_session_room(client: TestClient, db: Session) -> None:
    _enable(db, "realtime_enabled", "campaigns_enabled", "combat_tools_enabled")
    make_user(db, username="gm1", role="gm", password="s3cret-pass")
    _login(client, username="gm1")

    campaign_id = client.post("/api/campaigns", json={"name": "Windmere"}).json()["id"]
    room = client.post(f"/api/campaigns/{campaign_id}/sessions").json()["room"]

    with client.websocket_connect(f"/ws/{room}") as ws:
        resp = client.patch(f"/api/campaigns/{campaign_id}/fear", json={"delta": 2})
        assert resp.status_code == 200
        data = ws.receive_json()

    assert data == {"type": "fear", "payload": {"fear": 2}}


def test_countdown_create_and_advance_broadcast(client: TestClient, db: Session) -> None:
    _enable(db, "realtime_enabled", "campaigns_enabled", "combat_tools_enabled")
    make_user(db, username="gm1", role="gm", password="s3cret-pass")
    _login(client, username="gm1")

    campaign_id = client.post("/api/campaigns", json={"name": "Windmere"}).json()["id"]
    room = client.post(f"/api/campaigns/{campaign_id}/sessions").json()["room"]

    with client.websocket_connect(f"/ws/{room}") as ws:
        create_resp = client.post(
            f"/api/campaigns/{campaign_id}/countdowns",
            json={"name": "Ashen Cloud", "starting_value": 3, "loop": False},
        )
        countdown_id = create_resp.json()["id"]
        created_msg = ws.receive_json()

        client.patch(f"/api/campaigns/{campaign_id}/countdowns/{countdown_id}", json={"delta": 1})
        advanced_msg = ws.receive_json()

    assert created_msg["type"] == "countdown_created"
    assert created_msg["payload"]["name"] == "Ashen Cloud"
    assert advanced_msg["type"] == "countdown_updated"
    assert advanced_msg["payload"]["current_value"] == 2


def test_character_state_change_broadcasts_to_the_active_session_room(
    client: TestClient, db: Session
) -> None:
    _enable(
        db,
        "realtime_enabled",
        "campaigns_enabled",
        "player_area_enabled",
        "character_sheet_enabled",
    )
    make_user(db, username="gm1", role="gm", password="s3cret-pass")
    make_user(db, username="alice", role="player", password="s3cret-pass")

    _login(client, username="gm1")
    campaign_id = client.post("/api/campaigns", json={"name": "Windmere"}).json()["id"]
    room = client.post(f"/api/campaigns/{campaign_id}/sessions").json()["room"]
    client.post(f"/api/campaigns/{campaign_id}/members", json={"username": "alice"})

    _login(client, username="alice")
    character_id = client.post(
        "/api/player/characters",
        json={
            "campaign_id": campaign_id,
            "name": "Restwell",
            "char_class": "Bard",
            "ancestry": "Human",
            "community": "Wanderborne",
            "level": 1,
            "extra": json.dumps(valid_bard_sheet()),
        },
    ).json()["id"]

    with client.websocket_connect(f"/ws/{room}") as ws:
        resp = client.patch(
            f"/api/player/characters/{character_id}/state", json={"hp_marked": 2}
        )
        assert resp.status_code == 200
        data = ws.receive_json()

    assert data["type"] == "character_state"
    assert data["payload"]["id"] == character_id
    assert data["payload"]["hp_marked"] == 2
