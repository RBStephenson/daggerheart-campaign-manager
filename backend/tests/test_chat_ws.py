import json

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import AppSetting, ChatMessage
from tests.conftest import make_user


def enable(db: Session, key: str) -> None:
    db.add(AppSetting(key=key, value=json.dumps(True)))
    db.commit()


def login(client: TestClient, db: Session, *, username: str = "alice") -> None:
    make_user(db, username=username, role="player", password="s3cret-pass")
    resp = client.post("/api/auth/login", json={"username": username, "password": "s3cret-pass"})
    assert resp.status_code == 200


def test_chat_message_is_ignored_when_disabled(client: TestClient, db: Session) -> None:
    enable(db, "realtime_enabled")
    login(client, db)
    with client.websocket_connect("/ws/room1") as ws:
        ws.send_json({"type": "chat", "payload": {"body": "hello"}})
        ws.send_json({"type": "ping"})
        assert ws.receive_json() == {"type": "pong", "payload": {}}
    assert db.query(ChatMessage).count() == 0


def test_chat_message_persisted_and_broadcast_to_sender(
    client: TestClient, db: Session
) -> None:
    enable(db, "realtime_enabled")
    enable(db, "chat_enabled")
    login(client, db, username="alice")
    with client.websocket_connect("/ws/room1") as ws:
        ws.send_json({"type": "chat", "payload": {"body": "hello"}})
        data = ws.receive_json()

    assert data["type"] == "chat"
    assert data["payload"]["body"] == "hello"
    assert data["payload"]["author_username"] == "alice"
    assert db.query(ChatMessage).count() == 1


def test_chat_message_broadcast_to_other_room_members(client: TestClient, db: Session) -> None:
    enable(db, "realtime_enabled")
    enable(db, "chat_enabled")
    login(client, db, username="alice")
    with client.websocket_connect("/ws/room1") as ws_a:
        with client.websocket_connect("/ws/room1") as ws_b:
            ws_a.send_json({"type": "chat", "payload": {"body": "hi there"}})
            a_msg = ws_a.receive_json()
            b_msg = ws_b.receive_json()
    assert a_msg == b_msg
    assert a_msg["payload"]["body"] == "hi there"


def test_empty_chat_body_is_ignored(client: TestClient, db: Session) -> None:
    enable(db, "realtime_enabled")
    enable(db, "chat_enabled")
    login(client, db)
    with client.websocket_connect("/ws/room1") as ws:
        ws.send_json({"type": "chat", "payload": {"body": ""}})
        ws.send_json({"type": "ping"})
        assert ws.receive_json() == {"type": "pong", "payload": {}}
    assert db.query(ChatMessage).count() == 0
