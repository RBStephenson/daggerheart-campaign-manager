"""Loader and typed accessors for the Daggerheart SRD character-creation dataset.

The canonical data lives in `app/data/srd/character_creation.json` (structured
mechanical data + names transcribed from the SRD). This module loads it once and
exposes lookup helpers used both by the `CharacterSheet` validators and by the
`/api/srd/character-creation` endpoint that serves the raw dataset to the frontend.
"""

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, cast

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

_DATASET_PATH = Path(__file__).resolve().parent.parent / "data" / "srd" / "character_creation.json"


@lru_cache(maxsize=1)
def get_dataset() -> dict[str, Any]:
    """Return the full SRD character-creation dataset (cached)."""
    return cast(dict[str, Any], json.loads(_DATASET_PATH.read_text(encoding="utf-8")))


@lru_cache(maxsize=1)
def classes_by_name() -> dict[str, dict[str, Any]]:
    return {c["name"]: c for c in get_dataset()["classes"]}


@lru_cache(maxsize=1)
def primary_weapons() -> tuple[dict[str, Any], ...]:
    """All primary weapons (tiers 1-4, physical and magic)."""
    return tuple(get_dataset()["primary_weapons"])


@lru_cache(maxsize=1)
def secondary_weapons() -> tuple[dict[str, Any], ...]:
    """All secondary weapons (tiers 1-4)."""
    return tuple(get_dataset()["secondary_weapons"])


@lru_cache(maxsize=1)
def armor() -> tuple[dict[str, Any], ...]:
    """All armor (tiers 1-4)."""
    return tuple(get_dataset()["armor"])


@lru_cache(maxsize=1)
def combat_wheelchair() -> tuple[dict[str, Any], ...]:
    """The Combat Wheelchair ruleset (light/heavy/arcane frames, tiers 1-4)."""
    return tuple(get_dataset()["combat_wheelchair"])


@lru_cache(maxsize=1)
def weapons_by_name() -> dict[str, dict[str, Any]]:
    """Tier 1 primary weapons only — the only tier available at character
    creation."""
    return {w["name"]: w for w in primary_weapons() if w["tier"] == 1}


@lru_cache(maxsize=1)
def armor_names() -> frozenset[str]:
    """Tier 1 armor only — the only tier available at character creation."""
    return frozenset(a["name"] for a in armor() if a["tier"] == 1)


@lru_cache(maxsize=1)
def armor_by_name() -> dict[str, dict[str, Any]]:
    """All armor (every tier) keyed by name — names are unique across tiers."""
    return {a["name"]: a for a in armor()}


@lru_cache(maxsize=1)
def ancestries_by_name() -> dict[str, dict[str, Any]]:
    return {a["name"]: a for a in get_dataset()["ancestries"]}


@lru_cache(maxsize=1)
def ancestry_names() -> frozenset[str]:
    return frozenset(ancestries_by_name())


@lru_cache(maxsize=1)
def communities_by_name() -> dict[str, dict[str, Any]]:
    return {c["name"]: c for c in get_dataset()["communities"]}


@lru_cache(maxsize=1)
def community_names() -> frozenset[str]:
    return frozenset(communities_by_name())


@lru_cache(maxsize=1)
def trait_names() -> tuple[str, ...]:
    return tuple(get_dataset()["traits"])


@lru_cache(maxsize=1)
def trait_array() -> tuple[int, ...]:
    return tuple(get_dataset()["trait_array"])


@lru_cache(maxsize=1)
def domain_cards() -> tuple[dict[str, Any], ...]:
    """All domain cards (all 9 domains, levels 1-10)."""
    return tuple(get_dataset()["domain_cards"])


@lru_cache(maxsize=1)
def domain_cards_l1_by_key() -> dict[tuple[str, str], dict[str, Any]]:
    """Level-1 domain cards keyed by (domain, name) — the only level a new
    character can choose from at creation."""
    return {(c["domain"], c["name"]): c for c in domain_cards() if c["level"] == 1}


@lru_cache(maxsize=1)
def beastform_options() -> tuple[dict[str, Any], ...]:
    """All Druid Beastform options (tiers 1-4, 24 categories)."""
    return tuple(get_dataset()["beastform_options"])


@lru_cache(maxsize=1)
def loot() -> tuple[dict[str, Any], ...]:
    """The Loot table (60 entries, roll 1-60)."""
    return tuple(get_dataset()["loot"])


@lru_cache(maxsize=1)
def consumables() -> tuple[dict[str, Any], ...]:
    """The Consumables table (60 entries, roll 1-60)."""
    return tuple(get_dataset()["consumables"])


def subclass_names(class_name: str) -> frozenset[str]:
    cls = classes_by_name().get(class_name)
    if cls is None:
        return frozenset()
    return frozenset(s["name"] for s in cls["subclasses"])


def tier_for_level(level: int) -> int:
    """SRD tier for a character level: Tier 1 is level 1, Tier 2 is 2-4,
    Tier 3 is 5-7, Tier 4 is 8-10."""
    if level <= 1:
        return 1
    if level <= 4:
        return 2
    if level <= 7:
        return 3
    return 4


# --- Custom content (DHCM-20/DHCM-27) --------------------------------------
#
# Host-authored content lives in the `custom_*` DB tables (DHCM-26) and is
# merged with the static SRD dataset here, at request time. These accessors
# are deliberately *not* `@lru_cache`d like the pure-SRD ones above: a DB
# session isn't safe to cache across requests, and character creation isn't a
# hot path, so a fresh query per call is the simpler and correct choice.
# Every dict below matches the shape of its SRD-dataset counterpart, and
# custom entries are tagged `"source": "custom"` so callers (and the
# character-creation wizard) can distinguish them from SRD-sourced entries.


def custom_classes_by_name(db: Session) -> dict[str, dict[str, Any]]:
    return {
        c.name: {
            "name": c.name,
            "domains": json.loads(c.domains_json),
            "starting_evasion": c.starting_evasion,
            "starting_hp": c.starting_hp,
            "class_items": json.loads(c.class_items_json),
            "subclasses": json.loads(c.subclasses_json),
            "source": "custom",
        }
        for c in db.query(CustomClass).all()
    }


def custom_ancestries_by_name(db: Session) -> dict[str, dict[str, Any]]:
    return {
        a.name: {
            "name": a.name,
            "features": json.loads(a.features_json),
            "source": "custom",
        }
        for a in db.query(CustomAncestry).all()
    }


def custom_communities_by_name(db: Session) -> dict[str, dict[str, Any]]:
    return {
        c.name: {
            "name": c.name,
            "adjectives": json.loads(c.adjectives_json),
            "feature": json.loads(c.feature_json),
            "source": "custom",
        }
        for c in db.query(CustomCommunity).all()
    }


def custom_domains_by_name(db: Session) -> dict[str, dict[str, Any]]:
    return {
        d.name: {
            "name": d.name,
            "classes": json.loads(d.classes_json),
            "source": "custom",
        }
        for d in db.query(CustomDomain).all()
    }


def custom_domain_cards_l1_by_key(db: Session) -> dict[tuple[str, str], dict[str, Any]]:
    """Custom domain cards are always Level 1 (the only level DHCM-26 scoped)."""
    return {
        (c.domain, c.name): {
            "domain": c.domain,
            "level": 1,
            "name": c.name,
            "type": c.type,
            "recall_cost": c.recall_cost,
            "source": "custom",
        }
        for c in db.query(CustomDomainCard).all()
    }


def custom_weapons_by_name(db: Session) -> dict[str, dict[str, Any]]:
    """Custom weapons are always Tier 1 (the only tier available at creation)."""
    return {
        w.name: {
            "tier": 1,
            "name": w.name,
            "trait": w.trait,
            "range": w.range,
            "damage": w.damage,
            "burden": w.burden,
            "is_magic": w.is_magic,
            "feature": w.feature,
            "source": "custom",
        }
        for w in db.query(CustomWeapon).all()
    }


def custom_armor_by_name(db: Session) -> dict[str, dict[str, Any]]:
    """Custom armor is always Tier 1 (the only tier available at creation)."""
    return {
        a.name: {
            "tier": 1,
            "name": a.name,
            "base_thresholds": [a.threshold_low, a.threshold_high],
            "base_score": a.base_score,
            "feature": a.feature,
            "source": "custom",
        }
        for a in db.query(CustomArmor).all()
    }


def merged_classes_by_name(db: Session) -> dict[str, dict[str, Any]]:
    return {**classes_by_name(), **custom_classes_by_name(db)}


def merged_ancestry_names(db: Session) -> frozenset[str]:
    return ancestry_names() | frozenset(custom_ancestries_by_name(db))


def merged_community_names(db: Session) -> frozenset[str]:
    return community_names() | frozenset(custom_communities_by_name(db))


def merged_domain_cards_l1_by_key(db: Session) -> dict[tuple[str, str], dict[str, Any]]:
    return {**domain_cards_l1_by_key(), **custom_domain_cards_l1_by_key(db)}


def merged_weapons_by_name(db: Session) -> dict[str, dict[str, Any]]:
    return {**weapons_by_name(), **custom_weapons_by_name(db)}


def merged_armor_names(db: Session) -> frozenset[str]:
    return armor_names() | frozenset(custom_armor_by_name(db))


def build_validation_context(db: Session) -> dict[str, Any]:
    """Bundle the merged lookups `CharacterSheet` needs, for use as Pydantic
    `model_validate(..., context=...)`. Built once per validation call rather
    than having the validator query the DB itself, since Pydantic validators
    don't otherwise have a clean way to receive a `Session`."""
    return {
        "classes": merged_classes_by_name(db),
        "ancestry_names": merged_ancestry_names(db),
        "community_names": merged_community_names(db),
        "domain_cards_l1": merged_domain_cards_l1_by_key(db),
        "weapons": merged_weapons_by_name(db),
        "armor_names": merged_armor_names(db),
    }


def merged_dataset(db: Session) -> dict[str, Any]:
    """Full character-creation dataset with custom entries appended to each
    relevant list, for the `/api/srd/character-creation` endpoint."""
    data = dict(get_dataset())
    data["classes"] = [*data["classes"], *custom_classes_by_name(db).values()]
    data["ancestries"] = [*data["ancestries"], *custom_ancestries_by_name(db).values()]
    data["communities"] = [*data["communities"], *custom_communities_by_name(db).values()]
    data["domains"] = [*data["domains"], *custom_domains_by_name(db).values()]
    data["domain_cards"] = [*data["domain_cards"], *custom_domain_cards_l1_by_key(db).values()]
    data["primary_weapons"] = [*data["primary_weapons"], *custom_weapons_by_name(db).values()]
    data["armor"] = [*data["armor"], *custom_armor_by_name(db).values()]
    return data
