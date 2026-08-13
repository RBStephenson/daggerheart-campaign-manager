"""Tests for the read-only GM-moves reference endpoint."""

import json

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import AppSetting


def _enable(db: Session) -> None:
    db.add(AppSetting(key="combat_tools_enabled", value=json.dumps(True)))
    db.commit()


def test_returns_404_when_flag_off(as_user) -> None:
    client = as_user("gm")
    assert client.get("/api/gm-moves/").status_code == 404


def test_requires_auth_when_flag_on(client: TestClient, db: Session) -> None:
    _enable(db)
    assert client.get("/api/gm-moves/").status_code == 401


def test_requires_gm_role_when_flag_on(as_user, db: Session) -> None:
    _enable(db)
    resp = as_user("player").get("/api/gm-moves/")
    assert resp.status_code == 403


def test_returns_dataset_when_enabled(as_user, db: Session) -> None:
    _enable(db)
    resp = as_user("gm").get("/api/gm-moves/")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["moves"]) == 16
    assert len(data["when_to_move"]) == 5
    assert "soft" in data["soft_vs_hard"]
    assert "hard" in data["soft_vs_hard"]
