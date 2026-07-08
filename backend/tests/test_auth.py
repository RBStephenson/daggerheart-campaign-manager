from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.deps import get_current_user
from app.models import Invite
from tests.conftest import make_user


def test_me_unauthenticated_returns_null(client: TestClient) -> None:
    resp = client.get("/api/auth/me")
    assert resp.status_code == 200
    assert resp.json() is None


def test_login_success_sets_cookie_and_returns_user(client: TestClient, db: Session) -> None:
    make_user(db, username="alice", role="host", password="s3cret-pass")
    resp = client.post("/api/auth/login", json={"username": "alice", "password": "s3cret-pass"})
    assert resp.status_code == 200
    assert resp.json()["username"] == "alice"
    assert "dhcm_session" in resp.cookies


def test_login_wrong_password_rejected(client: TestClient, db: Session) -> None:
    make_user(db, username="alice", role="host", password="s3cret-pass")
    resp = client.post("/api/auth/login", json={"username": "alice", "password": "wrong"})
    assert resp.status_code == 401


def test_login_unknown_user_rejected(client: TestClient) -> None:
    resp = client.post("/api/auth/login", json={"username": "ghost", "password": "x"})
    assert resp.status_code == 401


def test_me_after_login_returns_user(client: TestClient, db: Session) -> None:
    make_user(db, username="alice", role="gm", password="s3cret-pass")
    client.post("/api/auth/login", json={"username": "alice", "password": "s3cret-pass"})
    resp = client.get("/api/auth/me")
    assert resp.status_code == 200
    assert resp.json()["role"] == "gm"


def test_logout_clears_session(client: TestClient, db: Session) -> None:
    make_user(db, username="alice", role="host", password="s3cret-pass")
    client.post("/api/auth/login", json={"username": "alice", "password": "s3cret-pass"})
    client.post("/api/auth/logout")
    resp = client.get("/api/auth/me")
    assert resp.json() is None


def test_create_invite_requires_host_or_gm(as_user) -> None:
    client = as_user("player")
    resp = client.post("/api/auth/invites", json={"role": "player"})
    assert resp.status_code == 403


def test_gm_can_only_invite_players(as_user) -> None:
    client = as_user("gm")
    resp = client.post("/api/auth/invites", json={"role": "gm"})
    assert resp.status_code == 403


def test_host_can_invite_any_role(as_user) -> None:
    client = as_user("host")
    resp = client.post("/api/auth/invites", json={"role": "gm"})
    assert resp.status_code == 200
    assert resp.json()["role"] == "gm"


def test_register_with_valid_invite_creates_user_with_invite_role(
    as_user, db: Session
) -> None:
    client = as_user("host")
    invite_resp = client.post("/api/auth/invites", json={"role": "player"})
    token = invite_resp.json()["token"]

    # register uses a fresh (unauthenticated) request
    client.app.dependency_overrides.pop(get_current_user, None)
    resp = client.post(
        "/api/auth/register",
        json={"token": token, "username": "newplayer", "password": "long-enough-pw"},
    )
    assert resp.status_code == 200
    assert resp.json()["role"] == "player"

    invite = db.query(Invite).filter_by(token=token).one()
    assert invite.used_at is not None


def test_register_rejects_reused_invite(as_user) -> None:
    client = as_user("host")
    invite_resp = client.post("/api/auth/invites", json={"role": "player"})
    token = invite_resp.json()["token"]

    first = client.post(
        "/api/auth/register",
        json={"token": token, "username": "player1", "password": "long-enough-pw"},
    )
    assert first.status_code == 200

    second = client.post(
        "/api/auth/register",
        json={"token": token, "username": "player2", "password": "long-enough-pw"},
    )
    assert second.status_code == 400


def test_register_rejects_taken_username(as_user, db: Session) -> None:
    make_user(db, username="taken", role="player")
    client = as_user("host")
    invite_resp = client.post("/api/auth/invites", json={"role": "player"})
    token = invite_resp.json()["token"]

    resp = client.post(
        "/api/auth/register",
        json={"token": token, "username": "taken", "password": "long-enough-pw"},
    )
    assert resp.status_code == 409
