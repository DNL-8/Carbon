"""Use only a local disposable PostgreSQL database and temporary tables."""
import os

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

from app.weight import delete_weight, save_weight


def test_weight_upsert_and_delete_isolation():
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
                CREATE TEMP TABLE fitness_weight_check_in (
                    user_id text NOT NULL, day text NOT NULL, kg double precision NOT NULL,
                    PRIMARY KEY (user_id, day)
                ) ON COMMIT DROP
            """))
            day = "2026-11-27"
            save_weight(db, "a", day, 80)
            save_weight(db, "a", day, 80)
            save_weight(db, "a", day, 81.5)
            save_weight(db, "b", day, 92)
            save_weight(db, "a", "2026-11-26", 79)
            assert db.execute(text(
                "SELECT user_id, day, kg FROM fitness_weight_check_in ORDER BY user_id, day"
            )).all() == [
                ("a", "2026-11-26", 79), ("a", day, 81.5), ("b", day, 92),
            ]
            delete_weight(db, "a", day)
            delete_weight(db, "a", day)
            assert db.execute(text(
                "SELECT user_id, day, kg FROM fitness_weight_check_in ORDER BY user_id, day"
            )).all() == [("a", "2026-11-26", 79), ("b", day, 92)]
            db.rollback()
    finally:
        engine.dispose()
