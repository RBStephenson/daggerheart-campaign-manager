"""SRD downtime rest moves (short rest / long rest) applied to a character's
mutable play state.

Distinct from `character_state.CharacterStateUpdate`, which lets a player set
those fields directly (e.g. via UI +/- buttons) — this module derives the new
values itself from a rolled or fixed SRD rest-move result, reusing the same
bounds `character_state` already validates against.

Scope trim: self-targeting only (no ally-healing), no enforcement of the SRD's
"two moves per rest" cap or the short-rest-streak rule, "Work on a Project" and
the GM Fear-pool cost of a rest are both deferred — see DHCM-51.
"""

import json
import random
from typing import Literal

from pydantic import BaseModel

from app.schemas.character_sheet import CharacterSheet
from app.services import srd

_HOPE_MAX = 6
_REST_DIE_SIDES = 4

RestType = Literal["short", "long"]
RestMove = Literal["tend_wounds", "clear_stress", "repair_armor", "prepare"]


class RestRequest(BaseModel):
    model_config = {"extra": "forbid"}

    rest_type: RestType
    move: RestMove


class RestResult(BaseModel):
    """What happened, separate from the character's new state — lets the
    frontend show "you rolled a 3" rather than just the post-clear totals."""

    field: Literal["hp_marked", "stress_marked", "armor_slots_marked", "hope"]
    roll: int | None
    tier: int | None
    amount: int
    new_value: int


def _sheet_for(extra: str) -> CharacterSheet:
    data = json.loads(extra) if extra else {}
    if not isinstance(data, dict) or not data:
        raise ValueError("Character has no completed sheet to rest against")
    return CharacterSheet.model_validate(data)


def apply_rest(
    extra: str,
    level: int,
    current: dict[str, int],
    request: RestRequest,
) -> RestResult:
    """Compute a rest move's result against the character's creation sheet.

    `current` holds the character's present hp_marked/stress_marked/
    armor_slots_marked/hope. Returns the field to update and its new value;
    callers are responsible for persisting it. Raises `ValueError` (translated
    to HTTP 422 by the router) if the character has no completed sheet.
    """
    _sheet_for(extra)

    if request.move == "prepare":
        new_hope = min(current["hope"] + 1, _HOPE_MAX)
        return RestResult(field="hope", roll=None, tier=None, amount=1, new_value=new_hope)

    field = {
        "tend_wounds": "hp_marked",
        "clear_stress": "stress_marked",
        "repair_armor": "armor_slots_marked",
    }[request.move]

    marked_now = current[field]
    if request.rest_type == "long":
        cleared = marked_now
        roll, tier = None, None
    else:
        tier = srd.tier_for_level(level)
        roll = random.randint(1, _REST_DIE_SIDES)
        cleared = min(marked_now, roll + tier)

    return RestResult(
        field=field,  # type: ignore[arg-type]
        roll=roll,
        tier=tier,
        amount=cleared,
        new_value=marked_now - cleared,
    )
