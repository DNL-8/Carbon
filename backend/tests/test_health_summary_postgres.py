"""Exercise real PostgreSQL JSONB expressions with temporary fixture tables only."""
import json
import os
from datetime import date

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

from app.health_summary import read_health_summary

TODAY = date(2026, 11, 27)


@pytest.fixture
def db():
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
        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TEMP TABLE fitness_health_activity (
                    user_id text NOT NULL, source text NOT NULL, external_id text NOT NULL,
                    data jsonb NOT NULL, xp integer NOT NULL DEFAULT 0,
                    PRIMARY KEY (user_id, source, external_id)
                ) ON COMMIT DROP
            """))
            conn.execute(text("""
                CREATE TEMP TABLE fitness_health_metric (
                    user_id text NOT NULL, source text NOT NULL, date_key text NOT NULL,
                    data jsonb NOT NULL, PRIMARY KEY (user_id, source, date_key)
                ) ON COMMIT DROP
            """))
            yield conn
            conn.rollback()
    finally:
        engine.dispose()


def activity(db, uid, source, ident, day, minutes=10, hr=None):
    data = {
        "dateKey": day, "startedAt": day + "T12:00:00Z",
        "durationMinutes": minutes, "distanceKm": 2, "calories": 50,
        "avgHeartRate": hr, "zoneMinutes": [1, 2, 3, 4, 5],
    }
    db.execute(text("""
        INSERT INTO fitness_health_activity (user_id, source, external_id, data)
        VALUES (:uid, :source, :ident, CAST(:data AS jsonb))
    """), {"uid": uid, "source": source, "ident": ident, "data": json.dumps(data)})


def metric(db, uid, source, day):
    db.execute(text("""
        INSERT INTO fitness_health_metric (user_id, source, date_key, data)
        VALUES (:uid, :source, :day, CAST(:data AS jsonb))
    """), {"uid": uid, "source": source, "day": day, "data": '{"steps": 100}'})


def test_summary_filters_and_totals(db):
    activity(db, "a", "strava", "first", "2026-11-21", 10, 120)
    activity(db, "a", "strava", "last", "2026-11-27", 20)
    activity(db, "a", "csv", "csv", "2026-11-27", 100, 140)
    activity(db, "a", "strava", "old", "2026-11-20")
    activity(db, "a", "strava", "future", "2026-11-28")
    activity(db, "b", "strava", "private", "2026-11-27", 500)
    metric(db, "a", "strava", "2026-11-21")
    metric(db, "a", "csv", "2026-11-27")
    metric(db, "b", "strava", "2026-11-27")
    result = read_health_summary(db, "a", "7", "strava", TODAY)
    assert (result["since"], result["today"]) == ("2026-11-21", "2026-11-27")
    assert [row["id"] for row in result["activities"]] == ["last", "first"]
    assert result["dailyMetrics"] == [
        {"date": "2026-11-21", "source": "strava", "data": {"steps": 100}},
    ]
    assert [row["dateKey"] for row in result["trend"]] == ["2026-11-21", "2026-11-27"]
    assert result["totals"] == {
        "count": 2, "durationMinutes": 30, "distanceKm": 4, "calories": 100,
        "avgHeartRate": 120, "z1": 2, "z2": 4, "z3": 6, "z4": 8, "z5": 10,
    }
    all_sources = read_health_summary(db, "a", "7", "all", TODAY)
    assert all_sources["totals"]["count"] == 3
    assert all_sources["totals"]["avgHeartRate"] == 130


def test_empty_summary_and_recent_limit(db):
    empty = read_health_summary(db, "a", "30", "all", TODAY)
    assert empty["activities"] == empty["dailyMetrics"] == empty["trend"] == []
    assert empty["totals"]["count"] == empty["totals"]["durationMinutes"] == 0
    assert empty["totals"]["avgHeartRate"] is None
    for i in range(25):
        activity(db, "a", "strava", f"{i:02}", "2026-11-27")
    result = read_health_summary(db, "a", "90", "all", TODAY)
    assert len(result["activities"]) == 20
    assert result["activities"][-1]["id"] == "19"
    assert result["totals"]["count"] == 25
    assert result["trend"][0]["durationMinutes"] == 250
