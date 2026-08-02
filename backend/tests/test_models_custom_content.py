"""Model-level tests for the DHCM-26 custom-content tables.

Mirrors this repo's convention (see test_campaigns.py, test_player.py) of
exercising models through the `db` fixture's Base.metadata.create_all engine
rather than running Alembic migrations in-process; migration 0006 itself is
verified manually via `alembic upgrade head` / `alembic downgrade -1` in the
python:3.12-slim container per this project's no-local-runtime constraint.
"""

import json
from datetime import UTC, datetime

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import (
    CustomAncestry,
    CustomArmor,
    CustomClass,
    CustomCommunity,
    CustomDomain,
    CustomDomainCard,
    CustomWeapon,
)


def _now() -> datetime:
    return datetime.now(UTC)


def test_custom_class_round_trip(db: Session) -> None:
    row = CustomClass(
        name="Alchemist",
        domains_json=json.dumps(["Arcana", "Codex"]),
        starting_evasion=10,
        starting_hp=6,
        class_items_json=json.dumps(["A cracked vial", "A field notebook"]),
        subclasses_json=json.dumps(
            [{"name": "Volatile", "spellcast_trait": "Knowledge"}]
        ),
        created_at=_now(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    assert row.id is not None
    assert json.loads(row.domains_json) == ["Arcana", "Codex"]
    assert json.loads(row.subclasses_json)[0]["name"] == "Volatile"


def test_custom_class_name_unique(db: Session) -> None:
    kwargs = {
        "domains_json": "[]",
        "starting_evasion": 10,
        "starting_hp": 6,
        "class_items_json": "[]",
        "subclasses_json": "[]",
        "created_at": _now(),
    }
    db.add(CustomClass(name="Alchemist", **kwargs))
    db.commit()

    db.add(CustomClass(name="Alchemist", **kwargs))
    with pytest.raises(IntegrityError):
        db.commit()


def test_custom_ancestry_and_community_unique(db: Session) -> None:
    db.add(CustomAncestry(name="Automaton", created_at=_now()))
    db.add(CustomCommunity(name="Forgeborne", created_at=_now()))
    db.commit()

    db.add(CustomAncestry(name="Automaton", created_at=_now()))
    with pytest.raises(IntegrityError):
        db.commit()


def test_custom_domain_round_trip(db: Session) -> None:
    row = CustomDomain(
        name="Ash",
        classes_json=json.dumps(["Alchemist"]),
        created_at=_now(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    assert json.loads(row.classes_json) == ["Alchemist"]


def test_custom_domain_card_unique_on_domain_and_name(db: Session) -> None:
    kwargs = {"type": "spell", "recall_cost": 1, "created_at": _now()}
    db.add(CustomDomainCard(domain="Ash", name="Cinder Step", **kwargs))
    db.commit()

    # Same name, different domain — allowed, matches SRD's (domain, name) key.
    db.add(CustomDomainCard(domain="Arcana", name="Cinder Step", **kwargs))
    db.commit()

    # Same (domain, name) pair — rejected.
    db.add(CustomDomainCard(domain="Ash", name="Cinder Step", **kwargs))
    with pytest.raises(IntegrityError):
        db.commit()


def test_custom_weapon_round_trip(db: Session) -> None:
    row = CustomWeapon(
        name="Ashblade",
        trait="Finesse",
        range="Melee",
        damage="d8+1 mag",
        burden="One-Handed",
        is_magic=True,
        feature=None,
        created_at=_now(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    assert row.is_magic is True
    assert row.feature is None


def test_custom_armor_round_trip(db: Session) -> None:
    row = CustomArmor(
        name="Ashwoven Coat",
        threshold_low=6,
        threshold_high=12,
        base_score=3,
        feature="Flexible: +1 to Evasion",
        created_at=_now(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    assert row.threshold_low == 6
    assert row.threshold_high == 12
