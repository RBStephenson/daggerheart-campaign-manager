"""Pydantic schema validating updates to a Character's mutable play state.

Distinct from `character_sheet.CharacterSheet`, which validates the
immutable Level 1 creation snapshot in `Character.extra`. This module
validates the state a character accrues during play — marked HP/Stress,
current Hope, marked Armor Slots — against the bounds that snapshot
implies (hp_max, stress_max, the equipped armor's Armor Score), so a
player can't mark more HP than they have or overspend Hope past 6.
"""

import json

from pydantic import BaseModel, Field

from app.schemas.character_sheet import CharacterSheet
from app.services import srd

_HOPE_MAX = 6


class CharacterStateUpdate(BaseModel):
    """Partial update — only the fields present are validated and applied."""

    model_config = {"extra": "forbid"}

    hp_marked: int | None = Field(default=None, ge=0)
    stress_marked: int | None = Field(default=None, ge=0)
    hope: int | None = Field(default=None, ge=0, le=_HOPE_MAX)
    armor_slots_marked: int | None = Field(default=None, ge=0)


def armor_score(sheet: CharacterSheet) -> int:
    armor = srd.armor_by_name().get(sheet.equipment.armor)
    if armor is None:
        # Sheet passed CharacterSheet validation, so this can't happen —
        # guard anyway rather than let a KeyError leak as a 500.
        return 0
    return int(armor["base_score"])


def validate_state_update(extra: str, update: CharacterStateUpdate) -> None:
    """Validate a state update against the character's creation sheet.

    Raises `ValueError` (including via pydantic's `CharacterSheet` parse) if
    `extra` isn't a completed sheet, or if any provided field would exceed
    the bounds that sheet implies. Callers translate this into HTTP 422.
    """
    data = json.loads(extra) if extra else {}
    if not isinstance(data, dict) or not data:
        raise ValueError("Character has no completed sheet to track play state against")
    sheet = CharacterSheet.model_validate(data)

    if update.hp_marked is not None and update.hp_marked > sheet.hp_max:
        raise ValueError(f"hp_marked can't exceed hp_max ({sheet.hp_max})")
    if update.stress_marked is not None and update.stress_marked > sheet.stress_max:
        raise ValueError(f"stress_marked can't exceed stress_max ({sheet.stress_max})")
    if update.armor_slots_marked is not None:
        score = armor_score(sheet)
        if update.armor_slots_marked > score:
            raise ValueError(f"armor_slots_marked can't exceed Armor Score ({score})")
