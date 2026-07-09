import json

from sqlalchemy.orm import Session

from app.models import AppSetting


def enable_campaigns(db: Session) -> None:
    db.add(AppSetting(key="campaigns_enabled", value=json.dumps(True)))
    db.commit()


def test_disabled_flag_returns_404(as_user, db: Session) -> None:
    client = as_user("gm")
    resp = client.get("/api/campaigns")
    assert resp.status_code == 404


def test_non_gm_forbidden(as_user, db: Session) -> None:
    enable_campaigns(db)
    resp = as_user("host").get("/api/campaigns")
    assert resp.status_code == 403


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
