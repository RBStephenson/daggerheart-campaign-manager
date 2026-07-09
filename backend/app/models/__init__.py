"""ORM models."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint
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
    """Application user. Role is one of "host", "gm", "player"."""

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
