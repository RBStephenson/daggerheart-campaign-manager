"""Tests for GM-authored custom-content CRUD (DHCM-28)."""

import json

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import AppSetting


def _enable(db: Session) -> None:
    db.add(AppSetting(key="custom_content_enabled", value=json.dumps(True)))
    db.commit()


def test_returns_404_when_flag_off(as_user) -> None:
    client = as_user("gm")
    assert client.get("/api/custom-content/weapons").status_code == 404


def test_requires_auth_when_flag_on(client: TestClient, db: Session) -> None:
    _enable(db)
    assert client.get("/api/custom-content/weapons").status_code == 401


def test_requires_gm_role_when_flag_on(as_user, db: Session) -> None:
    _enable(db)
    resp = as_user("player").get("/api/custom-content/weapons")
    assert resp.status_code == 403


def test_weapon_crud_round_trip(as_user, db: Session) -> None:
    _enable(db)
    gm = as_user("gm")

    create = gm.post(
        "/api/custom-content/weapons",
        json={
            "name": "Sunfang",
            "trait": "Finesse",
            "range": "Melee",
            "damage": "d8+3",
            "burden": "One-Handed",
            "is_magic": True,
            "feature": "Glows in dim light.",
        },
    )
    assert create.status_code == 200
    weapon_id = create.json()["id"]

    listed = gm.get("/api/custom-content/weapons")
    assert listed.status_code == 200
    assert len(listed.json()) == 1
    assert listed.json()[0]["name"] == "Sunfang"

    fetched = gm.get(f"/api/custom-content/weapons/{weapon_id}")
    assert fetched.status_code == 200
    assert fetched.json()["damage"] == "d8+3"

    updated = gm.put(f"/api/custom-content/weapons/{weapon_id}", json={"damage": "d10+3"})
    assert updated.status_code == 200
    assert updated.json()["damage"] == "d10+3"
    assert updated.json()["name"] == "Sunfang"

    deleted = gm.delete(f"/api/custom-content/weapons/{weapon_id}")
    assert deleted.status_code == 204
    assert gm.get(f"/api/custom-content/weapons/{weapon_id}").status_code == 404


def test_get_missing_entity_404s(as_user, db: Session) -> None:
    _enable(db)
    resp = as_user("gm").get("/api/custom-content/armor/999")
    assert resp.status_code == 404


def test_ancestry_defaults_apply_when_omitted(as_user, db: Session) -> None:
    _enable(db)
    gm = as_user("gm")
    resp = gm.post("/api/custom-content/ancestries", json={"name": "Duskkin"})
    assert resp.status_code == 200
    assert resp.json()["features_json"] == "[]"


def test_domain_card_crud(as_user, db: Session) -> None:
    _enable(db)
    gm = as_user("gm")
    create = gm.post(
        "/api/custom-content/domain-cards",
        json={"domain": "Arcana", "name": "Ember Sigil", "type": "Spell", "recall_cost": 2},
    )
    assert create.status_code == 200
    card_id = create.json()["id"]

    updated = gm.put(f"/api/custom-content/domain-cards/{card_id}", json={"recall_cost": 3})
    assert updated.status_code == 200
    assert updated.json()["recall_cost"] == 3


def test_duplicate_name_on_create_returns_409(as_user, db: Session) -> None:
    _enable(db)
    gm = as_user("gm")
    body = {
        "name": "Sunfang",
        "trait": "Finesse",
        "range": "Melee",
        "damage": "d8+3",
        "burden": "One-Handed",
        "is_magic": True,
        "feature": "Glows in dim light.",
    }
    assert gm.post("/api/custom-content/weapons", json=body).status_code == 200
    dupe = gm.post("/api/custom-content/weapons", json=body)
    assert dupe.status_code == 409


def test_duplicate_name_on_update_returns_409(as_user, db: Session) -> None:
    _enable(db)
    gm = as_user("gm")
    gm.post("/api/custom-content/ancestries", json={"name": "Duskkin"})
    second = gm.post("/api/custom-content/ancestries", json={"name": "Stonekin"})
    second_id = second.json()["id"]

    dupe = gm.put(f"/api/custom-content/ancestries/{second_id}", json={"name": "Duskkin"})
    assert dupe.status_code == 409


def test_duplicate_domain_and_name_on_create_returns_409(as_user, db: Session) -> None:
    _enable(db)
    gm = as_user("gm")
    body = {"domain": "Arcana", "name": "Ember Sigil", "type": "Spell", "recall_cost": 2}
    assert gm.post("/api/custom-content/domain-cards", json=body).status_code == 200
    dupe = gm.post("/api/custom-content/domain-cards", json=body)
    assert dupe.status_code == 409


def test_all_seven_segments_reachable(as_user, db: Session) -> None:
    _enable(db)
    gm = as_user("gm")
    for segment in (
        "classes",
        "ancestries",
        "communities",
        "domains",
        "domain-cards",
        "weapons",
        "armor",
    ):
        resp = gm.get(f"/api/custom-content/{segment}")
        assert resp.status_code == 200, segment
        assert resp.json() == []
