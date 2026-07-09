"""Tests for the read-only SRD reference endpoint."""

import json

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import AppSetting


def _enable(db: Session) -> None:
    db.add(AppSetting(key="character_creation_enabled", value=json.dumps(True)))
    db.commit()


def test_returns_404_when_flag_off(as_user) -> None:
    client = as_user("player")
    assert client.get("/api/srd/character-creation").status_code == 404


def test_requires_auth_when_flag_on(client: TestClient, db: Session) -> None:
    _enable(db)
    # No authenticated user (raw client) — the flag gate passes, auth fails.
    assert client.get("/api/srd/character-creation").status_code == 401


def test_returns_dataset_when_enabled(as_user, db: Session) -> None:
    _enable(db)
    resp = as_user("player").get("/api/srd/character-creation")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["classes"]) == 9
    assert data["trait_array"] == [2, 1, 1, 0, 0, -1]
    assert len(data["domain_cards_l1"]) == 27
