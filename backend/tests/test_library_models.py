import json
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.models import Adversary, Continent, Faction, Location, Npc, Region, World


def make_world(db: Session, *, name: str = "Aetheris") -> World:
    world = World(name=name, created_at=datetime.now(UTC))
    db.add(world)
    db.commit()
    db.refresh(world)
    return world


def make_continent(db: Session, *, world: World | None = None, name: str = "Tharivor") -> Continent:
    world = world or make_world(db)
    continent = Continent(
        world_id=world.id,
        name=name,
        kind="primary continent",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    db.add(continent)
    db.commit()
    db.refresh(continent)
    return continent


def make_region(
    db: Session, *, continent: Continent | None = None, name: str = "Hillford Valley"
) -> Region:
    continent = continent or make_continent(db)
    region = Region(
        continent_id=continent.id,
        name=name,
        kind="river valley",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    db.add(region)
    db.commit()
    db.refresh(region)
    return region


def test_create_and_read_continent(db: Session) -> None:
    world = make_world(db)
    continent = Continent(
        world_id=world.id,
        name="Tharivor",
        summary="The primary continent of Aetheris.",
        extra=json.dumps({"climate_zones": ["ash forest", "jungle", "wasteland"]}),
        kind="primary continent",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    db.add(continent)
    db.commit()
    db.refresh(continent)

    fetched = db.get(Continent, continent.id)
    assert fetched is not None
    assert fetched.world_id == world.id
    assert fetched.name == "Tharivor"
    assert fetched.kind == "primary continent"
    assert json.loads(fetched.extra)["climate_zones"] == ["ash forest", "jungle", "wasteland"]


def test_create_and_read_region(db: Session) -> None:
    continent = make_continent(db)
    region = Region(
        continent_id=continent.id,
        name="Hillford Valley",
        summary="A river valley between Stormhold and the Shattered Coast.",
        extra=json.dumps({"climate": "temperate", "terrain": "river valley"}),
        kind="river valley",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    db.add(region)
    db.commit()
    db.refresh(region)

    fetched = db.get(Region, region.id)
    assert fetched is not None
    assert fetched.continent_id == continent.id
    assert fetched.name == "Hillford Valley"
    assert fetched.kind == "river valley"
    assert json.loads(fetched.extra)["climate"] == "temperate"


def test_create_and_read_location(db: Session) -> None:
    region = make_region(db)
    location = Location(
        region_id=region.id,
        name="Hillford",
        summary="A starting town on the frontier.",
        extra=json.dumps({"population": "small"}),
        kind="town",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    db.add(location)
    db.commit()
    db.refresh(location)

    fetched = db.get(Location, location.id)
    assert fetched is not None
    assert fetched.region_id == region.id
    assert fetched.name == "Hillford"
    assert fetched.kind == "town"
    assert json.loads(fetched.extra)["population"] == "small"


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
    db.add(Faction(world_id=world_a.id, name="Hillford Faction", created_at=now, updated_at=now))
    db.add(Faction(world_id=world_b.id, name="Elsewhere Faction", created_at=now, updated_at=now))
    db.commit()

    world_a_factions = db.query(Faction).filter(Faction.world_id == world_a.id).all()
    assert [f.name for f in world_a_factions] == ["Hillford Faction"]


def test_regions_are_scoped_to_their_continent(db: Session) -> None:
    continent_a = make_continent(db, name="Tharivor")
    continent_b = make_continent(db, name="Elsewhere")
    now = datetime.now(UTC)
    db.add(
        Region(continent_id=continent_a.id, name="Hillford Valley", created_at=now, updated_at=now)
    )
    db.add(
        Region(
            continent_id=continent_b.id, name="Some Other Region", created_at=now, updated_at=now
        )
    )
    db.commit()

    continent_a_regions = db.query(Region).filter(Region.continent_id == continent_a.id).all()
    assert [r.name for r in continent_a_regions] == ["Hillford Valley"]


def test_locations_are_scoped_to_their_region(db: Session) -> None:
    region_a = make_region(db, name="Hillford Valley")
    region_b = make_region(db, name="Some Other Region")
    now = datetime.now(UTC)
    db.add(Location(region_id=region_a.id, name="Hillford", created_at=now, updated_at=now))
    db.add(Location(region_id=region_b.id, name="Elsewhere", created_at=now, updated_at=now))
    db.commit()

    region_a_locations = db.query(Location).filter(Location.region_id == region_a.id).all()
    assert [loc.name for loc in region_a_locations] == ["Hillford"]
