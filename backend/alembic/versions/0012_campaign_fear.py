"""campaign fear pool

Adds `fear` to `campaigns` — the GM's shared Fear pool, which the SRD
specifies as campaign-scoped (it carries over between sessions), not
session-scoped. Defaults to 0 so existing rows stay valid.

Revision ID: 0012
Revises: 0011
Create Date: 2026-08-10

"""
import sqlalchemy as sa

from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "campaigns",
        sa.Column("fear", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("campaigns", "fear")
