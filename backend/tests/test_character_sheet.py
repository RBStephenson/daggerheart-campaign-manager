"""Validation tests for the SRD dataset and the CharacterSheet schema."""

import copy
from typing import Any

import pytest
from pydantic import ValidationError

from app.schemas.character_sheet import CharacterSheet
from app.services import srd


def valid_bard_sheet() -> dict[str, Any]:
    """A mechanically-valid Level 1 Bard sheet."""
    return {
        "char_class": "Bard",
        "subclass": "Troubadour",
        "heritage": {"ancestry": "Human", "community": "Wanderborne"},
        "traits": {
            "Agility": 2,
            "Strength": 1,
            "Finesse": 1,
            "Instinct": 0,
            "Presence": 0,
            "Knowledge": -1,
        },
        "evasion": 10,
        "hp_max": 5,
        "stress_max": 6,
        "hope": 2,
        "proficiency": 1,
        "level": 1,
        "experiences": [
            {"name": "Storyteller", "modifier": 2},
            {"name": "Charming", "modifier": 2},
        ],
        "domain_cards": [
            {"domain": "Grace", "name": "Enrapture"},
            {"domain": "Codex", "name": "Book of Ava"},
        ],
        "equipment": {
            "primary_weapon": "Rapier",
            "secondary_weapon": "Dagger",
            "armor": "Leather Armor",
        },
        "inventory": ["A torch", "50 feet of rope"],
    }


# --- Dataset sanity ---------------------------------------------------------


def test_dataset_shapes() -> None:
    data = srd.get_dataset()
    assert len(data["classes"]) == 9
    assert len(data["ancestries"]) == 18
    assert len(data["communities"]) == 9
    assert len(data["domains"]) == 9
    assert data["trait_array"] == [2, 1, 1, 0, 0, -1]
    # Every Level 1 domain card references a real domain.
    domain_names = {d["name"] for d in data["domains"]}
    for card in data["domain_cards_l1"]:
        assert card["domain"] in domain_names


# --- Happy path -------------------------------------------------------------


def test_valid_sheet_passes() -> None:
    sheet = CharacterSheet(**valid_bard_sheet())
    assert sheet.char_class == "Bard"
    assert sheet.evasion == 10


def test_two_handed_primary_without_secondary_passes() -> None:
    data = valid_bard_sheet()
    data["equipment"] = {
        "primary_weapon": "Greatstaff",
        "secondary_weapon": None,
        "armor": "Leather Armor",
    }
    # Greatstaff is a magic two-handed weapon; valid with no secondary.
    assert CharacterSheet(**data).equipment.primary_weapon == "Greatstaff"


# --- Failure modes (each rule fails loudly) ---------------------------------


def test_rejects_unknown_class() -> None:
    data = valid_bard_sheet()
    data["char_class"] = "Paladin"
    with pytest.raises(ValidationError, match="Unknown class"):
        CharacterSheet(**data)


def test_rejects_subclass_from_other_class() -> None:
    data = valid_bard_sheet()
    data["subclass"] = "Nightwalker"  # a Rogue subclass
    with pytest.raises(ValidationError, match="not a subclass of Bard"):
        CharacterSheet(**data)


def test_rejects_unknown_ancestry() -> None:
    data = valid_bard_sheet()
    data["heritage"]["ancestry"] = "Cyborg"
    with pytest.raises(ValidationError, match="Unknown ancestry"):
        CharacterSheet(**data)


def test_rejects_wrong_trait_multiset() -> None:
    data = valid_bard_sheet()
    data["traits"] = dict.fromkeys(data["traits"], 0)  # all zeros
    with pytest.raises(ValidationError, match="permutation"):
        CharacterSheet(**data)


def test_rejects_missing_trait() -> None:
    data = valid_bard_sheet()
    del data["traits"]["Knowledge"]
    with pytest.raises(ValidationError, match="Traits must be exactly"):
        CharacterSheet(**data)


def test_rejects_wrong_evasion() -> None:
    data = valid_bard_sheet()
    data["evasion"] = 12
    with pytest.raises(ValidationError, match="Evasion for Bard must be 10"):
        CharacterSheet(**data)


def test_rejects_wrong_hp() -> None:
    data = valid_bard_sheet()
    data["hp_max"] = 7
    with pytest.raises(ValidationError, match="HP for Bard must be 5"):
        CharacterSheet(**data)


def test_rejects_off_class_domain_card() -> None:
    data = valid_bard_sheet()
    data["domain_cards"] = [
        {"domain": "Blade", "name": "Whirlwind"},  # Bard has no Blade access
        {"domain": "Codex", "name": "Book of Ava"},
    ]
    with pytest.raises(ValidationError, match="cannot take Blade cards"):
        CharacterSheet(**data)


def test_rejects_unknown_domain_card_name() -> None:
    data = valid_bard_sheet()
    data["domain_cards"] = [
        {"domain": "Grace", "name": "Fireball"},
        {"domain": "Codex", "name": "Book of Ava"},
    ]
    with pytest.raises(ValidationError, match="Unknown Level 1 Grace card"):
        CharacterSheet(**data)


def test_rejects_wrong_domain_card_count() -> None:
    data = valid_bard_sheet()
    data["domain_cards"] = [{"domain": "Grace", "name": "Enrapture"}]
    with pytest.raises(ValidationError, match="exactly two domain cards"):
        CharacterSheet(**data)


def test_rejects_non_tier1_weapon() -> None:
    data = valid_bard_sheet()
    data["equipment"]["primary_weapon"] = "Excalibur"
    with pytest.raises(ValidationError, match="Unknown Tier 1 weapon"):
        CharacterSheet(**data)


def test_rejects_two_handed_primary_with_secondary() -> None:
    data = valid_bard_sheet()
    data["equipment"] = {
        "primary_weapon": "Longsword",  # two-handed
        "secondary_weapon": "Dagger",
        "armor": "Leather Armor",
    }
    with pytest.raises(ValidationError, match="no hand for a secondary"):
        CharacterSheet(**data)


def test_rejects_two_handed_secondary() -> None:
    data = valid_bard_sheet()
    data["equipment"] = {
        "primary_weapon": "Rapier",  # one-handed
        "secondary_weapon": "Shortbow",  # two-handed
        "armor": "Leather Armor",
    }
    with pytest.raises(ValidationError, match="secondary weapon must be one-handed"):
        CharacterSheet(**data)


def test_rejects_unknown_armor() -> None:
    data = valid_bard_sheet()
    data["equipment"]["armor"] = "Adamantium Plate"
    with pytest.raises(ValidationError, match="Unknown Tier 1 armor"):
        CharacterSheet(**data)


def test_rejects_wrong_experience_modifier() -> None:
    data = valid_bard_sheet()
    data["experiences"][0]["modifier"] = 3
    with pytest.raises(ValidationError, match=r"Experience modifiers are \+2"):
        CharacterSheet(**data)


def test_rejects_wrong_experience_count() -> None:
    data = valid_bard_sheet()
    data["experiences"] = [{"name": "Solo", "modifier": 2}]
    with pytest.raises(ValidationError, match="exactly two Experiences"):
        CharacterSheet(**data)


def test_rejects_unknown_extra_field() -> None:
    data = valid_bard_sheet()
    data["superpower"] = "flight"
    with pytest.raises(ValidationError):
        CharacterSheet(**data)


def test_every_class_valid_baseline() -> None:
    """Each class can produce a valid sheet from its own SRD-derived stats."""
    for cls in srd.get_dataset()["classes"]:
        data = copy.deepcopy(valid_bard_sheet())
        data["char_class"] = cls["name"]
        data["subclass"] = cls["subclasses"][0]["name"]
        data["evasion"] = cls["starting_evasion"]
        data["hp_max"] = cls["starting_hp"]
        # Two domain cards from this class's own domains.
        cards = srd.get_dataset()["domain_cards_l1"]
        picks = []
        for dom in cls["domains"]:
            card = next(c for c in cards if c["domain"] == dom)
            picks.append({"domain": card["domain"], "name": card["name"]})
        data["domain_cards"] = picks
        sheet = CharacterSheet(**data)
        assert sheet.char_class == cls["name"]
