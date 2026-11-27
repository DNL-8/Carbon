"""Verify JSONB replacement and ownership in a disposable local database."""
import os

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

from app.profile import save_profile


def test_profile_replace_without_touching_other_owner():
    raw = os.environ.get("MURIM_TEST_DATABASE_URL")
    if not raw:
        pytest.skip("isolated PostgreSQL not configured")
    url = make_url(raw)
    if (
        url.host not in {"127.0.0.1", "localhost", "::1"}
        or url.database != "murim_fastapi_test"
        or url.get_backend_name() != "postgresql"
        or url.query
    ):
        pytest.fail("test DB must be a local disposable murim_fastapi_test database")
    engine = create_engine(url.set(drivername="postgresql+psycopg"), hide_parameters=True)
    try:
        with engine.connect() as db:
            db.execute(text("""
                CREATE TEMP TABLE fitness_hero_profile (
                    user_id text PRIMARY KEY, data jsonb NOT NULL
                ) ON COMMIT DROP
            """))
            first = {"name": "Herói A", "weightKg": 80, "heightCm": None}
            other = {"name": "Herói B", "weightKg": 90}
            updated = {"name": "Herói A", "weightKg": None}
            save_profile(db, "a", first)
            save_profile(db, "b", other)
            save_profile(db, "a", updated)
            save_profile(db, "a", updated)
            rows = db.execute(text("SELECT user_id, data FROM fitness_hero_profile")).all()
            assert dict(rows) == {"a": updated, "b": other}
            db.rollback()
    finally:
        engine.dispose()
