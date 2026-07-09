"""chat_messages table

Revision ID: 0004
Revises: 0003
Create Date: 2026-07-09

"""
import sqlalchemy as sa

from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "chat_messages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("room", sa.String(length=100), nullable=False),
        sa.Column("author_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_chat_messages_room", "chat_messages", ["room"])


def downgrade() -> None:
    op.drop_index("ix_chat_messages_room", table_name="chat_messages")
    op.drop_table("chat_messages")
