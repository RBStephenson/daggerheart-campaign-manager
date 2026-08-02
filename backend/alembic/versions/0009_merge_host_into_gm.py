"""merge host role into gm

Revision ID: 0009
Revises: 0008
Create Date: 2026-08-02

"""
import sqlalchemy as sa

from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None

_users = sa.table("users", sa.column("role", sa.String))
_invites = sa.table("invites", sa.column("role", sa.String))


def upgrade() -> None:
    op.execute(_users.update().where(_users.c.role == "host").values(role="gm"))
    op.execute(_invites.update().where(_invites.c.role == "host").values(role="gm"))


def downgrade() -> None:
    # Irreversible: the original split between "host" and "gm" accounts is lost.
    pass
