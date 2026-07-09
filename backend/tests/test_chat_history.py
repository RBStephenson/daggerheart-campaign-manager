import json
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.models import AppSetting, ChatMessage
from tests.conftest import make_user


def enable_chat(db: Session) -> None:
    db.add(AppSetting(key="chat_enabled", value=json.dumps(True)))
    db.commit()


def add_message(db: Session, *, room: str, author_id: int, body: str) -> ChatMessage:
    message = ChatMessage(
        room=room, author_user_id=author_id, body=body, created_at=datetime.now(UTC)
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return message


def test_disabled_flag_returns_404(as_user, db: Session) -> None:
    client = as_user("player")
    resp = client.get("/api/chat/room1/messages")
    assert resp.status_code == 404


def test_requires_auth(client, db: Session) -> None:
    enable_chat(db)
    resp = client.get("/api/chat/room1/messages")
    assert resp.status_code == 401


def test_empty_history(as_user, db: Session) -> None:
    enable_chat(db)
    client = as_user("player")
    resp = client.get("/api/chat/room1/messages")
    assert resp.status_code == 200
    assert resp.json() == []


def test_history_returned_chronologically(as_user, db: Session) -> None:
    enable_chat(db)
    author = make_user(db, username="alice", role="player")
    add_message(db, room="room1", author_id=author.id, body="first")
    add_message(db, room="room1", author_id=author.id, body="second")

    client = as_user("host")
    resp = client.get("/api/chat/room1/messages")
    assert resp.status_code == 200
    bodies = [m["body"] for m in resp.json()]
    assert bodies == ["first", "second"]
    assert resp.json()[0]["author_username"] == "alice"


def test_history_scoped_to_room(as_user, db: Session) -> None:
    enable_chat(db)
    author = make_user(db, username="alice", role="player")
    add_message(db, room="room1", author_id=author.id, body="in room1")
    add_message(db, room="room2", author_id=author.id, body="in room2")

    client = as_user("host")
    resp = client.get("/api/chat/room1/messages")
    assert [m["body"] for m in resp.json()] == ["in room1"]


def test_history_before_pagination(as_user, db: Session) -> None:
    enable_chat(db)
    author = make_user(db, username="alice", role="player")
    add_message(db, room="room1", author_id=author.id, body="first")
    add_message(db, room="room1", author_id=author.id, body="second")
    third = add_message(db, room="room1", author_id=author.id, body="third")

    client = as_user("host")
    resp = client.get(f"/api/chat/room1/messages?before={third.id}")
    assert [m["body"] for m in resp.json()] == ["first", "second"]
