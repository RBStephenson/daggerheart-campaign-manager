"""character mutable play-state columns

Adds hp_marked/stress_marked/hope/armor_slots_marked to `characters` —
state that changes during play, kept separate from the immutable
creation-time CharacterSheet snapshot stored in `extra`. Defaults match
Level 1 creation values (0 marked, 2 Hope) so existing rows stay valid.

Revision ID: 0011
Revises: 0010
Create Date: 2026-08-09

"""
import sqlalchemy as sa

from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "characters",
        sa.Column("hp_marked", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "characters",
        sa.Column("stress_marked", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "characters",
        sa.Column("hope", sa.Integer(), nullable=False, server_default="2"),
    )
    op.add_column(
        "characters",
        sa.Column("armor_slots_marked", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("characters", "armor_slots_marked")
    op.drop_column("characters", "hope")
    op.drop_column("characters", "stress_marked")
    op.drop_column("characters", "hp_marked")
