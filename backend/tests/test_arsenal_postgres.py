"""Test purchases and equip against temporary tables in the disposable database."""
import json
import os
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

from app.arsenal import (
    ArmoryAction,
    ChangeLoadout,
    SaveLoadout,
    get_equipment,
    mutate_arsenal,
    mutate_loadout,
    read_gear,
    read_totals,
)
from app.equipment import CATALOG


def test_purchase_idempotence_and_isolation():
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
            for ddl in (
                "fitness_progress (user_id text PRIMARY KEY, xp int DEFAULT 0, coins int DEFAULT 0, hp int DEFAULT 100)",
                "fitness_arsenal (user_id text PRIMARY KEY, owned jsonb, equipped jsonb, loadouts jsonb DEFAULT '[]')",
                "fitness_completion (user_id text, created_at timestamptz, coins int, boss_defeated boolean)",
                "fitness_quest_claim (user_id text, coins int)",
                "fitness_progress_ledger (user_id text, kind text, title text, xp_delta int, coin_delta int, total_xp int, gold_coins int)",
            ):
                db.execute(text("CREATE TEMP TABLE " + ddl + " ON COMMIT DROP"))
            db.execute(text("INSERT INTO fitness_progress VALUES ('a', 50000, 100000, 100), ('b', 0, 0, 100)"))
            gear = get_equipment(db, "a", read_totals(db, "a"))
            assert len(gear["items"]) == len(CATALOG)
            item = next(row for row in gear["items"] if not row["owned"] and row["unlock"]["met"] and row["priceCoins"] > 0)
            ident = item["id"]
            buy = ArmoryAction(id=ident, action="buy")
            with pytest.raises(HTTPException) as exc:
                mutate_arsenal(db, "b", buy)
            assert exc.value.status_code == 409
            assert mutate_arsenal(db, "a", buy) == {"id": ident}
            assert mutate_arsenal(db, "a", buy) == {"id": ident}
            assert read_totals(db, "a")["coins"] == 100000 - item["priceCoins"]
            assert db.execute(text("SELECT count(*) FROM fitness_progress_ledger")).scalar_one() == 1
            mutate_arsenal(db, "a", ArmoryAction(id=ident, action="equip"))
            assert read_gear(db, "a")["equipped"][item["slot"]] == ident
            assert ident not in read_gear(db, "b")["owned"]
            reward = next(row for row in gear["items"] if row["acquisition"] == "reward"
                          and row["requirement"] == {"tipo": "rank_cacador", "valor": 7})
            claim = ArmoryAction(id=reward["id"], action="buy")
            with pytest.raises(HTTPException) as exc:
                mutate_arsenal(db, "b", claim)
            assert exc.value.status_code == 409
            balance = read_totals(db, "a")["coins"]
            equipped_before = read_gear(db, "a")["equipped"]
            assert mutate_arsenal(db, "a", claim) == {"id": reward["id"]}
            assert mutate_arsenal(db, "a", claim) == {"id": reward["id"]}
            assert read_gear(db, "a")["owned"].count(reward["id"]) == 1
            assert read_gear(db, "a")["equipped"] == equipped_before
            assert read_totals(db, "a")["coins"] == balance
            assert reward["id"] not in read_gear(db, "b")["owned"]
            assert db.execute(text("SELECT count(*) FROM fitness_progress_ledger")).scalar_one() == 1
            uid = "d99676b3-0000-4000-8000-000000000001"
            saved = mutate_loadout(db, "a", SaveLoadout(action="save", id=uid, name="  Build  "))
            assert saved[0]["name"] == "Build"
            assert mutate_loadout(db, "a", SaveLoadout(action="save", id=uid, name="Other")) == saved
            with pytest.raises(HTTPException) as exc:
                mutate_loadout(db, "b", ChangeLoadout(action="apply", id=uid))
            assert exc.value.status_code == 404
            assert mutate_loadout(db, "a", ChangeLoadout(action="apply", id=uid)) == saved
            for i in range(2, 11):
                other = f"d99676b3-0000-4000-8000-{i:012d}"
                mutate_loadout(db, "a", SaveLoadout(action="save", id=other, name="Other"))
            with pytest.raises(HTTPException) as exc:
                mutate_loadout(db, "a", SaveLoadout(
                    action="save", id="d99676b3-0000-4000-8000-000000000011", name="Overflow",
                ))
            assert exc.value.status_code == 409
            invalid = [{**saved[0], "gear": {"arma": "elmo_couro_novato"}}]
            db.execute(text("UPDATE fitness_arsenal SET loadouts = CAST(:data AS jsonb) WHERE user_id = 'a'"),
                       {"data": json.dumps(invalid)})
            with pytest.raises(HTTPException) as exc:
                mutate_loadout(db, "a", ChangeLoadout(action="apply", id=uid))
            assert exc.value.status_code == 409
            assert mutate_loadout(db, "a", ChangeLoadout(action="delete", id=uid)) == []
            assert mutate_loadout(db, "a", ChangeLoadout(action="delete", id=uid)) == []
            assert read_gear(db, "b")["loadouts"] == []
            assert db.execute(text("SELECT count(*) FROM fitness_progress_ledger")).scalar_one() == 1
            db.rollback()
    finally:
        engine.dispose()


def test_concurrent_reward_and_purchase():
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
    schema = "arsenal_test_" + uuid4().hex
    reward = next(row for row in CATALOG if row["acquisition"] == "reward" and row["requirement"] == {
        "tipo": "rank_cacador", "valor": 7,
    })
    purchase = next(row for row in CATALOG if row["acquisition"] == "purchase")
    try:
        with engine.begin() as db:
            db.execute(text(f'CREATE SCHEMA "{schema}"'))
            db.execute(text(f'SET LOCAL search_path TO "{schema}"'))
            for ddl in (
                "fitness_progress (user_id text PRIMARY KEY, xp int DEFAULT 0, coins int DEFAULT 0, hp int DEFAULT 100)",
                "fitness_arsenal (user_id text PRIMARY KEY, owned jsonb, equipped jsonb, loadouts jsonb DEFAULT '[]')",
                "fitness_completion (user_id text, created_at timestamptz, coins int, boss_defeated boolean)",
                "fitness_quest_claim (user_id text, coins int)",
                "fitness_progress_ledger (user_id text, kind text, title text, xp_delta int, coin_delta int, total_xp int, gold_coins int)",
            ):
                db.execute(text("CREATE TABLE " + ddl))
            db.execute(text("INSERT INTO fitness_progress VALUES ('a', 50000, 100000, 100), ('b', 0, 0, 100)"))
        for item in (reward, purchase):
            gate = Barrier(2)

            def acquire(gate, item_id):
                with engine.begin() as db:
                    db.execute(text(f'SET LOCAL search_path TO "{schema}"'))
                    gate.wait(timeout=10)
                    return mutate_arsenal(db, "a", ArmoryAction(id=item_id, action="buy"))

            with ThreadPoolExecutor(max_workers=2) as pool:
                futures = [pool.submit(acquire, gate, item['id']) for _ in range(2)]
                assert [f.result(timeout=20) for f in futures] == [{"id": item["id"]}] * 2
        with engine.begin() as db:
            db.execute(text(f'SET LOCAL search_path TO "{schema}"'))
            gear = read_gear(db, "a")
            assert gear["owned"].count(reward["id"]) == 1
            assert gear["owned"].count(purchase["id"]) == 1
            assert reward["id"] not in gear["equipped"].values()
            assert purchase["id"] not in gear["equipped"].values()
            assert read_totals(db, "a")["coins"] == 100000 - purchase["priceCoins"]
            assert reward["id"] not in read_gear(db, "b")["owned"]
            assert db.execute(text("SELECT count(*) FROM fitness_progress_ledger")).scalar_one() == 1
    finally:
        with engine.begin() as db:
            db.execute(text(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE'))
        engine.dispose()
