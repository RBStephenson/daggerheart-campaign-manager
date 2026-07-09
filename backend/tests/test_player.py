import json
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.models import AppSetting, Campaign, CampaignMembership, User
from tests.conftest import make_user


def enable(db: Session, *keys: str) -> None:
    for key in keys:
        db.add(AppSetting(key=key, value=json.dumps(True)))
    db.commit()


def make_campaign(db: Session, *, gm_id: int, name: str = "Windmere") -> Campaign:
    campaign = Campaign(name=name, description="", gm_user_id=gm_id, created_at=datetime.now(UTC))
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return campaign


def make_membership(db: Session, *, campaign_id: int, player_id: int) -> None:
    db.add(
        CampaignMembership(
            campaign_id=campaign_id, player_user_id=player_id, joined_at=datetime.now(UTC)
        )
    )
    db.commit()


def test_disabled_flag_returns_404(as_user, db: Session) -> None:
    client = as_user("player")
    resp = client.get("/api/player/campaigns")
    assert resp.status_code == 404


def test_non_player_forbidden(as_user, db: Session) -> None:
    enable(db, "player_area_enabled")
    resp = as_user("gm").get("/api/player/campaigns")
    assert resp.status_code == 403


def test_host_has_superuser_access(as_user, db: Session) -> None:
    enable(db, "player_area_enabled")
    resp = as_user("host").get("/api/player/campaigns")
    assert resp.status_code == 200


def test_list_my_campaigns_only_shows_memberships(as_user, db: Session) -> None:
    enable(db, "player_area_enabled")
    gm = make_user(db, username="gm1", role="gm")
    campaign_a = make_campaign(db, gm_id=gm.id, name="A")
    make_campaign(db, gm_id=gm.id, name="B")

    client = as_user("player", username="alice")
    player = db.query(User).filter_by(username="alice").one()
    make_membership(db, campaign_id=campaign_a.id, player_id=player.id)

    resp = client.get("/api/player/campaigns")
    assert resp.status_code == 200
    assert [c["name"] for c in resp.json()] == ["A"]


def test_create_character_requires_membership(as_user, db: Session) -> None:
    enable(db, "player_area_enabled")
    gm = make_user(db, username="gm1", role="gm")
    campaign = make_campaign(db, gm_id=gm.id)

    client = as_user("player")
    resp = client.post(
        "/api/player/characters",
        json={"campaign_id": campaign.id, "name": "Kael"},
    )
    assert resp.status_code == 404


def test_create_and_list_own_character(as_user, db: Session) -> None:
    enable(db, "player_area_enabled")
    gm = make_user(db, username="gm1", role="gm")
    campaign = make_campaign(db, gm_id=gm.id)

    client = as_user("player", username="alice")
    player = db.query(User).filter_by(username="alice").one()
    make_membership(db, campaign_id=campaign.id, player_id=player.id)

    create_resp = client.post(
        "/api/player/characters",
        json={
            "campaign_id": campaign.id,
            "name": "Kael",
            "char_class": "Warrior",
            "ancestry": "Human",
            "community": "Highborne",
            "level": 2,
        },
    )
    assert create_resp.status_code == 200
    assert create_resp.json()["name"] == "Kael"

    list_resp = client.get("/api/player/characters")
    assert [c["name"] for c in list_resp.json()] == ["Kael"]


def test_character_ownership_isolation(as_user, db: Session) -> None:
    enable(db, "player_area_enabled")
    gm = make_user(db, username="gm1", role="gm")
    campaign = make_campaign(db, gm_id=gm.id)

    alice = as_user("player", username="alice")
    alice_id = db.query(User).filter_by(username="alice").one().id
    make_membership(db, campaign_id=campaign.id, player_id=alice_id)
    char_id = alice.post(
        "/api/player/characters", json={"campaign_id": campaign.id, "name": "Kael"}
    ).json()["id"]

    bob = as_user("player", username="bob")
    bob_id = db.query(User).filter_by(username="bob").one().id
    make_membership(db, campaign_id=campaign.id, player_id=bob_id)

    assert bob.get("/api/player/characters").json() == []
    assert bob.put(f"/api/player/characters/{char_id}", json={"name": "Stolen"}).status_code == 404
    assert bob.delete(f"/api/player/characters/{char_id}").status_code == 404


def test_update_character(as_user, db: Session) -> None:
    enable(db, "player_area_enabled")
    gm = make_user(db, username="gm1", role="gm")
    campaign = make_campaign(db, gm_id=gm.id)
    client = as_user("player", username="alice")
    player_id = db.query(User).filter_by(username="alice").one().id
    make_membership(db, campaign_id=campaign.id, player_id=player_id)
    char_id = client.post(
        "/api/player/characters", json={"campaign_id": campaign.id, "name": "Kael"}
    ).json()["id"]

    resp = client.put(f"/api/player/characters/{char_id}", json={"level": 5})
    assert resp.status_code == 200
    assert resp.json()["level"] == 5
    assert resp.json()["name"] == "Kael"


def test_update_character_rejects_unknown_field(as_user, db: Session) -> None:
    enable(db, "player_area_enabled")
    gm = make_user(db, username="gm1", role="gm")
    campaign = make_campaign(db, gm_id=gm.id)
    client = as_user("player", username="alice")
    player_id = db.query(User).filter_by(username="alice").one().id
    make_membership(db, campaign_id=campaign.id, player_id=player_id)
    char_id = client.post(
        "/api/player/characters", json={"campaign_id": campaign.id, "name": "Kael"}
    ).json()["id"]

    resp = client.put(f"/api/player/characters/{char_id}", json={"nope": "x"})
    assert resp.status_code == 422


def test_delete_character(as_user, db: Session) -> None:
    enable(db, "player_area_enabled")
    gm = make_user(db, username="gm1", role="gm")
    campaign = make_campaign(db, gm_id=gm.id)
    client = as_user("player", username="alice")
    player_id = db.query(User).filter_by(username="alice").one().id
    make_membership(db, campaign_id=campaign.id, player_id=player_id)
    char_id = client.post(
        "/api/player/characters", json={"campaign_id": campaign.id, "name": "Kael"}
    ).json()["id"]

    assert client.delete(f"/api/player/characters/{char_id}").status_code == 204
    assert client.get("/api/player/characters").json() == []


def test_note_requires_membership(as_user, db: Session) -> None:
    enable(db, "player_area_enabled")
    gm = make_user(db, username="gm1", role="gm")
    campaign = make_campaign(db, gm_id=gm.id)
    client = as_user("player")
    assert client.get(f"/api/player/campaigns/{campaign.id}/note").status_code == 404


def test_note_defaults_empty_then_can_be_saved(as_user, db: Session) -> None:
    enable(db, "player_area_enabled")
    gm = make_user(db, username="gm1", role="gm")
    campaign = make_campaign(db, gm_id=gm.id)
    client = as_user("player", username="alice")
    player_id = db.query(User).filter_by(username="alice").one().id
    make_membership(db, campaign_id=campaign.id, player_id=player_id)

    initial = client.get(f"/api/player/campaigns/{campaign.id}/note")
    assert initial.status_code == 200
    assert initial.json()["body"] == ""

    saved = client.put(
        f"/api/player/campaigns/{campaign.id}/note", json={"body": "remember the key"}
    )
    assert saved.status_code == 200
    assert saved.json()["body"] == "remember the key"

    reread = client.get(f"/api/player/campaigns/{campaign.id}/note")
    assert reread.json()["body"] == "remember the key"


def test_notes_are_private_per_player(as_user, db: Session) -> None:
    enable(db, "player_area_enabled")
    gm = make_user(db, username="gm1", role="gm")
    campaign = make_campaign(db, gm_id=gm.id)

    alice = as_user("player", username="alice")
    alice_id = db.query(User).filter_by(username="alice").one().id
    make_membership(db, campaign_id=campaign.id, player_id=alice_id)
    alice.put(f"/api/player/campaigns/{campaign.id}/note", json={"body": "alice's secret"})

    bob = as_user("player", username="bob")
    bob_id = db.query(User).filter_by(username="bob").one().id
    make_membership(db, campaign_id=campaign.id, player_id=bob_id)
    resp = bob.get(f"/api/player/campaigns/{campaign.id}/note")
    assert resp.json()["body"] == ""
