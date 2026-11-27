"""Inventory a PostgreSQL copy before migrating legacy Murim data.

Read-only transaction. No data rows, credentials, account identifiers or SQL errors
are printed. This is a diagnostic, not an import or a migration.
"""
import json
import os
import sys

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url

from app.schema import metadata

LEGACY = frozenset({
    "users", "accounts", "sessions", "verifications", "hero_profiles", "game_stats",
    "workouts", "workout_logs", "exercise_prs", "daily_vows", "achievements",
    "equipment", "user_equipment", "loadout_presets", "health_activities",
    "daily_health_metrics", "weight_logs", "progress_ledger", "chat_messages",
})
TARGET = frozenset(metadata.tables)


def classify(tables: set[str]) -> str:
    if not tables:
        return "empty"
    if TARGET <= tables and not LEGACY & tables:
        return "target"
    if LEGACY <= tables and not TARGET & tables:
        return "legacy"
    if LEGACY & tables or TARGET & tables:
        return "mixed_or_partial"
    return "unknown"


def inventory(conn) -> dict:
    inspector = inspect(conn)
    tables = set(inspector.get_table_names(schema="public"))
    # Restrict identifiers to the fixed application allowlist.
    counts = {
        name: conn.execute(text(f'SELECT count(*) FROM public."{name}"')).scalar_one()
        for name in sorted(tables & (LEGACY | TARGET))
    }
    missing_columns = {}
    for name in sorted(tables & TARGET):
        present = {column["name"] for column in inspector.get_columns(name, schema="public")}
        missing = sorted(set(metadata.tables[name].columns.keys()) - present)
        if missing:
            missing_columns[name] = missing
    return {
        "schema": classify(tables),
        "missing_target_tables": sorted(TARGET - tables),
        "missing_target_columns": missing_columns,
        "record_counts": counts,
        "legacy_account_mapping_required": bool(counts.get("users", 0)),
        "automatic_migration_permitted": False,
    }


def main() -> int:
    engine = None
    try:
        url = make_url(os.environ["MURIM_PREFLIGHT_DATABASE_URL"])
        if url.get_backend_name() != "postgresql":
            raise ValueError("PostgreSQL required")
        engine = create_engine(url.set(drivername="postgresql+psycopg"), hide_parameters=True)
        with engine.connect() as conn, conn.begin():
            conn.execute(text("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY"))
            conn.execute(text("SET LOCAL statement_timeout = '15s'"))
            report = inventory(conn)
        print(json.dumps(report, indent=2, sort_keys=True))
        return 0
    except Exception:
        print("Preflight failed: check the explicitly selected database, access and schema.", file=sys.stderr)
        return 1
    finally:
        if engine is not None:
            engine.dispose()


if __name__ == "__main__":
    sys.exit(main())
