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
