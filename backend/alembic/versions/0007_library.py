"""worlds and Library entity tables (regions, factions, npcs, adversaries)

Revision ID: 0007
Revises: 0006
Create Date: 2026-08-02

"""
import sqlalchemy as sa

from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def _create_library_table(name: str) -> None:
    op.create_table(
        name,
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("world_id", sa.Integer(), sa.ForeignKey("worlds.id"), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("extra", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )


def upgrade() -> None:
    op.create_table(
        "worlds",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    _create_library_table("regions")
    _create_library_table("factions")
    _create_library_table("npcs")
    _create_library_table("adversaries")


def downgrade() -> None:
    op.drop_table("adversaries")
    op.drop_table("npcs")
    op.drop_table("factions")
    op.drop_table("regions")
    op.drop_table("worlds")
