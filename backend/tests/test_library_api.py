import json

import pytest
from sqlalchemy.orm import Session

from app.models import AppSetting

# World > Continent > Region > Location is the place hierarchy; Faction/Npc/
# Adversary/Environment hang directly off World. ENTITY_SEGMENTS covers every
# entity type the shared CRUD factory builds; KIND_SEGMENTS is the subset with `kind`.
ENTITY_SEGMENTS = [
    "continents",
    "regions",
    "locations",
    "factions",
    "npcs",
    "adversaries",
    "environments",
]
KIND_SEGMENTS = ["continents", "regions", "locations"]


def enable_library(db: Session) -> None:
    db.add(AppSetting(key="library_enabled", value=json.dumps(True)))
    db.commit()


def make_world(client, name: str = "Aetheris") -> int:
    resp = client.post("/api/library/worlds", json={"name": name})
    assert resp.status_code == 200
    return resp.json()["id"]


def make_continent(client, world_id: int, name: str = "Tharivor") -> int:
    resp = client.post(f"/api/library/worlds/{world_id}/continents", json={"name": name})
    assert resp.status_code == 200
    return resp.json()["id"]


def make_region(client, continent_id: int, name: str = "Hillford Valley") -> int:
    resp = client.post(f"/api/library/continents/{continent_id}/regions", json={"name": name})
    assert resp.status_code == 200
    return resp.json()["id"]


def build_chain(client, segment: str, world_id: int) -> tuple[str, str, int]:
    """Build whatever parent chain `segment` needs under `world_id`.

    Returns (collection_url, parent_field_name_in_response, parent_id).
    """
    if segment == "continents":
        return f"/api/library/worlds/{world_id}/continents", "world_id", world_id
    if segment == "regions":
        continent_id = make_continent(client, world_id)
        return f"/api/library/continents/{continent_id}/regions", "continent_id", continent_id
    if segment == "locations":
        continent_id = make_continent(client, world_id)
        region_id = make_region(client, continent_id)
        return f"/api/library/regions/{region_id}/locations", "region_id", region_id
    return f"/api/library/worlds/{world_id}/{segment}", "world_id", world_id


def missing_parent_url(segment: str) -> str:
    if segment == "continents":
        return "/api/library/worlds/999/continents"
    if segment == "regions":
        return "/api/library/continents/999/regions"
    if segment == "locations":
        return "/api/library/regions/999/locations"
    return f"/api/library/worlds/999/{segment}"


def test_disabled_flag_returns_404(as_user, db: Session) -> None:
    client = as_user("gm")
    resp = client.get("/api/library/worlds")
    assert resp.status_code == 404


def test_player_forbidden(as_user, db: Session) -> None:
    enable_library(db)
    resp = as_user("player").get("/api/library/worlds")
    assert resp.status_code == 403


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
    url, parent_field, parent_id = build_chain(client, segment, world_id)

    create_resp = client.post(
        url,
        json={"name": "Hillford", "summary": "A frontier town.", "extra": json.dumps({"a": 1})},
    )
    assert create_resp.status_code == 200
    assert create_resp.json()["name"] == "Hillford"
    assert create_resp.json()[parent_field] == parent_id

    list_resp = client.get(url)
    assert list_resp.status_code == 200
    assert [e["name"] for e in list_resp.json()] == ["Hillford"]


@pytest.mark.parametrize("segment", KIND_SEGMENTS)
def test_create_entity_with_kind(as_user, db: Session, segment: str) -> None:
    enable_library(db)
    client = as_user("gm")
    world_id = make_world(client)
    url, _, _ = build_chain(client, segment, world_id)

    create_resp = client.post(url, json={"name": "Hillford", "kind": "town"})
    assert create_resp.status_code == 200
    assert create_resp.json()["kind"] == "town"


@pytest.mark.parametrize("segment", ENTITY_SEGMENTS)
def test_create_entity_in_missing_parent_is_404(as_user, db: Session, segment: str) -> None:
    enable_library(db)
    client = as_user("gm")
    resp = client.post(missing_parent_url(segment), json={"name": "Ghost"})
    assert resp.status_code == 404


@pytest.mark.parametrize("segment", ENTITY_SEGMENTS)
def test_get_entity(as_user, db: Session, segment: str) -> None:
    enable_library(db)
    client = as_user("gm")
    world_id = make_world(client)
    url, _, _ = build_chain(client, segment, world_id)
    entity_id = client.post(url, json={"name": "Hillford"}).json()["id"]

    resp = client.get(f"{url}/{entity_id}")
    assert resp.status_code == 200
    assert resp.json()["name"] == "Hillford"


@pytest.mark.parametrize("segment", ENTITY_SEGMENTS)
def test_get_entity_from_wrong_parent_is_404(as_user, db: Session, segment: str) -> None:
    enable_library(db)
    client = as_user("gm")
    world_a = make_world(client, "Aetheris")
    world_b = make_world(client, "Elsewhere")
    url_a, _, _ = build_chain(client, segment, world_a)
    url_b, _, _ = build_chain(client, segment, world_b)
    entity_id = client.post(url_a, json={"name": "Hillford"}).json()["id"]

    resp = client.get(f"{url_b}/{entity_id}")
    assert resp.status_code == 404


@pytest.mark.parametrize("segment", ENTITY_SEGMENTS)
def test_update_entity(as_user, db: Session, segment: str) -> None:
    enable_library(db)
    client = as_user("gm")
    world_id = make_world(client)
    url, _, _ = build_chain(client, segment, world_id)
    entity_id = client.post(url, json={"name": "Original"}).json()["id"]

    resp = client.put(f"{url}/{entity_id}", json={"name": "Renamed"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "Renamed"


@pytest.mark.parametrize("segment", KIND_SEGMENTS)
def test_update_entity_kind(as_user, db: Session, segment: str) -> None:
    enable_library(db)
    client = as_user("gm")
    world_id = make_world(client)
    url, _, _ = build_chain(client, segment, world_id)
    entity_id = client.post(url, json={"name": "Original", "kind": "town"}).json()["id"]

    resp = client.put(f"{url}/{entity_id}", json={"kind": "ruin"})
    assert resp.status_code == 200
    assert resp.json()["kind"] == "ruin"


@pytest.mark.parametrize("segment", ENTITY_SEGMENTS)
def test_update_rejects_unknown_field(as_user, db: Session, segment: str) -> None:
    enable_library(db)
    client = as_user("gm")
    world_id = make_world(client)
    url, _, _ = build_chain(client, segment, world_id)
    entity_id = client.post(url, json={"name": "Original"}).json()["id"]

    resp = client.put(f"{url}/{entity_id}", json={"nope": "x"})
    assert resp.status_code == 422


@pytest.mark.parametrize("segment", ENTITY_SEGMENTS)
def test_delete_entity(as_user, db: Session, segment: str) -> None:
    enable_library(db)
    client = as_user("gm")
    world_id = make_world(client)
    url, _, _ = build_chain(client, segment, world_id)
    entity_id = client.post(url, json={"name": "Doomed"}).json()["id"]

    resp = client.delete(f"{url}/{entity_id}")
    assert resp.status_code == 204
    assert client.get(f"{url}/{entity_id}").status_code == 404


def test_full_hierarchy_end_to_end(as_user, db: Session) -> None:
    enable_library(db)
    client = as_user("gm")
    world_id = make_world(client, "Aetheris")

    continent_id = client.post(
        f"/api/library/worlds/{world_id}/continents",
        json={"name": "Tharivor", "kind": "primary continent"},
    ).json()["id"]
    region_id = client.post(
        f"/api/library/continents/{continent_id}/regions",
        json={"name": "Hillford Valley", "kind": "river valley"},
    ).json()["id"]
    location_resp = client.post(
        f"/api/library/regions/{region_id}/locations",
        json={"name": "Hillford", "kind": "town"},
    )
    assert location_resp.status_code == 200
    location = location_resp.json()
    assert location["name"] == "Hillford"
    assert location["kind"] == "town"
    assert location["region_id"] == region_id

    regions = client.get(f"/api/library/continents/{continent_id}/regions").json()
    assert [r["name"] for r in regions] == ["Hillford Valley"]

    locations = client.get(f"/api/library/regions/{region_id}/locations").json()
    assert [loc["name"] for loc in locations] == ["Hillford"]
