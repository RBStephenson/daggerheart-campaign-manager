"""session plans and Library links (planned content ahead of play)

Revision ID: 0008
Revises: 0007
Create Date: 2026-08-02

"""
import sqlalchemy as sa

from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "session_plans",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("campaign_id", sa.Integer(), sa.ForeignKey("campaigns.id"), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("order", sa.Integer(), nullable=False),
        sa.Column("extra", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_table(
        "session_plan_library_links",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "session_plan_id",
            sa.Integer(),
            sa.ForeignKey("session_plans.id"),
            nullable=False,
        ),
        sa.Column("entity_type", sa.String(length=20), nullable=False),
        sa.Column("entity_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint(
            "session_plan_id",
            "entity_type",
            "entity_id",
            name="uq_session_plan_library_links_plan_entity",
        ),
    )


def downgrade() -> None:
    op.drop_table("session_plan_library_links")
    op.drop_table("session_plans")
