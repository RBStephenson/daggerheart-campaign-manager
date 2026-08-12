"""Tests for the GM quick-generate endpoint."""

import json

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import AppSetting


def _enable(db: Session) -> None:
    db.add(AppSetting(key="generators_enabled", value=json.dumps(True)))
    db.commit()


def test_returns_404_when_flag_off(as_user) -> None:
    client = as_user("gm")
    assert client.get("/api/gm/generate/name").status_code == 404


def test_requires_auth_when_flag_on(client: TestClient, db: Session) -> None:
    _enable(db)
    assert client.get("/api/gm/generate/name").status_code == 401


def test_requires_gm_role_when_flag_on(as_user, db: Session) -> None:
    _enable(db)
    resp = as_user("player").get("/api/gm/generate/name")
    assert resp.status_code == 403


def test_generate_name(as_user, db: Session) -> None:
    _enable(db)
    resp = as_user("gm").get("/api/gm/generate/name")
    assert resp.status_code == 200
    data = resp.json()
    assert data["kind"] == "name"
    assert data["name"]


def test_generate_name_with_valid_ancestry(as_user, db: Session) -> None:
    _enable(db)
    resp = as_user("gm").get("/api/gm/generate/name", params={"ancestry": "Elf"})
    assert resp.status_code == 200
    assert resp.json()["ancestry"] == "Elf"


def test_generate_name_with_invalid_ancestry_falls_back_to_none(as_user, db: Session) -> None:
    _enable(db)
    resp = as_user("gm").get("/api/gm/generate/name", params={"ancestry": "Not A Real Ancestry"})
    assert resp.status_code == 200
    assert resp.json()["ancestry"] is None


def test_generate_npc(as_user, db: Session) -> None:
    _enable(db)
    resp = as_user("gm").get("/api/gm/generate/npc")
    assert resp.status_code == 200
    data = resp.json()
    assert data["kind"] == "npc"
    assert data["name"] and data["role"] and data["motivation"] and data["quirk"]


def test_generate_loot(as_user, db: Session) -> None:
    _enable(db)
    resp = as_user("gm").get("/api/gm/generate/loot", params={"party_tier": 2})
    assert resp.status_code == 200
    data = resp.json()
    assert data["kind"] == "loot"
    assert data["name"] and data["description"]


def test_invalid_kind_returns_422(as_user, db: Session) -> None:
    _enable(db)
    resp = as_user("gm").get("/api/gm/generate/nonsense")
    assert resp.status_code == 422
