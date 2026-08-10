"""Count assertions against the SRD's own totals.

Same rationale as test_srd_data.py: hand-transcribing (here, script-parsing)
SRD text into JSON can silently drop or merge entries. These tests pin the
SRD's own published counts so a future edit that drops content fails loudly.
"""

from app.services import bestiary

EXPECTED_ADVERSARY_COUNT = 129
EXPECTED_ENVIRONMENT_COUNT = 19

EXPECTED_ADVERSARY_TIER_COUNTS = {1: 52, 2: 36, 3: 23, 4: 18}
EXPECTED_ENVIRONMENT_TIER_COUNTS = {1: 8, 2: 4, 3: 3, 4: 4}

EXPECTED_ADVERSARY_TYPES = {
    "Bruiser", "Horde", "Leader", "Minion", "Ranged", "Skulk",
    "Social", "Solo", "Standard", "Support",
}
EXPECTED_ENVIRONMENT_TYPES = {"Exploration", "Social", "Traversal", "Event"}

# The SRD's own "Horde (X/HP)" annotations -- confirmed by rendering each
# occurrence in the PDF to an image and reading it visually (see DHCM v2's
# Epic 6 notes on the PUA-glyph badge font used for these numbers).
EXPECTED_HORDE_HP_PER_RANK = {
    "GIANT MOSQUITOES": 5,
    "PIRATE RAIDERS": 3,
    "SWARM OF RATS": 10,
    "TANGLE BRAMBLE SWARM": 3,
    "ZOMBIE PACK": 2,
    "ARCHER SQUADRON": 2,
    "DEMONIC HOUND PACK": 1,
    "ELECTRIC EELS": 2,
    "ZOMBIE LEGION": 3,
}


def test_adversary_count() -> None:
    assert len(bestiary.adversaries()) == EXPECTED_ADVERSARY_COUNT


def test_adversary_tier_counts() -> None:
    counts: dict[int, int] = {}
    for a in bestiary.adversaries():
        counts[a["tier"]] = counts.get(a["tier"], 0) + 1
    assert counts == EXPECTED_ADVERSARY_TIER_COUNTS


def test_adversary_types_are_known() -> None:
    assert {a["type"] for a in bestiary.adversaries()} == EXPECTED_ADVERSARY_TYPES


def test_every_adversary_has_features() -> None:
    assert all(a["features"] for a in bestiary.adversaries())


def test_horde_hp_per_rank() -> None:
    hordes = {
        a["name"]: a["horde_hp_per_rank"]
        for a in bestiary.adversaries()
        if a["type"] == "Horde"
    }
    assert hordes == EXPECTED_HORDE_HP_PER_RANK


def test_environment_count() -> None:
    assert len(bestiary.environments()) == EXPECTED_ENVIRONMENT_COUNT


def test_environment_tier_counts() -> None:
    counts: dict[int, int] = {}
    for e in bestiary.environments():
        counts[e["tier"]] = counts.get(e["tier"], 0) + 1
    assert counts == EXPECTED_ENVIRONMENT_TIER_COUNTS


def test_environment_types_are_known() -> None:
    assert {e["type"] for e in bestiary.environments()} == EXPECTED_ENVIRONMENT_TYPES


def test_every_environment_has_features() -> None:
    assert all(e["features"] for e in bestiary.environments())


def test_names_are_unique() -> None:
    assert len(bestiary.adversaries_by_name()) == EXPECTED_ADVERSARY_COUNT
    assert len(bestiary.environments_by_name()) == EXPECTED_ENVIRONMENT_COUNT
