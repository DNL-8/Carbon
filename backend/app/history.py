import json
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.engine import Connection

from .auth import require_user
from .catalog import workout_catalog
from .dates import js_iso_timestamp
from .db import get_db

router = APIRouter()


def first_defined(*values):
    return next((value for value in values if value is not None), None)


def read_history(db: Connection, user: str) -> dict:
    params = {"uid": user}
    history = db.execute(text("""
        SELECT id, workout_id AS "workoutId", sets, xp, coins,
          created_at AS "createdAt", workout_snapshot AS snapshot
        FROM fitness_completion WHERE user_id = :uid
        ORDER BY created_at DESC, id DESC LIMIT 30
    """), params).mappings().all()
    records = db.execute(text("""
        SELECT exercise_id AS "exerciseId", best_weight_kg AS "bestWeightKg",
          best_reps AS "bestReps", best_volume_kg AS "bestVolumeKg",
          estimated_1rm_kg AS "estimated1RmKg"
        FROM fitness_exercise_record WHERE user_id = :uid
    """), params).mappings().all()
    custom = db.execute(text("""
        SELECT data FROM fitness_custom_workout WHERE user_id = :uid
    """), params).scalars().all()

    catalog = workout_catalog()
    workout_names = {item["id"]: item["name"] for item in catalog}
    exercise_names = {
        exercise["id"]: exercise["name"]
        for item in catalog for exercise in item["exercises"]
    }
    personal_names = {
        exercise["id"]: exercise["name"]
        for item in custom for exercise in item["exercises"]
    }

    result_history = []
    for entry in history:
        row = dict(entry)
        snapshot = row.pop("snapshot") or {}
        snapshot_names = snapshot.get("exercises") or {}
        for exercise_id, name in snapshot_names.items():
            personal_names.setdefault(exercise_id, name)
        row["name"] = first_defined(
            snapshot.get("name"), workout_names.get(row["workoutId"]), row["workoutId"],
        )
        row["sets"] = [
            {**item, "name": first_defined(
                snapshot_names.get(item["exerciseId"]),
                exercise_names.get(item["exerciseId"]), item["exerciseId"],
            )}
            for item in row["sets"]
        ]
        row["createdAt"] = js_iso_timestamp(row["createdAt"])
        result_history.append(row)

    result_records = []
    for entry in records:
        row = dict(entry)
        exercise_id = row["exerciseId"]
        row["name"] = first_defined(
            exercise_names.get(exercise_id), personal_names.get(exercise_id), exercise_id,
        )
        result_records.append(row)

    if result_records:
        # PostgreSQL ICU mirrors the Portuguese collation used by Intl/localeCompare.
        # Ordinality preserves the incoming order for equivalent names.
        indexes = db.execute(text("""
            SELECT ordinality FROM jsonb_array_elements_text(CAST(:names AS jsonb))
            WITH ORDINALITY AS item(name, ordinality)
            ORDER BY name COLLATE "pt-BR-x-icu", ordinality
        """), {"names": json.dumps([row["name"] for row in result_records])}).scalars().all()
        result_records = [result_records[index - 1] for index in indexes]

    return {"history": result_history, "records": result_records}


@router.get("/api/treinos/historico")
def training_history(
    user: Annotated[str, Depends(require_user)],
    db: Annotated[Connection, Depends(get_db)],
):
    return read_history(db, user)
