import json
from datetime import UTC, datetime

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import AppSetting, Campaign, CampaignMembership, Character, User
from tests.conftest import make_user
from tests.test_character_sheet import valid_bard_sheet


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


def test_create_character_with_valid_sheet(as_user, db: Session) -> None:
    enable(db, "player_area_enabled")
    gm = make_user(db, username="gm1", role="gm")
    campaign = make_campaign(db, gm_id=gm.id)
    client = as_user("player", username="alice")
    player = db.query(User).filter_by(username="alice").one()
    make_membership(db, campaign_id=campaign.id, player_id=player.id)

    resp = client.post(
        "/api/player/characters",
        json={
            "campaign_id": campaign.id,
            "name": "Lyra",
            "char_class": "Bard",
            "ancestry": "Human",
            "community": "Wanderborne",
            "level": 1,
            "extra": json.dumps(valid_bard_sheet()),
        },
    )
    assert resp.status_code == 200
    assert json.loads(resp.json()["extra"])["char_class"] == "Bard"


def test_create_character_with_invalid_sheet_is_422(as_user, db: Session) -> None:
    enable(db, "player_area_enabled")
    gm = make_user(db, username="gm1", role="gm")
    campaign = make_campaign(db, gm_id=gm.id)
    client = as_user("player", username="alice")
    player = db.query(User).filter_by(username="alice").one()
    make_membership(db, campaign_id=campaign.id, player_id=player.id)

    bad = valid_bard_sheet()
    bad["evasion"] = 99  # doesn't match the Bard's starting Evasion
    resp = client.post(
        "/api/player/characters",
        json={"campaign_id": campaign.id, "name": "Lyra", "extra": json.dumps(bad)},
    )
    assert resp.status_code == 422
    assert "character sheet" in resp.json()["detail"].lower()


def test_create_character_empty_extra_still_works(as_user, db: Session) -> None:
    enable(db, "player_area_enabled")
    gm = make_user(db, username="gm1", role="gm")
    campaign = make_campaign(db, gm_id=gm.id)
    client = as_user("player", username="alice")
    player = db.query(User).filter_by(username="alice").one()
    make_membership(db, campaign_id=campaign.id, player_id=player.id)

    # The flat form never populates `extra` — the default "{}" must stay valid.
    resp = client.post(
        "/api/player/characters",
        json={"campaign_id": campaign.id, "name": "Flat"},
    )
    assert resp.status_code == 200


def test_update_character_with_invalid_sheet_is_422(as_user, db: Session) -> None:
    enable(db, "player_area_enabled")
    gm = make_user(db, username="gm1", role="gm")
    campaign = make_campaign(db, gm_id=gm.id)
    client = as_user("player", username="alice")
    player = db.query(User).filter_by(username="alice").one()
    make_membership(db, campaign_id=campaign.id, player_id=player.id)
    char_id = client.post(
        "/api/player/characters", json={"campaign_id": campaign.id, "name": "Lyra"}
    ).json()["id"]

    bad = valid_bard_sheet()
    bad["subclass"] = "Nightwalker"  # not a Bard subclass
    resp = client.put(f"/api/player/characters/{char_id}", json={"extra": json.dumps(bad)})
    assert resp.status_code == 422


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


# --- Character state (HP/Stress/Hope/Armor Slot tracking) -------------------


def make_sheeted_character(
    as_user_fn, db: Session, *, username: str = "alice"
) -> tuple[TestClient, Character]:
    """Create a player, campaign, membership, and a character with a valid
    Level 1 sheet — the common setup every state test needs."""
    gm = make_user(db, username=f"gm-{username}", role="gm")
    campaign = make_campaign(db, gm_id=gm.id, name=f"Campaign-{username}")
    client = as_user_fn("player", username=username)
    player = db.query(User).filter_by(username=username).one()
    make_membership(db, campaign_id=campaign.id, player_id=player.id)
    resp = client.post(
        "/api/player/characters",
        json={
            "campaign_id": campaign.id,
            "name": "Lyra",
            "char_class": "Bard",
            "extra": json.dumps(valid_bard_sheet()),
        },
    )
    assert resp.status_code == 200
    character = db.query(Character).filter_by(id=resp.json()["id"]).one()
    return client, character


def test_state_disabled_flag_returns_404(as_user, db: Session) -> None:
    enable(db, "player_area_enabled")
    client, character = make_sheeted_character(as_user, db)
    resp = client.patch(f"/api/player/characters/{character.id}/state", json={"hp_marked": 1})
    assert resp.status_code == 404


def test_state_defaults_match_level_1_creation(as_user, db: Session) -> None:
    enable(db, "player_area_enabled", "character_sheet_enabled")
    client, character = make_sheeted_character(as_user, db)
    resp = client.get("/api/player/characters")
    out = next(c for c in resp.json() if c["id"] == character.id)
    assert out["hp_marked"] == 0
    assert out["stress_marked"] == 0
    assert out["hope"] == 2
    assert out["armor_slots_marked"] == 0


def test_state_partial_update(as_user, db: Session) -> None:
    enable(db, "player_area_enabled", "character_sheet_enabled")
    client, character = make_sheeted_character(as_user, db)

    resp = client.patch(
        f"/api/player/characters/{character.id}/state",
        json={"hp_marked": 2, "hope": 4},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["hp_marked"] == 2
    assert body["hope"] == 4
    # Untouched fields stay at their defaults.
    assert body["stress_marked"] == 0
    assert body["armor_slots_marked"] == 0


def test_state_rejects_hp_marked_beyond_hp_max(as_user, db: Session) -> None:
    enable(db, "player_area_enabled", "character_sheet_enabled")
    client, character = make_sheeted_character(as_user, db)  # Bard hp_max=5

    resp = client.patch(f"/api/player/characters/{character.id}/state", json={"hp_marked": 6})
    assert resp.status_code == 422
    assert "hp_max" in resp.json()["detail"]


def test_state_rejects_stress_marked_beyond_stress_max(as_user, db: Session) -> None:
    enable(db, "player_area_enabled", "character_sheet_enabled")
    client, character = make_sheeted_character(as_user, db)  # stress_max=6

    resp = client.patch(f"/api/player/characters/{character.id}/state", json={"stress_marked": 7})
    assert resp.status_code == 422
    assert "stress_max" in resp.json()["detail"]


def test_state_rejects_hope_beyond_six(as_user, db: Session) -> None:
    enable(db, "player_area_enabled", "character_sheet_enabled")
    client, character = make_sheeted_character(as_user, db)

    resp = client.patch(f"/api/player/characters/{character.id}/state", json={"hope": 7})
    assert resp.status_code == 422


def test_state_rejects_armor_slots_beyond_armor_score(as_user, db: Session) -> None:
    enable(db, "player_area_enabled", "character_sheet_enabled")
    # Bard fixture equips Leather Armor, base_score 3.
    client, character = make_sheeted_character(as_user, db)

    resp = client.patch(
        f"/api/player/characters/{character.id}/state", json={"armor_slots_marked": 4}
    )
    assert resp.status_code == 422
    assert "Armor Score" in resp.json()["detail"]


def test_state_rejects_negative_values(as_user, db: Session) -> None:
    enable(db, "player_area_enabled", "character_sheet_enabled")
    client, character = make_sheeted_character(as_user, db)

    resp = client.patch(f"/api/player/characters/{character.id}/state", json={"hp_marked": -1})
    assert resp.status_code == 422


def test_state_requires_a_completed_sheet(as_user, db: Session) -> None:
    enable(db, "player_area_enabled", "character_sheet_enabled")
    gm = make_user(db, username="gm2", role="gm")
    campaign = make_campaign(db, gm_id=gm.id, name="No-Sheet Campaign")
    client = as_user("player", username="charlie")
    player = db.query(User).filter_by(username="charlie").one()
    make_membership(db, campaign_id=campaign.id, player_id=player.id)
    resp = client.post(
        "/api/player/characters",
        json={"campaign_id": campaign.id, "name": "Blank Sheet"},
    )
    character_id = resp.json()["id"]

    state_resp = client.patch(
        f"/api/player/characters/{character_id}/state", json={"hp_marked": 1}
    )
    assert state_resp.status_code == 422
    assert "completed sheet" in state_resp.json()["detail"]


def test_state_ownership_isolation(as_user, db: Session) -> None:
    enable(db, "player_area_enabled", "character_sheet_enabled")
    _, character = make_sheeted_character(as_user, db, username="alice")

    bob = as_user("player", username="bob")
    resp = bob.patch(f"/api/player/characters/{character.id}/state", json={"hp_marked": 1})
    assert resp.status_code == 404


def test_state_rejects_unknown_field(as_user, db: Session) -> None:
    enable(db, "player_area_enabled", "character_sheet_enabled")
    client, character = make_sheeted_character(as_user, db)

    resp = client.patch(
        f"/api/player/characters/{character.id}/state", json={"level": 5}
    )
    assert resp.status_code == 422
