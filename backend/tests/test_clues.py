import json

from sqlalchemy.orm import Session

from app.models import AppSetting


def enable_library(db: Session) -> None:
    db.add(AppSetting(key="library_enabled", value=json.dumps(True)))
    db.commit()


def make_world(client, name: str = "Aetheris") -> int:
    resp = client.post("/api/library/worlds", json={"name": name})
    assert resp.status_code == 200
    return resp.json()["id"]


def make_npc(client, world_id: int, name: str = "Old Marrow") -> int:
    resp = client.post(f"/api/library/worlds/{world_id}/npcs", json={"name": name})
    assert resp.status_code == 200
    return resp.json()["id"]


def test_create_and_list_clue(as_user, db: Session) -> None:
    enable_library(db)
    client = as_user("gm")
    world_id = make_world(client)

    resp = client.post(
        f"/api/library/worlds/{world_id}/clues",
        json={
            "text": "Bloodstained ledger in the cellar",
            "revelation": "The steward is the thief",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["text"] == "Bloodstained ledger in the cellar"
    assert body["revelation"] == "The steward is the thief"
    assert body["entity_type"] is None
    assert body["entity_id"] is None

    resp = client.get(f"/api/library/worlds/{world_id}/clues")
    assert resp.status_code == 200
    assert [c["id"] for c in resp.json()] == [body["id"]]


def test_create_clue_with_missing_parent_world_is_404(as_user, db: Session) -> None:
    enable_library(db)
    client = as_user("gm")
    resp = client.post("/api/library/worlds/999/clues", json={"text": "..."})
    assert resp.status_code == 404


def test_create_clue_attached_to_entity(as_user, db: Session) -> None:
    enable_library(db)
    client = as_user("gm")
    world_id = make_world(client)
    npc_id = make_npc(client, world_id)

    resp = client.post(
        f"/api/library/worlds/{world_id}/clues",
        json={"text": "Torn letter", "entity_type": "npc", "entity_id": npc_id},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["entity_type"] == "npc"
    assert body["entity_id"] == npc_id


def test_create_clue_with_unknown_entity_type_is_400(as_user, db: Session) -> None:
    enable_library(db)
    client = as_user("gm")
    world_id = make_world(client)

    resp = client.post(
        f"/api/library/worlds/{world_id}/clues",
        json={"text": "Torn letter", "entity_type": "dragon", "entity_id": 1},
    )
    assert resp.status_code == 400


def test_create_clue_with_missing_entity_is_404(as_user, db: Session) -> None:
    enable_library(db)
    client = as_user("gm")
    world_id = make_world(client)

    resp = client.post(
        f"/api/library/worlds/{world_id}/clues",
        json={"text": "Torn letter", "entity_type": "npc", "entity_id": 999},
    )
    assert resp.status_code == 404


def test_create_clue_with_only_one_of_entity_type_or_id_is_400(as_user, db: Session) -> None:
    enable_library(db)
    client = as_user("gm")
    world_id = make_world(client)

    resp = client.post(
        f"/api/library/worlds/{world_id}/clues",
        json={"text": "Torn letter", "entity_type": "npc"},
    )
    assert resp.status_code == 400


def test_get_clue_from_wrong_world_is_404(as_user, db: Session) -> None:
    enable_library(db)
    client = as_user("gm")
    world_id = make_world(client)
    other_world_id = make_world(client, "Other")
    resp = client.post(f"/api/library/worlds/{world_id}/clues", json={"text": "..."})
    clue_id = resp.json()["id"]

    resp = client.get(f"/api/library/worlds/{other_world_id}/clues/{clue_id}")
    assert resp.status_code == 404


def test_update_clue(as_user, db: Session) -> None:
    enable_library(db)
    client = as_user("gm")
    world_id = make_world(client)
    resp = client.post(f"/api/library/worlds/{world_id}/clues", json={"text": "First draft"})
    clue_id = resp.json()["id"]

    resp = client.put(
        f"/api/library/worlds/{world_id}/clues/{clue_id}",
        json={"text": "Revised text", "revelation": "New revelation"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["text"] == "Revised text"
    assert body["revelation"] == "New revelation"


def test_update_clue_rejects_unknown_field(as_user, db: Session) -> None:
    enable_library(db)
    client = as_user("gm")
    world_id = make_world(client)
    resp = client.post(f"/api/library/worlds/{world_id}/clues", json={"text": "..."})
    clue_id = resp.json()["id"]

    resp = client.put(
        f"/api/library/worlds/{world_id}/clues/{clue_id}",
        json={"bogus": "nope"},
    )
    assert resp.status_code == 422


def test_delete_clue(as_user, db: Session) -> None:
    enable_library(db)
    client = as_user("gm")
    world_id = make_world(client)
    resp = client.post(f"/api/library/worlds/{world_id}/clues", json={"text": "..."})
    clue_id = resp.json()["id"]

    resp = client.delete(f"/api/library/worlds/{world_id}/clues/{clue_id}")
    assert resp.status_code == 204

    resp = client.get(f"/api/library/worlds/{world_id}/clues/{clue_id}")
    assert resp.status_code == 404


def test_player_forbidden(as_user, db: Session) -> None:
    enable_library(db)
    gm = as_user("gm", username="gm-user")
    world_id = make_world(gm)

    resp = as_user("player", username="player-user").get(f"/api/library/worlds/{world_id}/clues")
    assert resp.status_code == 403
