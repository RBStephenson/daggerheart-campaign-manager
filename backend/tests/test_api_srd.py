"""Tests for the read-only SRD reference endpoint."""

import json
from datetime import UTC, datetime

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import AppSetting, CustomWeapon


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
    assert len(data["domain_cards"]) == 189
    assert len([c for c in data["domain_cards"] if c["level"] == 1]) == 27
    assert len(data["primary_weapons"]) == 155
    assert len([w for w in data["primary_weapons"] if w["tier"] == 1]) == 25
    assert len(data["secondary_weapons"]) == 37
    assert len(data["armor"]) == 34
    assert len([a for a in data["armor"] if a["tier"] == 1]) == 4
    assert len(data["combat_wheelchair"]) == 12
    assert len(data["beastform_options"]) == 24
    assert len(data["loot"]) == 60
    assert len(data["consumables"]) == 60


def test_includes_custom_weapon_tagged_as_custom_source(as_user, db: Session) -> None:
    _enable(db)
    db.add(
        CustomWeapon(
            name="Storm Lance",
            trait="Strength",
            range="Melee",
            damage="d10 phy",
            burden="Two-Handed",
            is_magic=False,
            feature=None,
            created_at=datetime.now(UTC),
        )
    )
    db.commit()
    resp = as_user("player").get("/api/srd/character-creation")
    assert resp.status_code == 200
    data = resp.json()
    custom = next(w for w in data["primary_weapons"] if w["name"] == "Storm Lance")
    assert custom["source"] == "custom"
    assert custom["tier"] == 1
    srd_weapon = next(w for w in data["primary_weapons"] if w["name"] != "Storm Lance")
    assert "source" not in srd_weapon
