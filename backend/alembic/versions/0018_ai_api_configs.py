"""ai_api_configs table

Named AI API endpoint configurations for AI text generation (DHCM-95/78),
modeled directly on STL Studio's AiApiConfig. Global, not campaign-scoped.
Encrypted API keys are stored separately in app_settings, not in this table.

Revision ID: 0018
Revises: 0017
Create Date: 2026-08-14

"""
import sqlalchemy as sa

from alembic import op

revision = "0018"
down_revision = "0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_api_configs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("api_type", sa.String(length=20), nullable=False),
        sa.Column("url", sa.String(length=500), nullable=True),
        sa.Column("model", sa.String(length=200), nullable=False),
        sa.Column("effort", sa.String(length=20), nullable=True),
        sa.Column("request_timeout", sa.Integer(), nullable=False),
        sa.Column("batch_size", sa.Integer(), nullable=True),
        sa.Column("reasoning_enabled", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("ai_api_configs")
