"""Unit tests for the Battle Points budget formula (SRD verbatim)."""

from app.services.encounter_budget import BudgetAdjustments, calculate_budget


def test_base_formula_matches_srd() -> None:
    # (3 x party size) + 2
    assert calculate_budget(4, BudgetAdjustments()) == 14
    assert calculate_budget(1, BudgetAdjustments()) == 5
    assert calculate_budget(6, BudgetAdjustments()) == 20


def test_easier_fight_subtracts_one() -> None:
    assert calculate_budget(4, BudgetAdjustments(easier_fight=True)) == 13


def test_two_plus_solos_subtracts_two() -> None:
    assert calculate_budget(4, BudgetAdjustments(two_plus_solos=True)) == 12


def test_bonus_damage_subtracts_two() -> None:
    assert calculate_budget(4, BudgetAdjustments(bonus_damage=True)) == 12


def test_lower_tier_adversary_adds_one() -> None:
    assert calculate_budget(4, BudgetAdjustments(lower_tier_adversary=True)) == 15


def test_no_big_adversaries_adds_one() -> None:
    assert calculate_budget(4, BudgetAdjustments(no_bruiser_horde_leader_solo=True)) == 15


def test_harder_fight_adds_two() -> None:
    assert calculate_budget(4, BudgetAdjustments(harder_fight=True)) == 16


def test_all_adjustments_combine() -> None:
    adjustments = BudgetAdjustments(
        easier_fight=True,
        two_plus_solos=True,
        bonus_damage=True,
        lower_tier_adversary=True,
        no_bruiser_horde_leader_solo=True,
        harder_fight=True,
    )
    # 14 - 1 - 2 - 2 + 1 + 1 + 2 = 13
    assert calculate_budget(4, adjustments) == 13


def test_zero_party_size() -> None:
    assert calculate_budget(0, BudgetAdjustments()) == 2
