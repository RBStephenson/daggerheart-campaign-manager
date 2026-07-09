import json

from sqlalchemy.orm import Session

from app.models import AppSetting
from tests.conftest import make_user


def enable_campaigns(db: Session) -> None:
    db.add(AppSetting(key="campaigns_enabled", value=json.dumps(True)))
    db.commit()


def test_disabled_flag_returns_404(as_user, db: Session) -> None:
    client = as_user("gm")
    resp = client.get("/api/campaigns")
    assert resp.status_code == 404


def test_player_forbidden(as_user, db: Session) -> None:
    enable_campaigns(db)
    resp = as_user("player").get("/api/campaigns")
    assert resp.status_code == 403


def test_host_has_superuser_access(as_user, db: Session) -> None:
    enable_campaigns(db)
    client = as_user("host")
    create_resp = client.post("/api/campaigns", json={"name": "Host's own campaign"})
    assert create_resp.status_code == 200

    list_resp = client.get("/api/campaigns")
    assert list_resp.status_code == 200
    assert [c["name"] for c in list_resp.json()] == ["Host's own campaign"]


def test_create_and_list_campaign(as_user, db: Session) -> None:
    enable_campaigns(db)
    client = as_user("gm")
    create_resp = client.post("/api/campaigns", json={"name": "Windmere", "description": "A start"})
    assert create_resp.status_code == 200
    assert create_resp.json()["name"] == "Windmere"

    list_resp = client.get("/api/campaigns")
    assert list_resp.status_code == 200
    assert [c["name"] for c in list_resp.json()] == ["Windmere"]


def test_campaigns_are_scoped_to_owning_gm(as_user, db: Session) -> None:
    enable_campaigns(db)
    gm_a = as_user("gm", username="gm-a")
    gm_a.post("/api/campaigns", json={"name": "GM A's campaign"})

    gm_b = as_user("gm", username="gm-b")
    resp = gm_b.get("/api/campaigns")
    assert resp.json() == []


def test_get_other_gms_campaign_is_404(as_user, db: Session) -> None:
    enable_campaigns(db)
    gm_a = as_user("gm", username="gm-a")
    campaign_id = gm_a.post("/api/campaigns", json={"name": "GM A's campaign"}).json()["id"]

    gm_b = as_user("gm", username="gm-b")
    resp = gm_b.get(f"/api/campaigns/{campaign_id}")
    assert resp.status_code == 404


def test_update_campaign(as_user, db: Session) -> None:
    enable_campaigns(db)
    client = as_user("gm")
    campaign_id = client.post("/api/campaigns", json={"name": "Original"}).json()["id"]

    resp = client.put(f"/api/campaigns/{campaign_id}", json={"name": "Renamed"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "Renamed"


def test_update_rejects_unknown_field(as_user, db: Session) -> None:
    enable_campaigns(db)
    client = as_user("gm")
    campaign_id = client.post("/api/campaigns", json={"name": "Original"}).json()["id"]

    resp = client.put(f"/api/campaigns/{campaign_id}", json={"nope": "x"})
    assert resp.status_code == 422


def test_delete_campaign(as_user, db: Session) -> None:
    enable_campaigns(db)
    client = as_user("gm")
    campaign_id = client.post("/api/campaigns", json={"name": "Doomed"}).json()["id"]

    resp = client.delete(f"/api/campaigns/{campaign_id}")
    assert resp.status_code == 204
    assert client.get(f"/api/campaigns/{campaign_id}").status_code == 404


def test_start_session_returns_room(as_user, db: Session) -> None:
    enable_campaigns(db)
    client = as_user("gm")
    campaign_id = client.post("/api/campaigns", json={"name": "Windmere"}).json()["id"]

    resp = client.post(f"/api/campaigns/{campaign_id}/sessions")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "active"
    assert body["room"] == f"session-{body['id']}"


def test_start_session_conflicts_when_already_active(as_user, db: Session) -> None:
    enable_campaigns(db)
    client = as_user("gm")
    campaign_id = client.post("/api/campaigns", json={"name": "Windmere"}).json()["id"]
    client.post(f"/api/campaigns/{campaign_id}/sessions")

    resp = client.post(f"/api/campaigns/{campaign_id}/sessions")
    assert resp.status_code == 409


def test_end_session(as_user, db: Session) -> None:
    enable_campaigns(db)
    client = as_user("gm")
    campaign_id = client.post("/api/campaigns", json={"name": "Windmere"}).json()["id"]
    session_id = client.post(f"/api/campaigns/{campaign_id}/sessions").json()["id"]

    resp = client.post(f"/api/campaigns/{campaign_id}/sessions/{session_id}/end")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ended"
    assert resp.json()["ended_at"] is not None


def test_end_already_ended_session_conflicts(as_user, db: Session) -> None:
    enable_campaigns(db)
    client = as_user("gm")
    campaign_id = client.post("/api/campaigns", json={"name": "Windmere"}).json()["id"]
    session_id = client.post(f"/api/campaigns/{campaign_id}/sessions").json()["id"]
    client.post(f"/api/campaigns/{campaign_id}/sessions/{session_id}/end")

    resp = client.post(f"/api/campaigns/{campaign_id}/sessions/{session_id}/end")
    assert resp.status_code == 409


def test_can_start_new_session_after_ending_previous(as_user, db: Session) -> None:
    enable_campaigns(db)
    client = as_user("gm")
    campaign_id = client.post("/api/campaigns", json={"name": "Windmere"}).json()["id"]
    session_id = client.post(f"/api/campaigns/{campaign_id}/sessions").json()["id"]
    client.post(f"/api/campaigns/{campaign_id}/sessions/{session_id}/end")

    resp = client.post(f"/api/campaigns/{campaign_id}/sessions")
    assert resp.status_code == 200
    assert resp.json()["status"] == "active"


def test_list_sessions(as_user, db: Session) -> None:
    enable_campaigns(db)
    client = as_user("gm")
    campaign_id = client.post("/api/campaigns", json={"name": "Windmere"}).json()["id"]
    session_id = client.post(f"/api/campaigns/{campaign_id}/sessions").json()["id"]
    client.post(f"/api/campaigns/{campaign_id}/sessions/{session_id}/end")

    resp = client.get(f"/api/campaigns/{campaign_id}/sessions")
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_add_member(as_user, db: Session) -> None:
    enable_campaigns(db)
    gm_client = as_user("gm")
    campaign_id = gm_client.post("/api/campaigns", json={"name": "Windmere"}).json()["id"]
    make_user(db, username="alice", role="player")

    resp = gm_client.post(f"/api/campaigns/{campaign_id}/members", json={"username": "alice"})
    assert resp.status_code == 200
    assert resp.json()["player_username"] == "alice"

    list_resp = gm_client.get(f"/api/campaigns/{campaign_id}/members")
    assert [m["player_username"] for m in list_resp.json()] == ["alice"]


def test_add_member_rejects_non_player(as_user, db: Session) -> None:
    enable_campaigns(db)
    gm_client = as_user("gm")
    campaign_id = gm_client.post("/api/campaigns", json={"name": "Windmere"}).json()["id"]
    make_user(db, username="bob", role="gm")

    resp = gm_client.post(f"/api/campaigns/{campaign_id}/members", json={"username": "bob"})
    assert resp.status_code == 404


def test_add_member_rejects_unknown_username(as_user, db: Session) -> None:
    enable_campaigns(db)
    gm_client = as_user("gm")
    campaign_id = gm_client.post("/api/campaigns", json={"name": "Windmere"}).json()["id"]

    resp = gm_client.post(f"/api/campaigns/{campaign_id}/members", json={"username": "ghost"})
    assert resp.status_code == 404


def test_add_member_rejects_duplicate(as_user, db: Session) -> None:
    enable_campaigns(db)
    gm_client = as_user("gm")
    campaign_id = gm_client.post("/api/campaigns", json={"name": "Windmere"}).json()["id"]
    make_user(db, username="alice", role="player")
    gm_client.post(f"/api/campaigns/{campaign_id}/members", json={"username": "alice"})

    resp = gm_client.post(f"/api/campaigns/{campaign_id}/members", json={"username": "alice"})
    assert resp.status_code == 409


def test_remove_member(as_user, db: Session) -> None:
    enable_campaigns(db)
    gm_client = as_user("gm")
    campaign_id = gm_client.post("/api/campaigns", json={"name": "Windmere"}).json()["id"]
    player = make_user(db, username="alice", role="player")
    gm_client.post(f"/api/campaigns/{campaign_id}/members", json={"username": "alice"})

    resp = gm_client.delete(f"/api/campaigns/{campaign_id}/members/{player.id}")
    assert resp.status_code == 204
    assert gm_client.get(f"/api/campaigns/{campaign_id}/members").json() == []


def test_cannot_manage_members_of_other_gms_campaign(as_user, db: Session) -> None:
    enable_campaigns(db)
    gm_a = as_user("gm", username="gm-a")
    campaign_id = gm_a.post("/api/campaigns", json={"name": "Windmere"}).json()["id"]
    make_user(db, username="alice", role="player")

    gm_b = as_user("gm", username="gm-b")
    resp = gm_b.post(f"/api/campaigns/{campaign_id}/members", json={"username": "alice"})
    assert resp.status_code == 404
