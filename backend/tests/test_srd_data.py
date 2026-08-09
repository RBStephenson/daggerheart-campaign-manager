"""Count assertions against the SRD's own totals.

Hand-transcribing SRD text into JSON can silently drop rows (a missed
feature, a class transcribed with one subclass instead of two). These
tests pin the expected shape per class/subclass so a future edit that
drops content fails loudly instead of shipping a quietly-incomplete
character sheet.
"""

from app.services import srd

EXPECTED_ANCESTRIES = {
    "Clank", "Drakona", "Dwarf", "Elf", "Faerie", "Faun", "Firbolg", "Fungril",
    "Galapa", "Giant", "Goblin", "Halfling", "Human", "Infernis", "Katari",
    "Orc", "Ribbet", "Simiah",
}

EXPECTED_COMMUNITIES = {
    "Highborne", "Loreborne", "Orderborne", "Ridgeborne", "Seaborne",
    "Slyborne", "Underborne", "Wanderborne", "Wildborne",
}

# (class, {subclass: (foundation, specialization, mastery)}) counts, transcribed
# directly from the SRD's per-class subclass sections.
EXPECTED_SUBCLASS_FEATURE_COUNTS = {
    "Bard": {"Troubadour": (1, 1, 1), "Wordsmith": (2, 1, 1)},
    "Druid": {"Warden of the Elements": (1, 1, 1), "Warden of Renewal": (2, 2, 1)},
    "Guardian": {"Stalwart": (2, 2, 2), "Vengeance": (2, 1, 1)},
    "Ranger": {"Beastbound": (1, 2, 2), "Wayfinder": (2, 1, 1)},
    "Rogue": {"Nightwalker": (1, 2, 2), "Syndicate": (1, 1, 1)},
    "Seraph": {"Divine Wielder": (2, 1, 1), "Winged Sentinel": (1, 1, 2)},
    "Sorcerer": {"Elemental Origin": (1, 1, 1), "Primal Origin": (1, 1, 1)},
    "Warrior": {"Call of the Brave": (2, 1, 1), "Call of the Slayer": (1, 1, 1)},
    "Wizard": {"School of Knowledge": (2, 2, 2), "School of War": (2, 2, 2)},
}

EXPECTED_CLASS_FEATURE_COUNTS = {
    "Bard": 1,
    "Druid": 2,
    "Guardian": 1,
    "Ranger": 1,
    "Rogue": 2,
    "Seraph": 1,
    "Sorcerer": 3,
    "Warrior": 2,
    "Wizard": 2,
}

# Guardian and Warrior are the two purely-martial classes — the SRD lists no
# Spellcast Trait for either of their subclasses (unlike every other class).
NON_CASTER_CLASSES = {"Guardian", "Warrior"}


def test_all_nine_classes_present() -> None:
    assert set(srd.classes_by_name()) == set(EXPECTED_CLASS_FEATURE_COUNTS)


def test_every_class_has_a_hope_feature_with_text() -> None:
    for name, cls in srd.classes_by_name().items():
        hope = cls.get("hope_feature")
        assert hope is not None, f"{name} is missing hope_feature"
        assert hope["name"] and hope["text"], f"{name}'s hope_feature is incomplete"
        assert hope["cost"] == 3, f"{name}'s hope_feature should cost 3 Hope"


def test_class_feature_counts_match_srd() -> None:
    for name, expected_count in EXPECTED_CLASS_FEATURE_COUNTS.items():
        features = srd.classes_by_name()[name].get("class_features", [])
        assert len(features) == expected_count, (
            f"{name}: expected {expected_count} class_features, found {len(features)}"
        )
        for feat in features:
            assert feat["name"] and feat["text"], f"{name} has an incomplete class feature"


def test_subclass_feature_counts_match_srd() -> None:
    for class_name, subclasses in EXPECTED_SUBCLASS_FEATURE_COUNTS.items():
        cls = srd.classes_by_name()[class_name]
        assert len(cls["subclasses"]) == 2, f"{class_name}: expected 2 subclasses"
        by_name = {s["name"]: s for s in cls["subclasses"]}
        assert set(by_name) == set(subclasses), f"{class_name}: subclass names mismatch"

        for sub_name, (n_foundation, n_specialization, n_mastery) in subclasses.items():
            sub = by_name[sub_name]
            if class_name in NON_CASTER_CLASSES:
                assert sub["spellcast_trait"] is None, (
                    f"{class_name}/{sub_name} is martial-only and should have no spellcast_trait"
                )
            else:
                assert sub["spellcast_trait"], f"{class_name}/{sub_name} missing spellcast_trait"
            assert len(sub.get("foundation_features", [])) == n_foundation, (
                f"{class_name}/{sub_name}: expected {n_foundation} foundation features"
            )
            assert len(sub.get("specialization_features", [])) == n_specialization, (
                f"{class_name}/{sub_name}: expected {n_specialization} specialization features"
            )
            assert len(sub.get("mastery_features", [])) == n_mastery, (
                f"{class_name}/{sub_name}: expected {n_mastery} mastery features"
            )
            for tier in ("foundation_features", "specialization_features", "mastery_features"):
                for feat in sub.get(tier, []):
                    assert feat["name"] and feat["text"], (
                        f"{class_name}/{sub_name} has an incomplete {tier} entry"
                    )


def test_all_eighteen_ancestries_have_two_features() -> None:
    ancestries = srd.ancestries_by_name()
    assert set(ancestries) == EXPECTED_ANCESTRIES
    for name, ancestry in ancestries.items():
        features = ancestry.get("features", [])
        assert len(features) == 2, f"{name}: expected 2 ancestry features, found {len(features)}"
        for feat in features:
            assert feat["name"] and feat["text"], f"{name} has an incomplete ancestry feature"


def test_mixed_ancestry_rules_present() -> None:
    mixed = srd.get_dataset().get("mixed_ancestry")
    assert mixed is not None
    assert mixed["name"] and mixed["text"]


def test_all_nine_communities_have_a_feature_and_six_adjectives() -> None:
    communities = srd.communities_by_name()
    assert set(communities) == EXPECTED_COMMUNITIES
    for name, community in communities.items():
        adjectives = community.get("adjectives", [])
        assert len(adjectives) == 6, f"{name}: expected 6 adjectives, found {len(adjectives)}"
        feature = community.get("feature")
        assert feature is not None, f"{name} is missing its community feature"
        assert feature["name"] and feature["text"], f"{name}'s community feature is incomplete"


EXPECTED_DOMAINS = {
    "Arcana", "Blade", "Bone", "Codex", "Grace", "Midnight", "Sage", "Splendor", "Valor",
}


def test_domain_card_set_matches_srd_totals() -> None:
    cards = srd.domain_cards()
    assert len(cards) == 189, f"expected 189 domain cards total, found {len(cards)}"

    by_domain: dict[str, list[dict]] = {}
    for card in cards:
        by_domain.setdefault(card["domain"], []).append(card)
    assert set(by_domain) == EXPECTED_DOMAINS

    for domain, domain_cards in by_domain.items():
        assert len(domain_cards) == 21, f"{domain}: expected 21 cards, found {len(domain_cards)}"
        level_counts: dict[int, int] = {}
        for card in domain_cards:
            level_counts[card["level"]] = level_counts.get(card["level"], 0) + 1
            assert card["type"] in ("ability", "spell", "grimoire"), (
                f"{domain}/{card['name']}: bad type {card['type']!r}"
            )
            assert card["name"] and card["text"], f"{domain} card missing name/text: {card}"
        assert level_counts.get(1) == 3, f"{domain}: expected 3 level-1 cards"
        for level in range(2, 11):
            assert level_counts.get(level) == 2, f"{domain} level {level}: expected 2 cards"


def test_domain_cards_l1_by_key_only_returns_level_one() -> None:
    cards = srd.domain_cards_l1_by_key()
    assert len(cards) == 27
    assert all(card["level"] == 1 for card in cards.values())


def test_primary_weapons_tier1_matches_wizard_expectations() -> None:
    tier1 = srd.weapons_by_name()
    assert len(tier1) == 25, f"expected 25 Tier 1 primary weapons, found {len(tier1)}"
    assert all(w["tier"] == 1 for w in tier1.values())


def test_primary_weapons_full_set_covers_all_tiers() -> None:
    weapons = srd.primary_weapons()
    assert len(weapons) == 155, f"expected 155 primary weapons, found {len(weapons)}"
    for tier in (1, 2, 3, 4):
        count = len([w for w in weapons if w["tier"] == tier])
        assert count > 0, f"no primary weapons found for tier {tier}"
        for w in weapons:
            assert w["name"] and w["trait"] and w["range"] and w["damage"] and w["burden"]


def test_secondary_weapons_present() -> None:
    weapons = srd.secondary_weapons()
    assert len(weapons) == 37, f"expected 37 secondary weapons, found {len(weapons)}"
    for w in weapons:
        assert w["name"] and w["trait"] and w["range"] and w["damage"]


def test_armor_tier1_matches_wizard_expectations() -> None:
    tier1 = srd.armor_names()
    assert len(tier1) == 4, f"expected 4 Tier 1 armor entries, found {len(tier1)}"


def test_armor_full_set_covers_all_tiers() -> None:
    all_armor = srd.armor()
    assert len(all_armor) == 34, f"expected 34 armor entries, found {len(all_armor)}"
    for tier in (1, 2, 3, 4):
        count = len([a for a in all_armor if a["tier"] == tier])
        assert count > 0, f"no armor found for tier {tier}"
        for a in all_armor:
            assert a["name"] and len(a["base_thresholds"]) == 2 and a["base_score"] > 0


def test_combat_wheelchair_covers_three_frames_all_tiers() -> None:
    entries = srd.combat_wheelchair()
    assert len(entries) == 12, f"expected 12 wheelchair entries, found {len(entries)}"
    for tier in (1, 2, 3, 4):
        count = len([e for e in entries if e["tier"] == tier])
        assert count == 3, f"tier {tier}: expected 3 wheelchair frames, found {count}"


def test_beastform_options_cover_all_tiers() -> None:
    options = srd.beastform_options()
    assert len(options) == 24, f"expected 24 beastform options, found {len(options)}"
    for tier in (1, 2, 3, 4):
        count = len([o for o in options if o["tier"] == tier])
        assert count == 6, f"tier {tier}: expected 6 beastform options, found {count}"
    for opt in options:
        assert opt["category"] and opt["examples"]
        assert len(opt["features"]) >= 1, f"{opt['category']} has no features"
        for feat in opt["features"]:
            assert feat["name"] and feat["text"]


def test_loot_table_covers_rolls_1_through_60() -> None:
    entries = srd.loot()
    assert len(entries) == 60
    assert sorted(e["roll"] for e in entries) == list(range(1, 61))
    for entry in entries:
        assert entry["name"] and entry["description"]


def test_consumables_table_covers_rolls_1_through_60() -> None:
    entries = srd.consumables()
    assert len(entries) == 60
    assert sorted(e["roll"] for e in entries) == list(range(1, 61))
    for entry in entries:
        assert entry["name"] and entry["description"]
