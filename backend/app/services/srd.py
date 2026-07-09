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

_DATASET_PATH = Path(__file__).resolve().parent.parent / "data" / "srd" / "character_creation.json"


@lru_cache(maxsize=1)
def get_dataset() -> dict[str, Any]:
    """Return the full SRD character-creation dataset (cached)."""
    return cast(dict[str, Any], json.loads(_DATASET_PATH.read_text(encoding="utf-8")))


@lru_cache(maxsize=1)
def classes_by_name() -> dict[str, dict[str, Any]]:
    return {c["name"]: c for c in get_dataset()["classes"]}


@lru_cache(maxsize=1)
def weapons_by_name() -> dict[str, dict[str, Any]]:
    return {w["name"]: w for w in get_dataset()["weapons_tier1"]}


@lru_cache(maxsize=1)
def armor_names() -> frozenset[str]:
    return frozenset(a["name"] for a in get_dataset()["armor_tier1"])


@lru_cache(maxsize=1)
def ancestry_names() -> frozenset[str]:
    return frozenset(get_dataset()["ancestries"])


@lru_cache(maxsize=1)
def community_names() -> frozenset[str]:
    return frozenset(get_dataset()["communities"])


@lru_cache(maxsize=1)
def trait_names() -> tuple[str, ...]:
    return tuple(get_dataset()["traits"])


@lru_cache(maxsize=1)
def trait_array() -> tuple[int, ...]:
    return tuple(get_dataset()["trait_array"])


@lru_cache(maxsize=1)
def domain_cards_l1_by_key() -> dict[tuple[str, str], dict[str, Any]]:
    """Level-1 domain cards keyed by (domain, name)."""
    return {(c["domain"], c["name"]): c for c in get_dataset()["domain_cards_l1"]}


def subclass_names(class_name: str) -> frozenset[str]:
    cls = classes_by_name().get(class_name)
    if cls is None:
        return frozenset()
    return frozenset(s["name"] for s in cls["subclasses"])
