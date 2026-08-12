"""Unit tests for the pure generator functions."""

from app.services import generators


def test_generate_name_is_well_formed() -> None:
    for _ in range(20):
        result = generators.generate_name()
        assert isinstance(result["name"], str) and result["name"]


def test_generate_name_rejects_unknown_ancestry() -> None:
    result = generators.generate_name(ancestry="Klingon")
    assert result["ancestry"] is None


def test_generate_name_accepts_known_ancestry() -> None:
    result = generators.generate_name(ancestry="Human")
    assert result["ancestry"] == "Human"


def test_generate_npc_sketch_has_all_fields() -> None:
    for _ in range(20):
        sketch = generators.generate_npc_sketch()
        assert sketch["kind"] == "npc"
        assert all(sketch[field] for field in ("name", "role", "motivation", "quirk"))


def test_generate_loot_across_tiers() -> None:
    for tier in (None, 1, 2, 3, 4, 99):
        item = generators.generate_loot(party_tier=tier)
        assert item["kind"] == "loot"
        assert item["name"] and item["description"]


def test_generate_dispatch() -> None:
    assert generators.generate("name")["kind"] == "name"
    assert generators.generate("npc")["kind"] == "npc"
    assert generators.generate("loot")["kind"] == "loot"
