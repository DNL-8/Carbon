"""Verify history and record names using an isolated PostgreSQL database."""
import json
import os

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

from app.catalog import workout_catalog
from app.history import read_history


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
                CREATE TEMP TABLE fitness_completion (
                    user_id text NOT NULL, id text NOT NULL, workout_id text NOT NULL,
                    sets jsonb NOT NULL, xp integer NOT NULL, coins integer NOT NULL,
                    created_at timestamptz NOT NULL, workout_snapshot jsonb,
                    PRIMARY KEY (user_id, id)
                ) ON COMMIT DROP
            """))
            conn.execute(text("""
                CREATE TEMP TABLE fitness_exercise_record (
                    user_id text NOT NULL, exercise_id text NOT NULL,
                    best_weight_kg double precision NOT NULL, best_reps integer NOT NULL,
                    best_volume_kg double precision NOT NULL,
                    estimated_1rm_kg double precision NOT NULL,
                    PRIMARY KEY (user_id, exercise_id)
                ) ON COMMIT DROP
            """))
            conn.execute(text("""
                CREATE TEMP TABLE fitness_custom_workout (
                    user_id text NOT NULL, id text NOT NULL, data jsonb NOT NULL,
                    PRIMARY KEY (user_id, id)
                ) ON COMMIT DROP
            """))
            yield conn
            conn.rollback()
    finally:
        engine.dispose()


def completion(db, user, ident, workout_id, exercise_id, snapshot=None):
    db.execute(text("""
        INSERT INTO fitness_completion VALUES (
            :uid, :id, :wid, CAST(:sets AS jsonb), 100, 10,
            '2026-11-27T03:00:00.123456+00:00', CAST(:snapshot AS jsonb)
        )
    """), {
        "uid": user, "id": ident, "wid": workout_id,
        "sets": json.dumps([{"exerciseId": exercise_id, "reps": 10, "weightKg": 20}]),
        "snapshot": json.dumps(snapshot),
    })


def record(db, user, ident):
    db.execute(text("""
        INSERT INTO fitness_exercise_record VALUES (:uid, :id, 20, 10, 200, 26.7)
    """), {"uid": user, "id": ident})


def test_history_names_and_isolation(db):
    builtin = workout_catalog()[0]
    ex = builtin["exercises"][0]
    completion(db, "a", "01", builtin["id"], ex["id"])
    completion(db, "a", "02", "deleted", "old-ex",
               {"name": "Treino antigo", "exercises": {"old-ex": "Árvore"}})
    completion(db, "a", "03", "custom", "edited-ex",
               {"name": "Antes", "exercises": {"edited-ex": "Anterior"}})
    completion(db, "b", "04", "private", "secret",
               {"name": "Privado", "exercises": {"secret": "Segredo"}})
    db.execute(text("""
        INSERT INTO fitness_custom_workout VALUES ('a', 'custom', CAST(:data AS jsonb))
    """), {"data": json.dumps({"exercises": [{"id": "edited-ex", "name": "Zebra"}]})})
    for ident in (ex["id"], "old-ex", "edited-ex", "missing"):
        record(db, "a", ident)
    record(db, "b", "secret")

    result = read_history(db, "a")
    assert [row["id"] for row in result["history"]] == ["03", "02", "01"]
    assert result["history"][0]["name"] == "Antes"
    assert result["history"][0]["sets"][0]["name"] == "Anterior"
    assert result["history"][1]["name"] == "Treino antigo"
    assert result["history"][2]["name"] == builtin["name"]
    assert result["history"][2]["sets"][0]["name"] == ex["name"]
    assert all(row["createdAt"] == "2026-11-27T03:00:00.123Z" for row in result["history"])
    assert all("snapshot" not in row for row in result["history"])
    assert [row["name"] for row in result["records"]] == [
        ex["name"], "Árvore", "missing", "Zebra",
    ]
    assert read_history(db, "none") == {"history": [], "records": []}


def test_history_limit(db):
    for i in range(31):
        completion(db, "a", f"{i:02}", "unknown", "unknown-ex")
    result = read_history(db, "a")
    assert len(result["history"]) == 30
    assert result["history"][0]["id"] == "30"
    assert result["history"][-1]["id"] == "01"
    assert result["history"][0]["name"] == "unknown"
    assert result["history"][0]["sets"][0]["name"] == "unknown-ex"
