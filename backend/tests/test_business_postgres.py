"""Exercise the real Drizzle schema and separate database connections."""

import os
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

from app.arsenal import ArmoryAction, get_equipment, mutate_arsenal, read_totals
from app.catalog import workout_catalog
from app.completion import FinishInput, finish_training
from app.health_import import Activity, PartialMetric, persist_import
from app.quests import claim_quest, read_quests
from app.vows import ChangeVow, CreateVow, change_vow

TODAY = "2026-11-26"


@pytest.fixture
def database():
    raw = os.environ.get("MURIM_TEST_DATABASE_URL")
    if not raw:
        pytest.skip("isolated PostgreSQL not configured")
    url = make_url(raw)
    assert url.host in {"127.0.0.1", "::1", "localhost"}
    assert url.database == "murim_fastapi_test" and url.get_backend_name() == "postgresql" and not url.query
    engine = create_engine(url.set(drivername="postgresql+psycopg"), hide_parameters=True)
    users = [uuid4().hex for _ in range(2)]
    try:
        with engine.begin() as conn:
            for uid in users:
                conn.execute(text("INSERT INTO auth_user (id, name, email) VALUES (:uid, 'Test', :email)"),
                             {"uid": uid, "email": f"{uid}@example.test"})
        yield engine, users
    finally:
        with engine.begin() as conn:
            for uid in users:
                conn.execute(text("DELETE FROM auth_user WHERE id = :uid"), {"uid": uid})
        engine.dispose()


def concurrently(engine, operation) -> list:
    barrier = Barrier(2)

    def execute():
        with engine.begin() as conn:
            conn.exec_driver_sql("SET LOCAL lock_timeout = '5s'")
            barrier.wait(timeout=5)
            return operation(conn)

    with ThreadPoolExecutor(max_workers=2) as pool:
        pending = [pool.submit(execute) for _ in range(2)]
        return [future.result(timeout=10) for future in pending]


def fixture_activity() -> Activity:
    return Activity(externalId="health-connect-test", source="health_connect", title="Corrida",
                    sportType="Run", dateKey=TODAY, startedAt=TODAY + "T12:00:00-03:00",
                    durationMinutes=30, distanceKm=5, calories=0, elevationGainM=0,
                    avgHeartRate=None, maxHeartRate=None, zoneMinutes=(0, 0, 0, 0, 0),
                    hrSamplePoints=[])


def test_concurrent_imports_and_claims(database):
    engine, (user, other) = database
    activity = fixture_activity()
    results = concurrently(engine, lambda conn: persist_import(
        conn, user, "health_connect", [activity], [PartialMetric(dateKey=TODAY, steps=7200)],
    ))
    assert sorted(item["imported"] for item in results) == [0, 1]
    assert sum(item["xp"] for item in results) == 150
    assert concurrently(engine, lambda conn: claim_quest(conn, user, "steps_6000", TODAY)) == [{"claimed": True}] * 2

    with engine.begin() as conn:
        persist_import(conn, user, "health_connect", [], [PartialMetric(dateKey=TODAY, sleepHours=8)])
        metric = conn.execute(text("SELECT data FROM fitness_health_metric WHERE user_id = :uid"),
                              {"uid": user}).scalar_one()
        assert metric == {"dateKey": TODAY, "steps": 7200, "sleepHours": 8}
        assert read_totals(conn, user) == {"xp": 175, "coins": 20, "hp": 100}
        assert not read_quests(conn, other, TODAY)["daily"][0]["isFulfilled"]
        ledger = conn.execute(text("""
            SELECT kind, total_xp FROM fitness_progress_ledger WHERE user_id = :uid ORDER BY id
        """), {"uid": user}).all()
        assert ledger == [("health_activity", 150), ("daily_quest", 175)]


def test_completion_and_vow_serialize_and_rollback(database):
    engine, (user, other) = database
    workout = workout_catalog()[0]
    body = FinishInput(id=str(uuid4()), workoutId=workout["id"], elapsedSeconds=1200,
                       sets=[{"exerciseId": e["id"], "reps": 10, "weightKg": 50} for e in workout["exercises"]])
    a, b = concurrently(engine, lambda conn: finish_training(conn, user, body, TODAY))
    assert a == b
    assert a["bossDefeated"] and a["earnedXp"] > 0 and a["earnedCoins"] > 0
    with pytest.raises(RuntimeError, match="forced rollback"), engine.begin() as conn:
        finish_training(conn, other, body, TODAY)
        raise RuntimeError("forced rollback")

    vow = str(uuid4())
    with engine.begin() as conn:
        for table in ("fitness_completion", "fitness_exercise_record", "fitness_achievement", "fitness_progress_ledger"):
            assert conn.execute(text(f"SELECT count(*) FROM {table} WHERE user_id = :uid"),
                                {"uid": other}).scalar_one() == 0
        assert read_totals(conn, other) == {"xp": 0, "coins": 0, "hp": 100}
        change_vow(conn, user, CreateVow(action="create", id=vow, title="Voto"), TODAY)

    concurrently(engine, lambda conn: change_vow(conn, user, ChangeVow(action="violate", id=vow), TODAY))
    with engine.connect() as conn:
        assert read_totals(conn, user) == {"xp": a["xp"] - 15, "coins": a["coins"], "hp": 85}
        assert conn.execute(text("""
            SELECT kind FROM fitness_progress_ledger WHERE user_id = :uid ORDER BY id
        """), {"uid": user}).scalars().all() == ["workout", "vow_broken"]
        with pytest.raises(HTTPException) as exc:
            change_vow(conn, user, ChangeVow(action="complete", id=vow), TODAY)
        assert exc.value.status_code == 409

def test_concurrent_arsenal_purchase(database):
    engine, (user, other) = database
    with engine.begin() as conn:
        conn.execute(text("INSERT INTO fitness_progress (user_id, xp, coins) VALUES (:uid, 50000, 100000)"),
                     {"uid": user})
        equipment = get_equipment(conn, user, read_totals(conn, user))
        item = next(row for row in equipment["items"] if not row["owned"] and row["unlock"]["met"] and row["priceCoins"] > 0)

    body = ArmoryAction(id=item["id"], action="buy")
    result = concurrently(engine, lambda conn: mutate_arsenal(conn, user, body))
    assert result == [{"id": item["id"]}] * 2
    with engine.connect() as conn:
        assert read_totals(conn, user)["coins"] == 100000 - item["priceCoins"]
        entries = conn.execute(text("""
            SELECT coin_delta FROM fitness_progress_ledger WHERE user_id = :uid
        """), {"uid": user}).scalars().all()
        assert entries == [-item["priceCoins"]]
        assert read_totals(conn, other)["coins"] == 0
