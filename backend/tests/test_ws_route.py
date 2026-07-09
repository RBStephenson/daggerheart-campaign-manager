import json

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import AppSetting
from tests.conftest import make_user


def enable_realtime(db: Session) -> None:
    db.add(AppSetting(key="realtime_enabled", value=json.dumps(True)))
    db.commit()


def login(client: TestClient, db: Session, *, username: str = "alice") -> None:
    make_user(db, username=username, role="player", password="s3cret-pass")
    resp = client.post("/api/auth/login", json={"username": username, "password": "s3cret-pass"})
    assert resp.status_code == 200


def test_connect_rejected_when_flag_disabled(client: TestClient, db: Session) -> None:
    login(client, db)
    try:
        with client.websocket_connect("/ws/room1"):
            pass
    except Exception:  # noqa: BLE001 - starlette raises on refused handshake/close
        return
    raise AssertionError("expected the connection to be rejected")


def test_connect_rejected_when_unauthenticated(client: TestClient, db: Session) -> None:
    enable_realtime(db)
    try:
        with client.websocket_connect("/ws/room1"):
            pass
    except Exception:  # noqa: BLE001
        return
    raise AssertionError("expected the connection to be rejected")


def test_ping_pong(client: TestClient, db: Session) -> None:
    enable_realtime(db)
    login(client, db)
    with client.websocket_connect("/ws/room1") as ws:
        ws.send_json({"type": "ping"})
        data = ws.receive_json()
        assert data == {"type": "pong", "payload": {}}


def test_broadcast_to_same_room(client: TestClient, db: Session) -> None:
    enable_realtime(db)
    login(client, db, username="alice")
    with client.websocket_connect("/ws/room1") as ws_a:
        with client.websocket_connect("/ws/room1") as ws_b:
            ws_a.send_json({"type": "note", "payload": {"text": "hi"}})
            data = ws_b.receive_json()
            assert data == {"type": "note", "payload": {"text": "hi"}}


def test_broadcast_does_not_cross_rooms(client: TestClient, db: Session) -> None:
    enable_realtime(db)
    login(client, db, username="alice")
    with client.websocket_connect("/ws/room1") as ws_a:
        with client.websocket_connect("/ws/room2") as ws_b:
            ws_a.send_json({"type": "note", "payload": {"text": "hi"}})
            ws_a.send_json({"type": "ping"})
            # ws_a's own ping response proves the server is still alive and
            # processed the chat message without delivering it to room2.
            assert ws_a.receive_json() == {"type": "pong", "payload": {}}
            ws_b.send_json({"type": "ping"})
            assert ws_b.receive_json() == {"type": "pong", "payload": {}}


def test_invalid_envelope_is_ignored(client: TestClient, db: Session) -> None:
    enable_realtime(db)
    login(client, db)
    with client.websocket_connect("/ws/room1") as ws:
        ws.send_json({"nope": "no type field"})
        ws.send_json({"type": "ping"})
        assert ws.receive_json() == {"type": "pong", "payload": {}}
