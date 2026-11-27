"""Exercise the progress aggregate against isolated PostgreSQL."""
import os

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

from app.equipment import DEFAULT_GEAR, gear_bonus
from app.training_progress import read_progress_response, read_training_progress


def test_progress_aggregate_and_isolation():
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
                CREATE TEMP TABLE fitness_progress (
                    user_id text PRIMARY KEY, xp int, coins int, hp int
                ) ON COMMIT DROP
            """))
            db.execute(text("""
                CREATE TEMP TABLE fitness_completion (
                    user_id text, workout_id text, created_at timestamptz,
                    workout_snapshot jsonb, boss_defeated boolean
                ) ON COMMIT DROP
            """))
            db.execute(text("""
                CREATE TEMP TABLE fitness_arsenal (
                    user_id text PRIMARY KEY, equipped jsonb
                ) ON COMMIT DROP
            """))
            db.execute(text("INSERT INTO fitness_progress VALUES ('a', 4000, 20, 85), ('b', 9000, 99, 100)"))
            db.execute(text("""
                INSERT INTO fitness_completion VALUES
                ('a', 'w-despertar-guerreiro-a', '2026-11-26 02:00+00', NULL, true),
                ('a', 'custom', '2026-11-26 12:00+00', '{"type":"cardio","elapsedSeconds": 600}', false),
                ('a', 'custom', '2026-11-26 13:00+00', '{"type":"cardio","elapsedSeconds": 1200}', false),
                ('b', 'custom', '2026-11-27 12:00+00', '{"elapsedSeconds": 999}', true)
            """))
            stats = read_training_progress(db, "a", "2026-11-27")
            assert stats["totalWorkouts"] == 3
            assert stats["currentStreak"] == stats["longestStreak"] == 2
            assert stats["lastWorkoutDate"] == "2026-11-26"
            assert stats["forcaWorkouts"] == 1 and stats["cardioWorkouts"] == 2
            assert stats["totalMinutes"] == 30 and stats["bossesDefeated"] == 1
            result = read_progress_response(db, "a", "2026-11-27")
            assert result["xp"] == 4000 and result["rank"] == "E" and result["level"] == 3
            assert result["coins"] == 20 and result["hp"] == 85
            assert result["equippedGear"] == DEFAULT_GEAR
            assert result["bossDamageBonus"] == gear_bonus(DEFAULT_GEAR)["bossDamageBonusPercent"]
            assert result["dual"]["murim"]["qiPoints"] == 1350
            assert read_progress_response(db, "missing", "2026-11-27")["coins"] == 0
            assert read_training_progress(db, "a", "2026-11-28")["currentStreak"] == 0
            db.rollback()
    finally:
        engine.dispose()
