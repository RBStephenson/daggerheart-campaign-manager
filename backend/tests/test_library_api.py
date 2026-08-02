import json

import pytest
from sqlalchemy.orm import Session

from app.models import AppSetting

ENTITY_SEGMENTS = ["regions", "factions", "npcs", "adversaries"]


def enable_library(db: Session) -> None:
    db.add(AppSetting(key="library_enabled", value=json.dumps(True)))
    db.commit()


def make_world(client, name: str = "Aetheris") -> int:
    resp = client.post("/api/library/worlds", json={"name": name})
    assert resp.status_code == 200
    return resp.json()["id"]


def test_disabled_flag_returns_404(as_user, db: Session) -> None:
    client = as_user("gm")
    resp = client.get("/api/library/worlds")
    assert resp.status_code == 404


def test_player_forbidden(as_user, db: Session) -> None:
    enable_library(db)
    resp = as_user("player").get("/api/library/worlds")
    assert resp.status_code == 403


def test_host_has_superuser_access(as_user, db: Session) -> None:
    enable_library(db)
    client = as_user("host")
    world_id = make_world(client)
    resp = client.get("/api/library/worlds")
    assert resp.status_code == 200
    assert [w["id"] for w in resp.json()] == [world_id]


def test_create_and_list_world(as_user, db: Session) -> None:
    enable_library(db)
    client = as_user("gm")
    make_world(client, "Aetheris")

    resp = client.get("/api/library/worlds")
    assert resp.status_code == 200
    assert [w["name"] for w in resp.json()] == ["Aetheris"]


def test_get_world(as_user, db: Session) -> None:
    enable_library(db)
    client = as_user("gm")
    world_id = make_world(client)

    resp = client.get(f"/api/library/worlds/{world_id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == world_id


def test_get_missing_world_is_404(as_user, db: Session) -> None:
    enable_library(db)
    client = as_user("gm")
    resp = client.get("/api/library/worlds/999")
    assert resp.status_code == 404


@pytest.mark.parametrize("segment", ENTITY_SEGMENTS)
def test_create_and_list_entity(as_user, db: Session, segment: str) -> None:
    enable_library(db)
    client = as_user("gm")
    world_id = make_world(client)

    create_resp = client.post(
        f"/api/library/worlds/{world_id}/{segment}",
        json={"name": "Hillford", "summary": "A frontier town.", "extra": json.dumps({"a": 1})},
    )
    assert create_resp.status_code == 200
    assert create_resp.json()["name"] == "Hillford"
    assert create_resp.json()["world_id"] == world_id

    list_resp = client.get(f"/api/library/worlds/{world_id}/{segment}")
    assert list_resp.status_code == 200
    assert [e["name"] for e in list_resp.json()] == ["Hillford"]


@pytest.mark.parametrize("segment", ENTITY_SEGMENTS)
def test_create_entity_in_missing_world_is_404(as_user, db: Session, segment: str) -> None:
    enable_library(db)
    client = as_user("gm")
    resp = client.post(f"/api/library/worlds/999/{segment}", json={"name": "Ghost"})
    assert resp.status_code == 404


@pytest.mark.parametrize("segment", ENTITY_SEGMENTS)
def test_get_entity(as_user, db: Session, segment: str) -> None:
    enable_library(db)
    client = as_user("gm")
    world_id = make_world(client)
    entity_id = client.post(
        f"/api/library/worlds/{world_id}/{segment}", json={"name": "Hillford"}
    ).json()["id"]

    resp = client.get(f"/api/library/worlds/{world_id}/{segment}/{entity_id}")
    assert resp.status_code == 200
    assert resp.json()["name"] == "Hillford"


@pytest.mark.parametrize("segment", ENTITY_SEGMENTS)
def test_get_entity_from_wrong_world_is_404(as_user, db: Session, segment: str) -> None:
    enable_library(db)
    client = as_user("gm")
    world_a = make_world(client, "Aetheris")
    world_b = make_world(client, "Elsewhere")
    entity_id = client.post(
        f"/api/library/worlds/{world_a}/{segment}", json={"name": "Hillford"}
    ).json()["id"]

    resp = client.get(f"/api/library/worlds/{world_b}/{segment}/{entity_id}")
    assert resp.status_code == 404


@pytest.mark.parametrize("segment", ENTITY_SEGMENTS)
def test_update_entity(as_user, db: Session, segment: str) -> None:
    enable_library(db)
    client = as_user("gm")
    world_id = make_world(client)
    entity_id = client.post(
        f"/api/library/worlds/{world_id}/{segment}", json={"name": "Original"}
    ).json()["id"]

    resp = client.put(
        f"/api/library/worlds/{world_id}/{segment}/{entity_id}", json={"name": "Renamed"}
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Renamed"


@pytest.mark.parametrize("segment", ENTITY_SEGMENTS)
def test_update_rejects_unknown_field(as_user, db: Session, segment: str) -> None:
    enable_library(db)
    client = as_user("gm")
    world_id = make_world(client)
    entity_id = client.post(
        f"/api/library/worlds/{world_id}/{segment}", json={"name": "Original"}
    ).json()["id"]

    resp = client.put(f"/api/library/worlds/{world_id}/{segment}/{entity_id}", json={"nope": "x"})
    assert resp.status_code == 422


@pytest.mark.parametrize("segment", ENTITY_SEGMENTS)
def test_delete_entity(as_user, db: Session, segment: str) -> None:
    enable_library(db)
    client = as_user("gm")
    world_id = make_world(client)
    entity_id = client.post(
        f"/api/library/worlds/{world_id}/{segment}", json={"name": "Doomed"}
    ).json()["id"]

    resp = client.delete(f"/api/library/worlds/{world_id}/{segment}/{entity_id}")
    assert resp.status_code == 204
    assert client.get(f"/api/library/worlds/{world_id}/{segment}/{entity_id}").status_code == 404


def test_entities_are_scoped_to_their_world(as_user, db: Session) -> None:
    enable_library(db)
    client = as_user("gm")
    world_a = make_world(client, "Aetheris")
    world_b = make_world(client, "Elsewhere")
    client.post(f"/api/library/worlds/{world_a}/regions", json={"name": "Hillford"})
    client.post(f"/api/library/worlds/{world_b}/regions", json={"name": "Somewhere Else"})

    resp = client.get(f"/api/library/worlds/{world_a}/regions")
    assert [r["name"] for r in resp.json()] == ["Hillford"]
