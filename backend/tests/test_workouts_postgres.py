"""Real SQL on temporary tables in the local disposable CI database."""
import os

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

from app.workouts import WorkoutInput, delete_workout, save_workout


def test_workout_ownership_and_history():
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
                CREATE TEMP TABLE fitness_custom_workout (
                    user_id text NOT NULL, id text NOT NULL, data jsonb NOT NULL,
                    PRIMARY KEY (user_id, id)
                ) ON COMMIT DROP
            """))
            db.execute(text("""
                CREATE TEMP TABLE fitness_completion (
                    user_id text, workout_id text
                ) ON COMMIT DROP
            """))
            workout_id = "62ea3473-2400-4ea8-b4dd-03e7c50b9649"
            body = {"name": "Treino", "description": "", "type": "forca", "durationMinutes": 30,
                    "exercises": [{"name": "Remada", "prescription": "3 x 10"}]}
            a = save_workout(db, "a", workout_id, WorkoutInput.model_validate(body))
            assert save_workout(db, "a", workout_id, WorkoutInput.model_validate(body)) == a
            b = save_workout(db, "b", workout_id, WorkoutInput.model_validate(body))
            assert a["exercises"][0]["id"] != b["exercises"][0]["id"]
            edit = {**body, "exercises": a["exercises"], "name": "Atualizado"}
            with pytest.raises(HTTPException) as error:
                save_workout(db, "b", workout_id, WorkoutInput.model_validate(edit))
            assert error.value.status_code == 400
            updated = save_workout(db, "a", workout_id, WorkoutInput.model_validate(edit))
            assert updated["exercises"] == a["exercises"]
            assert save_workout(db, "a", workout_id, WorkoutInput.model_validate(edit)) == updated
            db.execute(text("INSERT INTO fitness_completion VALUES ('a', :id)"),
                       {"id": workout_id})
            delete_workout(db, "a", workout_id)
            delete_workout(db, "a", workout_id)
            assert db.execute(text("SELECT user_id, data FROM fitness_custom_workout")).all() == [
                ("b", b),
            ]
            assert db.execute(text("SELECT user_id, workout_id FROM fitness_completion")).all() == [
                ("a", workout_id),
            ]
            db.rollback()
    finally:
        engine.dispose()
