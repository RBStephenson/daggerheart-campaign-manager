import json

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import AppSetting
from app.routers import settings as settings_router


def test_read_settings_requires_auth(client: TestClient) -> None:
    resp = client.get("/api/settings")
    assert resp.status_code == 401


def test_read_settings_forbidden_for_non_host(as_user) -> None:
    client = as_user("player")
    resp = client.get("/api/settings")
    assert resp.status_code == 403


def test_read_settings_returns_defaults(as_user) -> None:
    client = as_user("host")
    resp = client.get("/api/settings")
    assert resp.status_code == 200
    assert resp.json() == settings_router.DEFAULTS


def test_update_rejects_unknown_key(as_user) -> None:
    client = as_user("host")
    resp = client.put("/api/settings", json={"nonexistent_flag": True})
    assert resp.status_code == 422
    assert "nonexistent_flag" in resp.json()["detail"]


def test_stored_value_overrides_default(as_user, db: Session, monkeypatch) -> None:
    monkeypatch.setitem(settings_router.DEFAULTS, "demo_enabled", False)
    db.add(AppSetting(key="demo_enabled", value=json.dumps(True)))
    db.commit()
    client = as_user("host")
    resp = client.get("/api/settings")
    assert resp.json()["demo_enabled"] is True


def test_update_persists_known_key(as_user, db: Session, monkeypatch) -> None:
    monkeypatch.setitem(settings_router.DEFAULTS, "demo_enabled", False)
    client = as_user("host")
    resp = client.put("/api/settings", json={"demo_enabled": True})
    assert resp.status_code == 200
    assert resp.json()["demo_enabled"] is True
    row = db.get(AppSetting, "demo_enabled")
    assert row is not None
    assert json.loads(row.value) is True


def test_unknown_stored_key_ignored_on_read(as_user, db: Session) -> None:
    db.add(AppSetting(key="retired_flag", value=json.dumps(True)))
    db.commit()
    client = as_user("host")
    resp = client.get("/api/settings")
    assert "retired_flag" not in resp.json()
