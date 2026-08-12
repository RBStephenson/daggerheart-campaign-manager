"""Quick-generate assist for GM live play: names, NPC sketches, loot.

Loosely inspired by LGMRD's generator toolkit but not a port of its tables —
per this project's "source material is a guideline, not a spec" convention
(see the DHCM vault note). Every function returns a fresh random suggestion
the GM can accept, edit, or ignore; nothing here persists anything.
"""

import random
from typing import Any

from app.services import srd

_NAME_SYLLABLES = (
    "Ash", "Bren", "Cor", "Dal", "Eir", "Fen", "Gar", "Hal", "Ith", "Jor",
    "Kel", "Lor", "Mir", "Nor", "Or", "Pel", "Quor", "Ren", "Sar", "Tol",
    "Ur", "Vel", "Wyn", "Yor", "Zeph",
)
_NAME_ENDINGS = ("an", "ir", "eth", "ok", "ara", "in", "us", "el", "ora", "yn")

_NPC_ROLES = (
    "innkeeper", "merchant", "guard captain", "wandering scholar", "beggar",
    "smuggler", "priest", "blacksmith", "courier", "mercenary", "farmer",
    "noble's steward", "healer", "gravedigger", "fortune teller", "sailor",
)
_NPC_MOTIVATIONS = (
    "wants out of debt", "is hiding from their past", "seeks revenge",
    "is loyal to a fault", "craves recognition", "protects a secret family",
    "is planning to skip town", "worships someone unworthy of it",
    "is quietly dying of a curse", "wants to be left alone",
    "is obsessed with a lost love", "is an informant for someone dangerous",
)
_NPC_QUIRKS = (
    "never makes eye contact", "hums constantly", "collects buttons",
    "speaks only in questions", "flinches at loud noises",
    "always smells of woodsmoke", "counts everything under their breath",
    "refuses to sit with their back to a door", "laughs at bad news",
    "has a pet that never leaves their shoulder", "over-explains everything",
    "goes silent when lying",
)


def generate_name(ancestry: str | None = None) -> dict[str, Any]:
    """A random name, optionally themed to a known SRD ancestry."""
    if ancestry is not None and ancestry not in srd.ancestry_names():
        ancestry = None
    name = random.choice(_NAME_SYLLABLES) + random.choice(_NAME_ENDINGS)
    return {"kind": "name", "name": name, "ancestry": ancestry}


def generate_npc_sketch() -> dict[str, Any]:
    """A minimal NPC sketch: name, role, motivation, quirk."""
    name_result = generate_name()
    return {
        "kind": "npc",
        "name": name_result["name"],
        "role": random.choice(_NPC_ROLES),
        "motivation": random.choice(_NPC_MOTIVATIONS),
        "quirk": random.choice(_NPC_QUIRKS),
    }


def generate_loot(party_tier: int | None = None) -> dict[str, Any]:
    """A random loot or consumable item.

    The SRD's own loot/consumable tables aren't tier-differentiated, so
    `party_tier` is accepted (matches the GM-facing intent of "roughly
    appropriate to party tier") but not currently used to filter — kept as
    a hook if a tiered dataset is added later.
    """
    del party_tier
    table = random.choice((srd.loot(), srd.consumables()))
    item = random.choice(table)
    return {"kind": "loot", "name": item["name"], "description": item["description"]}


_GENERATORS = {
    "name": generate_name,
    "npc": generate_npc_sketch,
    "loot": generate_loot,
}


def generate(kind: str, **kwargs: Any) -> dict[str, Any]:
    """Dispatch to the generator for `kind`. Raises KeyError if unknown."""
    return _GENERATORS[kind](**kwargs)
