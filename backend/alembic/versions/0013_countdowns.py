"""countdowns

Adds `countdowns`, campaign-scoped GM tracking for SRD countdowns (standard
and dynamic, per pg. of the SRD's Countdowns section). Loop countdowns reset
to their starting value when triggered instead of staying at 0.

Revision ID: 0013
Revises: 0012
Create Date: 2026-08-10

"""
import sqlalchemy as sa

from alembic import op

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "countdowns",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("campaign_id", sa.Integer(), sa.ForeignKey("campaigns.id"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("starting_value", sa.Integer(), nullable=False),
        sa.Column("current_value", sa.Integer(), nullable=False),
        sa.Column("loop", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("triggered_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("countdowns")
