"""Tests for the SRD/custom-content merge layer (DHCM-27)."""

import json
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.models import CustomArmor, CustomClass, CustomWeapon
from app.services import srd


def _make_custom_class(db: Session, name: str = "Alchemist") -> CustomClass:
    cls = CustomClass(
        name=name,
        domains_json=json.dumps(["Codex", "Midnight"]),
        starting_evasion=9,
        starting_hp=6,
        class_items_json=json.dumps(["A satchel of reagents"]),
        subclasses_json=json.dumps(
            [
                {
                    "name": "Volatile Chemist",
                    "spellcast_trait": "Knowledge",
                    "foundation_features": [{"name": "Unstable Mix", "text": "..."}],
                    "specialization_features": [],
                    "mastery_features": [],
                }
            ]
        ),
        created_at=datetime.now(UTC),
    )
    db.add(cls)
    db.commit()
    return cls


def test_custom_classes_by_name_shapes_match_srd(db: Session) -> None:
    _make_custom_class(db)
    custom = srd.custom_classes_by_name(db)
    assert custom["Alchemist"]["starting_evasion"] == 9
    assert custom["Alchemist"]["subclasses"][0]["name"] == "Volatile Chemist"
    assert custom["Alchemist"]["source"] == "custom"


def test_merged_classes_by_name_includes_both(db: Session) -> None:
    _make_custom_class(db)
    merged = srd.merged_classes_by_name(db)
    assert "Bard" in merged  # SRD entry, untouched
    assert "source" not in merged["Bard"]
    assert "Alchemist" in merged  # custom entry


def test_merged_classes_by_name_no_custom_rows_matches_srd_only(db: Session) -> None:
    merged = srd.merged_classes_by_name(db)
    assert merged == srd.classes_by_name()


def test_custom_armor_converts_threshold_columns_to_base_thresholds(db: Session) -> None:
    db.add(
        CustomArmor(
            name="Reinforced Coat",
            threshold_low=6,
            threshold_high=12,
            base_score=3,
            feature=None,
            created_at=datetime.now(UTC),
        )
    )
    db.commit()
    merged = srd.merged_armor_names(db)
    assert "Reinforced Coat" in merged
    custom = srd.custom_armor_by_name(db)
    assert custom["Reinforced Coat"]["base_thresholds"] == [6, 12]


def test_custom_weapon_is_always_tier_1(db: Session) -> None:
    db.add(
        CustomWeapon(
            name="Storm Lance",
            trait="Strength",
            range="Melee",
            damage="d10 phy",
            burden="Two-Handed",
            is_magic=False,
            feature=None,
            created_at=datetime.now(UTC),
        )
    )
    db.commit()
    merged = srd.merged_weapons_by_name(db)
    assert merged["Storm Lance"]["tier"] == 1


def test_build_validation_context_bundles_merged_lookups(db: Session) -> None:
    _make_custom_class(db)
    context = srd.build_validation_context(db)
    assert "Alchemist" in context["classes"]
    assert isinstance(context["ancestry_names"], frozenset)


def test_merged_dataset_tags_custom_entries_only(db: Session) -> None:
    _make_custom_class(db)
    data = srd.merged_dataset(db)
    srd_class = next(c for c in data["classes"] if c["name"] == "Bard")
    custom_class = next(c for c in data["classes"] if c["name"] == "Alchemist")
    assert "source" not in srd_class
    assert custom_class["source"] == "custom"
