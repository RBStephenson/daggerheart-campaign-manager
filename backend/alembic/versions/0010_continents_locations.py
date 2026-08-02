"""continents, locations, and region continent/kind changes

Adds a Continent tier above Region and a Location tier below it, so the
Library hierarchy becomes World > Continent > Region > Location. Region is
reparented from world_id to continent_id, and Continent/Region/Location all
gain a free-text `kind` field. Pre-existing regions are backfilled into a
placeholder "Unsorted Continent" per world (one each) so no data is lost;
recategorizing them into real continents is a manual follow-up.

Revision ID: 0010
Revises: 0009
Create Date: 2026-08-02

"""
from datetime import UTC, datetime

import sqlalchemy as sa

from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "continents",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("world_id", sa.Integer(), sa.ForeignKey("worlds.id"), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("extra", sa.Text(), nullable=False),
        sa.Column("kind", sa.String(length=100), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )

    with op.batch_alter_table("regions") as batch_op:
        batch_op.add_column(sa.Column("continent_id", sa.Integer(), nullable=True))
        batch_op.add_column(
            sa.Column("kind", sa.String(length=100), nullable=False, server_default="")
        )

    conn = op.get_bind()
    # sa.Table (not the lighter sa.table) so its "id" column carries
    # primary_key=True — needed for inserted_primary_key to actually populate
    # on the backfill insert below.
    continents = sa.Table(
        "continents",
        sa.MetaData(),
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("world_id", sa.Integer()),
        sa.Column("name", sa.String(200)),
        sa.Column("summary", sa.Text()),
        sa.Column("extra", sa.Text()),
        sa.Column("kind", sa.String(100)),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
    )
    regions = sa.table(
        "regions",
        sa.column("id", sa.Integer),
        sa.column("world_id", sa.Integer),
        sa.column("continent_id", sa.Integer),
    )

    world_ids = [
        row[0] for row in conn.execute(sa.text("SELECT DISTINCT world_id FROM regions")).fetchall()
    ]
    now = datetime.now(UTC)
    for world_id in world_ids:
        result = conn.execute(
            continents.insert().values(
                world_id=world_id,
                name="Unsorted Continent",
                summary=(
                    "Auto-created by the 0010 migration to hold regions that "
                    "existed before continents did. Recategorize manually."
                ),
                extra="{}",
                kind="",
                created_at=now,
                updated_at=now,
            )
        )
        new_continent_id = result.inserted_primary_key[0]
        conn.execute(
            regions.update()
            .where(regions.c.world_id == world_id)
            .values(continent_id=new_continent_id)
        )

    with op.batch_alter_table("regions") as batch_op:
        batch_op.alter_column("continent_id", existing_type=sa.Integer(), nullable=False)
        batch_op.alter_column(
            "kind", existing_type=sa.String(length=100), server_default=None
        )
        batch_op.create_foreign_key(
            "fk_regions_continent_id_continents", "continents", ["continent_id"], ["id"]
        )
        batch_op.drop_column("world_id")

    op.create_table(
        "locations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("region_id", sa.Integer(), sa.ForeignKey("regions.id"), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("extra", sa.Text(), nullable=False),
        sa.Column("kind", sa.String(length=100), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("locations")

    with op.batch_alter_table("regions") as batch_op:
        batch_op.add_column(sa.Column("world_id", sa.Integer(), nullable=True))

    conn = op.get_bind()
    continent_world = {
        row[0]: row[1]
        for row in conn.execute(sa.text("SELECT id, world_id FROM continents")).fetchall()
    }
    region_continents = conn.execute(
        sa.text("SELECT id, continent_id FROM regions")
    ).fetchall()
    regions = sa.table(
        "regions",
        sa.column("id", sa.Integer),
        sa.column("world_id", sa.Integer),
    )
    for region_id, continent_id in region_continents:
        conn.execute(
            regions.update()
            .where(regions.c.id == region_id)
            .values(world_id=continent_world.get(continent_id))
        )

    with op.batch_alter_table("regions") as batch_op:
        batch_op.alter_column("world_id", existing_type=sa.Integer(), nullable=False)
        batch_op.create_foreign_key(
            "fk_regions_world_id_worlds", "worlds", ["world_id"], ["id"]
        )
        batch_op.drop_column("continent_id")
        batch_op.drop_column("kind")

    op.drop_table("continents")
