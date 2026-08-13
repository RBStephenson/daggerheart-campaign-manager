"""Battle Points encounter-difficulty math (Daggerheart SRD).

Formula transcribed verbatim from the SRD PDF's "Building Balanced
Encounters" section (see this project's PyMuPDF-vs-pdftotext gotcha).
Advisory only — nothing here enforces a hard limit on adversary picks.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class BudgetAdjustments:
    easier_fight: bool = False
    two_plus_solos: bool = False
    bonus_damage: bool = False
    lower_tier_adversary: bool = False
    no_bruiser_horde_leader_solo: bool = False
    harder_fight: bool = False


# Battle Point cost per SRD adversary `type`. Minions are priced per group
# (sized to the party), not per individual adversary — callers spending on a
# Minion group should count it once regardless of party size.
COST_BY_TYPE: dict[str, int] = {
    "Minion": 1,
    "Social": 1,
    "Support": 1,
    "Horde": 2,
    "Ranged": 2,
    "Skulk": 2,
    "Standard": 2,
    "Leader": 3,
    "Bruiser": 4,
    "Solo": 5,
}


def calculate_budget(party_size: int, adjustments: BudgetAdjustments) -> int:
    budget = 3 * party_size + 2
    if adjustments.easier_fight:
        budget -= 1
    if adjustments.two_plus_solos:
        budget -= 2
    if adjustments.bonus_damage:
        budget -= 2
    if adjustments.lower_tier_adversary:
        budget += 1
    if adjustments.no_bruiser_horde_leader_solo:
        budget += 1
    if adjustments.harder_fight:
        budget += 2
    return budget
