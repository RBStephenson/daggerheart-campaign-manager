"""clues table

Clue as a lightweight, world-scoped investigation-prep note (DHCM-63/DHCM-86):
text + a free-text revelation label + an optional polymorphic link to a
Library entity or session-plan node. entity_type/entity_id are nullable,
unlike SessionPlanLibraryLink's, since a clue may exist unattached.

Revision ID: 0015
Revises: 0014
Create Date: 2026-08-13

"""
import sqlalchemy as sa

from alembic import op

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "clues",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("world_id", sa.Integer(), sa.ForeignKey("worlds.id"), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("revelation", sa.String(length=200), nullable=False),
        sa.Column("entity_type", sa.String(length=20), nullable=True),
        sa.Column("entity_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("clues")
