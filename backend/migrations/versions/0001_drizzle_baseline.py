"""Adopt the eight existing Drizzle migrations without changing business data."""

from alembic import op
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext

from app.schema import metadata

revision = "0001_drizzle_baseline"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    connection = op.get_bind()
    migration = MigrationContext.configure(
        connection, opts={"compare_server_default": True, "version_table": "murim_alembic_version"},
    )

    def managed(name, obj_type, parent_names):
        return obj_type != "table" or name in metadata.tables

    migration.opts["include_name"] = managed
    if compare_metadata(migration, metadata):
        raise RuntimeError("PostgreSQL schema differs from Drizzle 0007; baseline was not adopted")


def downgrade():
    """Remove only Alembic's revision marker and preserve the Drizzle schema."""
