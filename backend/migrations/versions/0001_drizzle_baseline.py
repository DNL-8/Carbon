"""Adopt Drizzle 0007 or explicitly bootstrap an empty PostgreSQL schema."""

from os import environ

from alembic import op
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import inspect

from migrations.baseline_schema import metadata

revision = "0001_drizzle_baseline"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    connection = op.get_bind()
    # Never infer that a database is new from a missing business table.
    # Explicit opt-in, and only a completely empty default schema, can bootstrap.
    tables = set(inspect(connection).get_table_names()) - {"murim_alembic_version"}
    if not tables and environ.get("MURIM_BOOTSTRAP_EMPTY") == "1":
        metadata.create_all(connection, checkfirst=False)
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
