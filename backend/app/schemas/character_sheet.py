"""Pydantic schema validating a Level 1 Daggerheart character sheet.

This mirrors the JSON stored in `Character.extra`. Validation is cross-checked
against the SRD dataset (`app.services.srd`) so a stored sheet is always a
mechanically-valid Level 1 PC: the class/subclass/heritage exist, traits are the
canonical array, derived stats match the class, domain cards come from the class's
domains, and equipment is drawn from the Tier 1 tables.

Scope note: only *primary* Tier 1 weapons are encoded, so `secondary_weapon` is
validated against that same table with the one-handed constraint; the dedicated
SRD secondary-weapon table and full feature-card prose are deferred.
"""

import json
from typing import Any

from pydantic import BaseModel, Field, model_validator

from app.services import srd

# Fixed Level 1 starting values (SRD "Record Additional Character Information").
_LEVEL = 1
_STRESS_MAX = 6
_HOPE = 2
_PROFICIENCY = 1
_EXPERIENCE_MODIFIER = 2


class Heritage(BaseModel):
    ancestry: str
    community: str


class Experience(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    modifier: int


class DomainCardRef(BaseModel):
    domain: str
    name: str


class Equipment(BaseModel):
    primary_weapon: str
    secondary_weapon: str | None = None
    armor: str


class CharacterSheet(BaseModel):
    """Full Level 1 character sheet, stored serialized in `Character.extra`."""

    model_config = {"extra": "forbid"}

    char_class: str
    subclass: str
    heritage: Heritage
    traits: dict[str, int]
    evasion: int
    hp_max: int
    stress_max: int = _STRESS_MAX
    hope: int = _HOPE
    proficiency: int = _PROFICIENCY
    level: int = _LEVEL
    experiences: list[Experience]
    domain_cards: list[DomainCardRef]
    equipment: Equipment
    inventory: list[str] = Field(default_factory=list)
    background: dict[str, Any] | None = None
    connections: list[str] = Field(default_factory=list)
    description: dict[str, Any] | None = None
    gold_handfuls: int = Field(default=1, ge=0)

    @model_validator(mode="after")
    def _validate_against_srd(self) -> "CharacterSheet":
        cls = srd.classes_by_name().get(self.char_class)
        if cls is None:
            raise ValueError(f"Unknown class: {self.char_class!r}")

        if self.subclass not in srd.subclass_names(self.char_class):
            raise ValueError(f"{self.subclass!r} is not a subclass of {self.char_class}")

        if self.heritage.ancestry not in srd.ancestry_names():
            raise ValueError(f"Unknown ancestry: {self.heritage.ancestry!r}")
        if self.heritage.community not in srd.community_names():
            raise ValueError(f"Unknown community: {self.heritage.community!r}")

        # Traits: exactly the six named traits, values a permutation of the array.
        expected_traits = set(srd.trait_names())
        if set(self.traits) != expected_traits:
            raise ValueError(f"Traits must be exactly {sorted(expected_traits)}")
        if sorted(self.traits.values()) != sorted(srd.trait_array()):
            raise ValueError(f"Trait values must be a permutation of {list(srd.trait_array())}")

        # Derived / fixed Level 1 stats.
        if self.evasion != cls["starting_evasion"]:
            raise ValueError(f"Evasion for {self.char_class} must be {cls['starting_evasion']}")
        if self.hp_max != cls["starting_hp"]:
            raise ValueError(f"HP for {self.char_class} must be {cls['starting_hp']}")
        if self.stress_max != _STRESS_MAX:
            raise ValueError(f"Stress must be {_STRESS_MAX} at Level 1")
        if self.hope != _HOPE:
            raise ValueError(f"Hope must be {_HOPE} at Level 1")
        if self.proficiency != _PROFICIENCY:
            raise ValueError(f"Proficiency must be {_PROFICIENCY} at Level 1")
        if self.level != _LEVEL:
            raise ValueError("Character creation produces a Level 1 character")

        # Experiences: two, each with the +2 creation modifier.
        if len(self.experiences) != 2:
            raise ValueError("A new character has exactly two Experiences")
        for exp in self.experiences:
            if exp.modifier != _EXPERIENCE_MODIFIER:
                raise ValueError(f"Experience modifiers are +{_EXPERIENCE_MODIFIER} at creation")

        # Domain cards: two, from the class's domains, existing Level 1 cards.
        if len(self.domain_cards) != 2:
            raise ValueError("Choose exactly two domain cards")
        class_domains = set(cls["domains"])
        cards = srd.domain_cards_l1_by_key()
        for card in self.domain_cards:
            if card.domain not in class_domains:
                raise ValueError(
                    f"{self.char_class} cannot take {card.domain} cards "
                    f"(domains: {sorted(class_domains)})"
                )
            if (card.domain, card.name) not in cards:
                raise ValueError(f"Unknown Level 1 {card.domain} card: {card.name!r}")

        # Equipment: primary/secondary weapons and armor from the Tier 1 tables.
        weapons = srd.weapons_by_name()
        primary = weapons.get(self.equipment.primary_weapon)
        if primary is None:
            raise ValueError(f"Unknown Tier 1 weapon: {self.equipment.primary_weapon!r}")
        if self.equipment.secondary_weapon is not None:
            if primary["burden"] == "Two-Handed":
                raise ValueError("A two-handed primary weapon leaves no hand for a secondary")
            secondary = weapons.get(self.equipment.secondary_weapon)
            if secondary is None:
                raise ValueError(f"Unknown Tier 1 weapon: {self.equipment.secondary_weapon!r}")
            if secondary["burden"] != "One-Handed":
                raise ValueError("A secondary weapon must be one-handed")
        if self.equipment.armor not in srd.armor_names():
            raise ValueError(f"Unknown Tier 1 armor: {self.equipment.armor!r}")

        return self


def validate_extra(extra: str | None) -> None:
    """Validate a `Character.extra` value as a CharacterSheet, when populated.

    An empty value (``None``, ``""``, or ``"{}"``) is allowed for backward
    compatibility with the flat character form, which never populates a sheet.
    A non-empty object must validate fully as a `CharacterSheet`.

    Raises `ValueError` / `pydantic.ValidationError` on invalid content; callers
    translate these into HTTP 422.
    """
    if not extra:
        return
    try:
        data = json.loads(extra)
    except json.JSONDecodeError as e:
        raise ValueError(f"extra is not valid JSON: {e}") from e
    if not isinstance(data, dict) or not data:
        return
    CharacterSheet.model_validate(data)
