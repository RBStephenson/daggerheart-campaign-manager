"""ORM models."""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class AppSetting(Base):
    """Key/value store for application settings and feature flags.

    Values are JSON-encoded strings; new settings need no migration.
    """

    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False)


class User(Base):
    """Application user. Role is one of "gm", "player"."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class Invite(Base):
    """Single-use invite token granting a role on registration."""

    __tablename__ = "invites"

    id: Mapped[int] = mapped_column(primary_key=True)
    token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class Campaign(Base):
    """A GM-owned campaign."""

    __tablename__ = "campaigns"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    gm_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class GameSession(Base):
    """A run of a campaign. Status is one of "active", "ended".

    A campaign has at most one active session at a time. The WebSocket
    room key for a session is derived, not stored (see `room` property).
    """

    __tablename__ = "game_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    campaign_id: Mapped[int] = mapped_column(ForeignKey("campaigns.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    @property
    def room(self) -> str:
        return f"session-{self.id}"


class ChatMessage(Base):
    """A persisted chat message, scoped to a WebSocket room."""

    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    room: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    author_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class CampaignMembership(Base):
    """A player's membership in a campaign, granted by the GM."""

    __tablename__ = "campaign_memberships"
    __table_args__ = (UniqueConstraint("campaign_id", "player_user_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    campaign_id: Mapped[int] = mapped_column(ForeignKey("campaigns.id"), nullable=False)
    player_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    joined_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class Character(Base):
    """A player-owned character within a campaign.

    Core Daggerheart fields are columns; anything else lives in `extra`
    as a JSON-encoded string so the schema doesn't need to chase every
    rule-book detail.

    `extra` (when populated) is an immutable creation-time CharacterSheet
    snapshot — hp_max, stress_max, equipment, domain cards, etc. The
    hp_marked/stress_marked/hope/armor_slots_marked columns below are
    mutable play state that changes during a session and is validated
    against that snapshot (see `app.schemas.character_state`), not
    against the fixed Level 1 creation invariants in `CharacterSheet`.
    """

    __tablename__ = "characters"

    id: Mapped[int] = mapped_column(primary_key=True)
    player_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    campaign_id: Mapped[int] = mapped_column(ForeignKey("campaigns.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    char_class: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    ancestry: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    community: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    level: Mapped[int] = mapped_column(nullable=False, default=1)
    extra: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    hp_marked: Mapped[int] = mapped_column(nullable=False, default=0)
    stress_marked: Mapped[int] = mapped_column(nullable=False, default=0)
    hope: Mapped[int] = mapped_column(nullable=False, default=2)
    armor_slots_marked: Mapped[int] = mapped_column(nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class CampaignNote(Base):
    """A player's private notes for a campaign — one per player per campaign."""

    __tablename__ = "campaign_notes"
    __table_args__ = (UniqueConstraint("campaign_id", "player_user_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    campaign_id: Mapped[int] = mapped_column(ForeignKey("campaigns.id"), nullable=False)
    player_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class CustomClass(Base):
    """GM-authored class, alongside the SRD's static classes.

    ``domains_json``/``class_items_json``/``subclasses_json`` are JSON-encoded
    lists (subclasses: ``[{"name": ..., "spellcast_trait": ...}, ...]``),
    matching the shape of the SRD dataset's class entries.
    """

    __tablename__ = "custom_classes"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    domains_json: Mapped[str] = mapped_column(Text, nullable=False)
    starting_evasion: Mapped[int] = mapped_column(nullable=False)
    starting_hp: Mapped[int] = mapped_column(nullable=False)
    class_items_json: Mapped[str] = mapped_column(Text, nullable=False)
    subclasses_json: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class CustomAncestry(Base):
    """GM-authored ancestry, alongside the SRD's static ancestries."""

    __tablename__ = "custom_ancestries"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class CustomCommunity(Base):
    """GM-authored community, alongside the SRD's static communities."""

    __tablename__ = "custom_communities"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class CustomDomain(Base):
    """GM-authored domain, alongside the SRD's static domains.

    ``classes_json`` is a JSON-encoded list of class names (SRD or custom)
    granted this domain.
    """

    __tablename__ = "custom_domains"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    classes_json: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class CustomDomainCard(Base):
    """GM-authored Level 1 domain card, alongside the SRD's static cards.

    ``domain`` is a plain string, not a FK to ``custom_domains`` — it may
    name either an SRD domain (no DB row) or a custom one. Validity is
    checked at the accessor/merge layer, not by the schema.
    """

    __tablename__ = "custom_domain_cards"
    __table_args__ = (UniqueConstraint("domain", "name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    domain: Mapped[str] = mapped_column(String(100), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    recall_cost: Mapped[int] = mapped_column(nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class CustomWeapon(Base):
    """GM-authored Tier 1 weapon, alongside the SRD's static weapon table."""

    __tablename__ = "custom_weapons"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    trait: Mapped[str] = mapped_column(String(20), nullable=False)
    range: Mapped[str] = mapped_column(String(20), nullable=False)
    damage: Mapped[str] = mapped_column(String(50), nullable=False)
    burden: Mapped[str] = mapped_column(String(20), nullable=False)
    is_magic: Mapped[bool] = mapped_column(Boolean, nullable=False)
    feature: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class CustomArmor(Base):
    """GM-authored Tier 1 armor, alongside the SRD's static armor table."""

    __tablename__ = "custom_armor"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    threshold_low: Mapped[int] = mapped_column(nullable=False)
    threshold_high: Mapped[int] = mapped_column(nullable=False)
    base_score: Mapped[int] = mapped_column(nullable=False)
    feature: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class World(Base):
    """A GM's world — the campaign-independent container for Library content."""

    __tablename__ = "worlds"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class Continent(Base):
    """A Library continent, scoped to a world and independent of any campaign.

    Sits between World and Region in the Library hierarchy (World > Continent
    > Region > Location). `kind` is a free-text descriptor (e.g. "primary
    continent"); type-specific fields still live in `extra` as JSON, matching
    `Character.extra`.
    """

    __tablename__ = "continents"

    id: Mapped[int] = mapped_column(primary_key=True)
    world_id: Mapped[int] = mapped_column(ForeignKey("worlds.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    extra: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    kind: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class Region(Base):
    """A Library region, scoped to a continent and independent of any campaign.

    Type-specific fields (climate, terrain, notable locations, etc.) live in
    `extra` as a JSON-encoded string, matching `Character.extra` — the schema
    doesn't need to chase every field a GM might want to track.
    """

    __tablename__ = "regions"

    id: Mapped[int] = mapped_column(primary_key=True)
    continent_id: Mapped[int] = mapped_column(ForeignKey("continents.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    extra: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    kind: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class Location(Base):
    """A Library location, scoped to a region and independent of any campaign.

    The bottom tier of the Library hierarchy — a location always belongs to
    a region (e.g. Hillford within the Hillford Valley region of Tharivor).
    """

    __tablename__ = "locations"

    id: Mapped[int] = mapped_column(primary_key=True)
    region_id: Mapped[int] = mapped_column(ForeignKey("regions.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    extra: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    kind: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class Faction(Base):
    """A Library faction, scoped to a world and independent of any campaign."""

    __tablename__ = "factions"

    id: Mapped[int] = mapped_column(primary_key=True)
    world_id: Mapped[int] = mapped_column(ForeignKey("worlds.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    extra: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class Npc(Base):
    """A Library NPC, scoped to a world and independent of any campaign."""

    __tablename__ = "npcs"

    id: Mapped[int] = mapped_column(primary_key=True)
    world_id: Mapped[int] = mapped_column(ForeignKey("worlds.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    extra: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class Adversary(Base):
    """A Library adversary/statblock, scoped to a world and independent of any campaign."""

    __tablename__ = "adversaries"

    id: Mapped[int] = mapped_column(primary_key=True)
    world_id: Mapped[int] = mapped_column(ForeignKey("worlds.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    extra: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class SessionPlan(Base):
    """A GM's plan for a future session of a campaign, defined ahead of play.

    Distinct from `GameSession` (DHCM-8), which tracks a session actually being
    run. Structured beats/events live in `extra` as a JSON-encoded string,
    matching `Region.extra` — the schema doesn't need to chase every shape a
    GM might plan a session around. `order` sequences plans within a campaign.
    """

    __tablename__ = "session_plans"

    id: Mapped[int] = mapped_column(primary_key=True)
    campaign_id: Mapped[int] = mapped_column(ForeignKey("campaigns.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    order: Mapped[int] = mapped_column(nullable=False, default=0)
    extra: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class SessionPlanLibraryLink(Base):
    """Links a `SessionPlan` to a Library entity expected to appear in it.

    `entity_type` is one of "region"/"faction"/"npc"/"adversary". `entity_id`
    is a plain int rather than a FK, since a single column can't reference
    four different tables; validity of the (entity_type, entity_id) pair is
    enforced at the API layer, the same tradeoff already accepted for
    `CustomDomainCard.domain`.
    """

    __tablename__ = "session_plan_library_links"
    __table_args__ = (UniqueConstraint("session_plan_id", "entity_type", "entity_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    session_plan_id: Mapped[int] = mapped_column(ForeignKey("session_plans.id"), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(20), nullable=False)
    entity_id: Mapped[int] = mapped_column(nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
