"""Run Alembic with a separately supplied direct PostgreSQL connection."""

from os import environ

from alembic import context
from sqlalchemy import create_engine, pool
from sqlalchemy.engine import make_url

from app.schema import metadata

raw_url = environ.get("MURIM_MIGRATION_DATABASE_URL")
if not raw_url:
    raise RuntimeError("Set MURIM_MIGRATION_DATABASE_URL to the direct migration connection")

url = make_url(raw_url.replace("postgres://", "postgresql://", 1))
if url.get_backend_name() != "postgresql" or not url.host or "-pooler" in url.host:
    raise RuntimeError("Alembic requires a direct PostgreSQL connection")
if context.is_offline_mode():
    raise RuntimeError("The baseline needs a live schema comparison")

engine = create_engine(url.set(drivername="postgresql+psycopg"), poolclass=pool.NullPool, hide_parameters=True)
with engine.connect() as connection:
    context.configure(
        connection=connection, target_metadata=metadata, compare_server_default=True,
        version_table=context.config.get_main_option("version_table"),
    )
    with context.begin_transaction():
        context.run_migrations()
