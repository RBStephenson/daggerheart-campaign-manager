"""adversary notes column

Freeform GM-only notes on Adversary, for live-play signature-move recall
(DHCM-65/DHCM-90) -- separate from `extra`, which already carries the full
spawned Bestiary stat block.

Revision ID: 0016
Revises: 0015
Create Date: 2026-08-13

"""
import sqlalchemy as sa

from alembic import op

revision = "0016"
down_revision = "0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "adversaries",
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
    )


def downgrade() -> None:
    op.drop_column("adversaries", "notes")
