"""Tests for /api/database — backup/health/repair/restore/reset.

Unlike most routers, these operate on a real SQLite file (not the shared
in-memory `db`/`client` fixtures from conftest.py), so this module defines
its own file-backed fixtures and monkeypatches `app.db` + `app.routers.database`
to point at a temp DB file per test.
"""

import io
from datetime import UTC, datetime
from pathlib import Path

import pytest
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.db as db_module
from alembic import command
from app.deps import get_current_user
from app.main import create_app
from app.models import User
from app.routers import database as database_router
from app.security import hash_password

BACKEND_DIR = Path(__file__).resolve().parents[1]


@pytest.fixture()
def file_db(tmp_path, monkeypatch):
    db_path = tmp_path / "test.sqlite3"
    db_url = f"sqlite:///{db_path}"
    engine = create_engine(db_url, connect_args={"check_same_thread": False})

    monkeypatch.setattr(db_module, "DATABASE_URL", db_url)
    monkeypatch.setattr(db_module, "engine", engine)
    monkeypatch.setattr(database_router, "DATABASE_URL", db_url)
    monkeypatch.setattr(database_router, "engine", engine)

    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    command.upgrade(cfg, "head")

    yield db_path, engine


@pytest.fixture()
def db_session(file_db):
    _, engine = file_db
    Session = sessionmaker(bind=engine, expire_on_commit=False)
    session = Session()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(file_db, db_session):
    app = create_app()
    app.dependency_overrides[db_module.get_db] = lambda: db_session
    with TestClient(app) as c:
        yield c


def make_user(db, *, username: str, role: str) -> User:
    user = User(
        username=username,
        password_hash=hash_password("correct-horse"),
        role=role,
        created_at=datetime.now(UTC),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture()
def as_user(client, db_session):
    def _as_user(role: str, *, username: str = "test-user"):
        user = make_user(db_session, username=username, role=role)
        client.app.dependency_overrides[get_current_user] = lambda: user
        return client

    return _as_user


def _enable_flag(client) -> None:
    resp = client.put("/api/settings", json={"data_management_enabled": True})
    assert resp.status_code == 200


def test_endpoints_404_when_flag_off(as_user) -> None:
    client = as_user("host")
    assert client.get("/api/database/backup").status_code == 404
    assert client.get("/api/database/health").status_code == 404
    assert client.post("/api/database/repair").status_code == 404
    assert client.post("/api/database/reset").status_code == 404
    assert (
        client.post(
            "/api/database/restore",
            files={"file": ("x.db", io.BytesIO(b"junk"), "application/octet-stream")},
        ).status_code
        == 404
    )


def test_endpoints_forbidden_for_non_host(as_user) -> None:
    client = as_user("host")
    _enable_flag(client)
    gm_client = as_user("gm", username="gm-user")
    assert gm_client.get("/api/database/health").status_code == 403


def test_backup_returns_db_file(as_user) -> None:
    client = as_user("host")
    _enable_flag(client)
    resp = client.get("/api/database/backup")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/octet-stream"
    assert len(resp.content) > 0


def test_health_reports_ok_on_fresh_db(as_user) -> None:
    client = as_user("host")
    _enable_flag(client)
    resp = client.get("/api/database/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["status"] == "healthy"


def test_repair_is_noop_on_healthy_db(as_user) -> None:
    client = as_user("host")
    _enable_flag(client)
    resp = client.post("/api/database/repair")
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["repaired"] is False
    assert body["snapshot"] is not None


def test_restore_rejects_invalid_file(as_user) -> None:
    client = as_user("host")
    _enable_flag(client)
    resp = client.post(
        "/api/database/restore",
        files={"file": ("bad.db", io.BytesIO(b"not a sqlite file"), "application/octet-stream")},
    )
    assert resp.status_code == 400


def test_restore_accepts_valid_backup_of_itself(as_user) -> None:
    client = as_user("host")
    _enable_flag(client)
    backup_bytes = client.get("/api/database/backup").content
    resp = client.post(
        "/api/database/restore",
        files={"file": ("backup.db", io.BytesIO(backup_bytes), "application/octet-stream")},
    )
    assert resp.status_code == 200
    assert resp.json()["ok"] is True


def test_reset_wipes_all_data(as_user, db_session) -> None:
    client = as_user("host")
    _enable_flag(client)
    make_user(db_session, username="throwaway", role="player")

    resp = client.post("/api/database/reset")
    assert resp.status_code == 200
    assert resp.json()["ok"] is True

    # Reset re-runs migrations to an empty schema — settings and users are gone.
    health = client.get("/api/database/health")
    assert health.status_code == 404  # flag reset to default (off) too
