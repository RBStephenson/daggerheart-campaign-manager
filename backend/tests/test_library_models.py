import json
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.models import Adversary, Faction, Npc, Region, World


def make_world(db: Session, *, name: str = "Aetheris") -> World:
    world = World(name=name, created_at=datetime.now(UTC))
    db.add(world)
    db.commit()
    db.refresh(world)
    return world


def test_create_and_read_region(db: Session) -> None:
    world = make_world(db)
    region = Region(
        world_id=world.id,
        name="Hillford",
        summary="A starting town on the frontier.",
        extra=json.dumps({"climate": "temperate", "terrain": "forested hills"}),
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    db.add(region)
    db.commit()
    db.refresh(region)

    fetched = db.get(Region, region.id)
    assert fetched is not None
    assert fetched.world_id == world.id
    assert fetched.name == "Hillford"
    assert json.loads(fetched.extra)["climate"] == "temperate"


def test_create_and_read_faction(db: Session) -> None:
    world = make_world(db)
    faction = Faction(
        world_id=world.id,
        name="The Fleshweavers",
        summary="A cult operating out of Hillford's outskirts.",
        extra=json.dumps({"goals": ["expand influence"], "allies": []}),
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    db.add(faction)
    db.commit()
    db.refresh(faction)

    fetched = db.get(Faction, faction.id)
    assert fetched is not None
    assert fetched.world_id == world.id
    assert fetched.name == "The Fleshweavers"


def test_create_and_read_npc(db: Session) -> None:
    world = make_world(db)
    npc = Npc(
        world_id=world.id,
        name="Winged Kobold Shaman",
        summary="Boss adversary leading the kobold raid.",
        extra=json.dumps({"disposition": "hostile"}),
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    db.add(npc)
    db.commit()
    db.refresh(npc)

    fetched = db.get(Npc, npc.id)
    assert fetched is not None
    assert fetched.world_id == world.id
    assert fetched.name == "Winged Kobold Shaman"


def test_create_and_read_adversary(db: Session) -> None:
    world = make_world(db)
    adversary = Adversary(
        world_id=world.id,
        name="Fleshweaver Thug",
        summary="Standard adversary, Tier 1.",
        extra=json.dumps({"tier": 1, "difficulty": 11, "hp": 5, "stress": 3}),
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    db.add(adversary)
    db.commit()
    db.refresh(adversary)

    fetched = db.get(Adversary, adversary.id)
    assert fetched is not None
    assert fetched.world_id == world.id
    assert json.loads(fetched.extra)["tier"] == 1


def test_library_entities_are_scoped_to_their_world(db: Session) -> None:
    world_a = make_world(db, name="Aetheris")
    world_b = make_world(db, name="Some Other World")
    now = datetime.now(UTC)
    db.add(Region(world_id=world_a.id, name="Hillford", created_at=now, updated_at=now))
    db.add(Region(world_id=world_b.id, name="Elsewhere", created_at=now, updated_at=now))
    db.commit()

    world_a_regions = db.query(Region).filter(Region.world_id == world_a.id).all()
    assert [r.name for r in world_a_regions] == ["Hillford"]
