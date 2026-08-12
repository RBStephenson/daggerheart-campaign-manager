"""environments Library entity table

Environment as a Library entity, world-scoped, same flat shape as
adversaries (DHCM-64/DHCM-73).

Revision ID: 0014
Revises: 0013
Create Date: 2026-08-11

"""
import sqlalchemy as sa

from alembic import op

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "environments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("world_id", sa.Integer(), sa.ForeignKey("worlds.id"), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("extra", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("environments")
