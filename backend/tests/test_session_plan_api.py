import json
from datetime import UTC, datetime

import pytest
from sqlalchemy.orm import Session

from app.models import AppSetting, Campaign, Continent, Region, User, World
from tests.conftest import make_user


def enable_session_planning(db: Session) -> None:
    db.add(AppSetting(key="session_planning_enabled", value=json.dumps(True)))
    db.commit()


def make_campaign(db: Session, *, gm: User, name: str = "Windmere") -> Campaign:
    campaign = Campaign(name=name, description="", gm_user_id=gm.id, created_at=datetime.now(UTC))
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return campaign


def make_region(db: Session, *, name: str = "Hillford") -> Region:
    world = World(name="Aetheris", created_at=datetime.now(UTC))
    db.add(world)
    db.commit()
    db.refresh(world)
    now = datetime.now(UTC)
    continent = Continent(world_id=world.id, name="Tharivor", created_at=now, updated_at=now)
    db.add(continent)
    db.commit()
    db.refresh(continent)
    region = Region(continent_id=continent.id, name=name, created_at=now, updated_at=now)
    db.add(region)
    db.commit()
    db.refresh(region)
    return region


def _as_gm_with_campaign(as_user, db: Session):
    client = as_user("gm")
    gm = db.query(User).filter_by(username="test-user").one()
    campaign = make_campaign(db, gm=gm)
    return client, campaign


def test_disabled_flag_returns_404(as_user, db: Session) -> None:
    client, campaign = _as_gm_with_campaign(as_user, db)
    resp = client.get(f"/api/campaigns/{campaign.id}/session-plans")
    assert resp.status_code == 404


def test_player_forbidden(as_user, db: Session) -> None:
    enable_session_planning(db)
    gm = make_user(db, username="gm-1", role="gm")
    campaign = make_campaign(db, gm=gm)
    resp = as_user("player").get(f"/api/campaigns/{campaign.id}/session-plans")
    assert resp.status_code == 403


def test_non_owning_gm_gets_404(as_user, db: Session) -> None:
    enable_session_planning(db)
    other_gm = make_user(db, username="other-gm", role="gm")
    campaign = make_campaign(db, gm=other_gm)
    client = as_user("gm")
    resp = client.get(f"/api/campaigns/{campaign.id}/session-plans")
    assert resp.status_code == 404


def test_create_and_list_session_plan(as_user, db: Session) -> None:
    enable_session_planning(db)
    client, campaign = _as_gm_with_campaign(as_user, db)

    create_resp = client.post(
        f"/api/campaigns/{campaign.id}/session-plans",
        json={"title": "Raid on Hillford, Session 1", "order": 1},
    )
    assert create_resp.status_code == 200
    body = create_resp.json()
    assert body["title"] == "Raid on Hillford, Session 1"
    assert body["campaign_id"] == campaign.id
    assert body["content"] == {
        "opening": "",
        "beats": [],
        "countdowns": [],
        "hooks": [],
        "reward": "",
        "notes": "",
    }

    list_resp = client.get(f"/api/campaigns/{campaign.id}/session-plans")
    assert list_resp.status_code == 200
    assert [p["title"] for p in list_resp.json()] == ["Raid on Hillford, Session 1"]


def test_create_session_plan_with_full_hillford_shaped_content(as_user, db: Session) -> None:
    enable_session_planning(db)
    client, campaign = _as_gm_with_campaign(as_user, db)

    content = {
        "beats": [
            {"name": "Solo scenes", "description": "Each PC introduced separately.", "npc_ids": []}
        ],
        "countdowns": [
            {
                "name": "Fire at the Forge",
                "max_segments": 4,
                "trigger": "ticks up on a timer",
                "on_complete": "Brightsteel Forge is lost, Darrin is wounded but alive",
                "on_intervention": "resolves early, party gets the sigil ID firsthand",
            }
        ],
        "hooks": ["Where was Baron Harrowind during the Raid?"],
        "notes": "Sandbox structure, not scripted.",
    }
    resp = client.post(
        f"/api/campaigns/{campaign.id}/session-plans",
        json={"title": "Raid on Hillford, Session 1", "content": content},
    )
    assert resp.status_code == 200
    assert resp.json()["content"] == {**content, "opening": "", "reward": ""}


def test_create_session_plan_with_opening_and_reward(as_user, db: Session) -> None:
    enable_session_planning(db)
    client, campaign = _as_gm_with_campaign(as_user, db)

    content = {
        "opening": "The party wakes to smoke on the horizon over Hillford.",
        "reward": "A signet ring bearing the Harrowind crest.",
    }
    resp = client.post(
        f"/api/campaigns/{campaign.id}/session-plans",
        json={"title": "Session 1", "content": content},
    )
    assert resp.status_code == 200
    assert resp.json()["content"]["opening"] == content["opening"]
    assert resp.json()["content"]["reward"] == content["reward"]


def test_session_plan_content_allows_unknown_future_keys(as_user, db: Session) -> None:
    enable_session_planning(db)
    client, campaign = _as_gm_with_campaign(as_user, db)

    resp = client.post(
        f"/api/campaigns/{campaign.id}/session-plans",
        json={"title": "Session 1", "content": {"factions_present": ["The Fleshweavers"]}},
    )
    assert resp.status_code == 200
    assert resp.json()["content"]["factions_present"] == ["The Fleshweavers"]


def test_countdown_requires_positive_max_segments(as_user, db: Session) -> None:
    enable_session_planning(db)
    client, campaign = _as_gm_with_campaign(as_user, db)

    resp = client.post(
        f"/api/campaigns/{campaign.id}/session-plans",
        json={
            "title": "Session 1",
            "content": {"countdowns": [{"name": "Bad", "max_segments": 0}]},
        },
    )
    assert resp.status_code == 422


def test_get_missing_plan_is_404(as_user, db: Session) -> None:
    enable_session_planning(db)
    client, campaign = _as_gm_with_campaign(as_user, db)
    resp = client.get(f"/api/campaigns/{campaign.id}/session-plans/999")
    assert resp.status_code == 404


def test_update_session_plan(as_user, db: Session) -> None:
    enable_session_planning(db)
    client, campaign = _as_gm_with_campaign(as_user, db)
    plan_id = client.post(
        f"/api/campaigns/{campaign.id}/session-plans", json={"title": "Draft"}
    ).json()["id"]

    resp = client.put(
        f"/api/campaigns/{campaign.id}/session-plans/{plan_id}",
        json={"title": "Final", "content": {"hooks": ["A new hook"]}},
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "Final"
    assert resp.json()["content"]["hooks"] == ["A new hook"]


def test_update_rejects_unknown_top_level_field(as_user, db: Session) -> None:
    enable_session_planning(db)
    client, campaign = _as_gm_with_campaign(as_user, db)
    plan_id = client.post(
        f"/api/campaigns/{campaign.id}/session-plans", json={"title": "Draft"}
    ).json()["id"]

    resp = client.put(
        f"/api/campaigns/{campaign.id}/session-plans/{plan_id}", json={"nope": "x"}
    )
    assert resp.status_code == 422


def test_delete_session_plan(as_user, db: Session) -> None:
    enable_session_planning(db)
    client, campaign = _as_gm_with_campaign(as_user, db)
    plan_id = client.post(
        f"/api/campaigns/{campaign.id}/session-plans", json={"title": "Doomed"}
    ).json()["id"]

    resp = client.delete(f"/api/campaigns/{campaign.id}/session-plans/{plan_id}")
    assert resp.status_code == 204
    assert client.get(f"/api/campaigns/{campaign.id}/session-plans/{plan_id}").status_code == 404


def test_create_and_list_library_link(as_user, db: Session) -> None:
    enable_session_planning(db)
    client, campaign = _as_gm_with_campaign(as_user, db)
    region = make_region(db)
    plan_id = client.post(
        f"/api/campaigns/{campaign.id}/session-plans", json={"title": "Session 1"}
    ).json()["id"]

    resp = client.post(
        f"/api/campaigns/{campaign.id}/session-plans/{plan_id}/links",
        json={"entity_type": "region", "entity_id": region.id},
    )
    assert resp.status_code == 200
    assert resp.json()["entity_type"] == "region"
    assert resp.json()["entity_id"] == region.id

    list_resp = client.get(f"/api/campaigns/{campaign.id}/session-plans/{plan_id}/links")
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 1


def test_create_link_to_missing_entity_is_404(as_user, db: Session) -> None:
    enable_session_planning(db)
    client, campaign = _as_gm_with_campaign(as_user, db)
    plan_id = client.post(
        f"/api/campaigns/{campaign.id}/session-plans", json={"title": "Session 1"}
    ).json()["id"]

    resp = client.post(
        f"/api/campaigns/{campaign.id}/session-plans/{plan_id}/links",
        json={"entity_type": "npc", "entity_id": 999},
    )
    assert resp.status_code == 404


def test_create_link_rejects_unknown_entity_type(as_user, db: Session) -> None:
    enable_session_planning(db)
    client, campaign = _as_gm_with_campaign(as_user, db)
    plan_id = client.post(
        f"/api/campaigns/{campaign.id}/session-plans", json={"title": "Session 1"}
    ).json()["id"]

    resp = client.post(
        f"/api/campaigns/{campaign.id}/session-plans/{plan_id}/links",
        json={"entity_type": "monster", "entity_id": 1},
    )
    assert resp.status_code == 422


def test_duplicate_link_is_rejected(as_user, db: Session) -> None:
    enable_session_planning(db)
    client, campaign = _as_gm_with_campaign(as_user, db)
    region = make_region(db)
    plan_id = client.post(
        f"/api/campaigns/{campaign.id}/session-plans", json={"title": "Session 1"}
    ).json()["id"]

    body = {"entity_type": "region", "entity_id": region.id}
    first = client.post(f"/api/campaigns/{campaign.id}/session-plans/{plan_id}/links", json=body)
    assert first.status_code == 200
    second = client.post(f"/api/campaigns/{campaign.id}/session-plans/{plan_id}/links", json=body)
    assert second.status_code == 409


def test_delete_link(as_user, db: Session) -> None:
    enable_session_planning(db)
    client, campaign = _as_gm_with_campaign(as_user, db)
    region = make_region(db)
    plan_id = client.post(
        f"/api/campaigns/{campaign.id}/session-plans", json={"title": "Session 1"}
    ).json()["id"]
    link_id = client.post(
        f"/api/campaigns/{campaign.id}/session-plans/{plan_id}/links",
        json={"entity_type": "region", "entity_id": region.id},
    ).json()["id"]

    resp = client.delete(f"/api/campaigns/{campaign.id}/session-plans/{plan_id}/links/{link_id}")
    assert resp.status_code == 204
    assert (
        client.get(f"/api/campaigns/{campaign.id}/session-plans/{plan_id}/links").json() == []
    )


def test_session_plans_are_scoped_to_their_campaign(as_user, db: Session) -> None:
    enable_session_planning(db)
    client, campaign_a = _as_gm_with_campaign(as_user, db)
    gm = db.query(User).filter_by(username="test-user").one()
    campaign_b = make_campaign(db, gm=gm, name="Elsewhere")
    client.post(f"/api/campaigns/{campaign_a.id}/session-plans", json={"title": "Session A"})
    client.post(f"/api/campaigns/{campaign_b.id}/session-plans", json={"title": "Session B"})

    resp = client.get(f"/api/campaigns/{campaign_a.id}/session-plans")
    assert [p["title"] for p in resp.json()] == ["Session A"]


@pytest.mark.parametrize(
    "segment", ["continent", "region", "location", "faction", "npc", "adversary"]
)
def test_link_accepts_every_library_entity_type(as_user, db: Session, segment: str) -> None:
    enable_session_planning(db)
    client, campaign = _as_gm_with_campaign(as_user, db)
    plan_id = client.post(
        f"/api/campaigns/{campaign.id}/session-plans", json={"title": "Session 1"}
    ).json()["id"]

    resp = client.post(
        f"/api/campaigns/{campaign.id}/session-plans/{plan_id}/links",
        json={"entity_type": segment, "entity_id": 999},
    )
    assert resp.status_code == 404
