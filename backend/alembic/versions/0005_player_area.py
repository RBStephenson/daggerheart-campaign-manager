"""campaign_memberships, characters, campaign_notes tables

Revision ID: 0005
Revises: 0004
Create Date: 2026-07-09

"""
import sqlalchemy as sa

from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "campaign_memberships",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "campaign_id", sa.Integer(), sa.ForeignKey("campaigns.id"), nullable=False
        ),
        sa.Column(
            "player_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False
        ),
        sa.Column("joined_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("campaign_id", "player_user_id"),
    )
    op.create_table(
        "characters",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "player_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False
        ),
        sa.Column(
            "campaign_id", sa.Integer(), sa.ForeignKey("campaigns.id"), nullable=False
        ),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("char_class", sa.String(length=100), nullable=False),
        sa.Column("ancestry", sa.String(length=100), nullable=False),
        sa.Column("community", sa.String(length=100), nullable=False),
        sa.Column("level", sa.Integer(), nullable=False),
        sa.Column("extra", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_table(
        "campaign_notes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "campaign_id", sa.Integer(), sa.ForeignKey("campaigns.id"), nullable=False
        ),
        sa.Column(
            "player_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False
        ),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("campaign_id", "player_user_id"),
    )


def downgrade() -> None:
    op.drop_table("campaign_notes")
    op.drop_table("characters")
    op.drop_table("campaign_memberships")
