"""custom_classes, custom_ancestries, custom_communities, custom_domains,
custom_domain_cards, custom_weapons, custom_armor tables

Host-authored content that sits alongside the static SRD dataset
(app/data/srd/character_creation.json). Global/instance-wide scope, not
per-campaign — no campaign_id FK, same visibility model as feature flags.

Nested/variable-shape data (a class's domains/class-items/subclasses) is
stored as JSON-encoded Text, matching the existing Character.extra /
AppSetting.value pattern rather than normalizing into more tables than
this ticket scoped.

custom_domain_cards.domain is a plain string, not a FK to custom_domains —
a card's domain may name either an SRD domain (no DB row) or a custom one,
so it's validated at the accessor layer (DHCM-27), not by the schema.

Uniqueness here is scoped to each custom table only; a custom name that
collides with an SRD entry is rejected by the service layer at creation
time (DHCM-28), since the DB has no visibility into the SRD JSON.

Revision ID: 0006
Revises: 0005
Create Date: 2026-07-27

"""
import sqlalchemy as sa

from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "custom_classes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False, unique=True),
        sa.Column("domains_json", sa.Text(), nullable=False),
        sa.Column("starting_evasion", sa.Integer(), nullable=False),
        sa.Column("starting_hp", sa.Integer(), nullable=False),
        sa.Column("class_items_json", sa.Text(), nullable=False),
        sa.Column("subclasses_json", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_table(
        "custom_ancestries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_table(
        "custom_communities",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_table(
        "custom_domains",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False, unique=True),
        sa.Column("classes_json", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_table(
        "custom_domain_cards",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("domain", sa.String(length=100), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("type", sa.String(length=50), nullable=False),
        sa.Column("recall_cost", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("domain", "name"),
    )
    op.create_table(
        "custom_weapons",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False, unique=True),
        sa.Column("trait", sa.String(length=20), nullable=False),
        sa.Column("range", sa.String(length=20), nullable=False),
        sa.Column("damage", sa.String(length=50), nullable=False),
        sa.Column("burden", sa.String(length=20), nullable=False),
        sa.Column("is_magic", sa.Boolean(), nullable=False),
        sa.Column("feature", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_table(
        "custom_armor",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False, unique=True),
        sa.Column("threshold_low", sa.Integer(), nullable=False),
        sa.Column("threshold_high", sa.Integer(), nullable=False),
        sa.Column("base_score", sa.Integer(), nullable=False),
        sa.Column("feature", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("custom_armor")
    op.drop_table("custom_weapons")
    op.drop_table("custom_domain_cards")
    op.drop_table("custom_domains")
    op.drop_table("custom_communities")
    op.drop_table("custom_ancestries")
    op.drop_table("custom_classes")
