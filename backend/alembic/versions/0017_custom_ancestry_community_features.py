"""custom_ancestries.features_json, custom_communities adjectives_json + feature_json

DHCM-26 shipped CustomAncestry/CustomCommunity as name-only, but the SRD
dataset's ancestries carry a `features` list and communities carry
`adjectives` + a single `feature` object -- a custom entry with no feature
text would render blank in the character-creation wizard. Caught while
scoping DHCM-27 (accessor merge layer); fixing here rather than deferring.

Revision ID: 0017
Revises: 0016
Create Date: 2026-08-13

"""
import sqlalchemy as sa

from alembic import op

revision = "0017"
down_revision = "0016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "custom_ancestries",
        sa.Column("features_json", sa.Text(), nullable=False, server_default="[]"),
    )
    op.add_column(
        "custom_communities",
        sa.Column("adjectives_json", sa.Text(), nullable=False, server_default="[]"),
    )
    op.add_column(
        "custom_communities",
        sa.Column("feature_json", sa.Text(), nullable=False, server_default="null"),
    )


def downgrade() -> None:
    op.drop_column("custom_communities", "feature_json")
    op.drop_column("custom_communities", "adjectives_json")
    op.drop_column("custom_ancestries", "features_json")
