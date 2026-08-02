import json
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.models import Campaign, Region, SessionPlan, SessionPlanLibraryLink, World
from tests.conftest import make_user


def make_campaign(db: Session, *, name: str = "Windmere") -> Campaign:
    gm = make_user(db, username=f"gm-{name}", role="gm")
    campaign = Campaign(name=name, description="", gm_user_id=gm.id, created_at=datetime.now(UTC))
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return campaign


def test_create_and_read_session_plan(db: Session) -> None:
    campaign = make_campaign(db)
    plan = SessionPlan(
        campaign_id=campaign.id,
        title="Raid on Hillford, Session 1",
        summary="The party arrives in Hillford and hears rumors of the raid.",
        order=1,
        extra=json.dumps({"beats": ["arrival", "rumor gathering"]}),
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)

    fetched = db.get(SessionPlan, plan.id)
    assert fetched is not None
    assert fetched.campaign_id == campaign.id
    assert fetched.title == "Raid on Hillford, Session 1"
    assert fetched.order == 1
    assert json.loads(fetched.extra)["beats"] == ["arrival", "rumor gathering"]


def test_session_plans_are_scoped_to_their_campaign(db: Session) -> None:
    campaign_a = make_campaign(db, name="Windmere")
    campaign_b = make_campaign(db, name="Some Other Campaign")
    now = datetime.now(UTC)
    db.add(
        SessionPlan(
            campaign_id=campaign_a.id, title="Session 1", order=1, created_at=now, updated_at=now
        )
    )
    db.add(
        SessionPlan(
            campaign_id=campaign_b.id, title="Elsewhere", order=1, created_at=now, updated_at=now
        )
    )
    db.commit()

    campaign_a_plans = db.query(SessionPlan).filter(SessionPlan.campaign_id == campaign_a.id).all()
    assert [p.title for p in campaign_a_plans] == ["Session 1"]


def test_session_plan_links_to_library_entity(db: Session) -> None:
    campaign = make_campaign(db)
    world = World(name="Aetheris", created_at=datetime.now(UTC))
    db.add(world)
    db.commit()
    db.refresh(world)

    region = Region(
        world_id=world.id,
        name="Hillford",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    db.add(region)
    db.commit()
    db.refresh(region)

    plan = SessionPlan(
        campaign_id=campaign.id,
        title="Raid on Hillford, Session 1",
        order=1,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)

    link = SessionPlanLibraryLink(
        session_plan_id=plan.id,
        entity_type="region",
        entity_id=region.id,
        created_at=datetime.now(UTC),
    )
    db.add(link)
    db.commit()
    db.refresh(link)

    fetched = db.get(SessionPlanLibraryLink, link.id)
    assert fetched is not None
    assert fetched.session_plan_id == plan.id
    assert fetched.entity_type == "region"
    assert fetched.entity_id == region.id


def test_session_plan_library_link_uniqueness(db: Session) -> None:
    campaign = make_campaign(db)
    now = datetime.now(UTC)
    plan = SessionPlan(
        campaign_id=campaign.id, title="Session 1", order=1, created_at=now, updated_at=now
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)

    link_kwargs = {
        "session_plan_id": plan.id,
        "entity_type": "npc",
        "entity_id": 1,
        "created_at": now,
    }
    db.add(SessionPlanLibraryLink(**link_kwargs))
    db.commit()

    db.add(SessionPlanLibraryLink(**link_kwargs))
    try:
        db.commit()
        raised = False
    except Exception:
        db.rollback()
        raised = True
    assert raised
