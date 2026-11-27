"""Atomic completion, record updates and achievement rewards."""
import json
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, BeforeValidator, Field, field_validator
from sqlalchemy import text
from sqlalchemy.engine import Connection

from .arsenal import read_gear, read_totals
from .catalog import achievement_definitions, workout_catalog
from .db import get_db
from .equipment import gear_bonus
from .health_summary import today_in_sao_paulo
from .profile import js_length
from .progression import calculate_level
from .quests import read_week, weekly_raid
from .rewards import evaluate_record, session_rewards
from .training_progress import read_training_progress
from .workouts import WorkoutId, json_integer
from .write_access import require_write_user

router = APIRouter()
Identifier = Annotated[str, Field(min_length=1, max_length=120)]


class PerformedSet(BaseModel):
    exerciseId: Identifier
    reps: Annotated[int, Field(strict=True, ge=1, le=500), BeforeValidator(json_integer)]
    weightKg: Annotated[float, Field(strict=True, ge=0, le=2000, allow_inf_nan=False)]

    @field_validator("exerciseId")
    @classmethod
    def valid_length(cls, value: str) -> str:
        if js_length(value) > 120:
            raise ValueError("Identificador invalido")
        return value


class FinishInput(BaseModel):
    id: WorkoutId
    workoutId: Identifier
    elapsedSeconds: Annotated[int, Field(strict=True, ge=0, le=28800), BeforeValidator(json_integer)] = 0
    sets: Annotated[list[PerformedSet], Field(min_length=1, max_length=150)]

    @field_validator("workoutId")
    @classmethod
    def valid_length(cls, value: str) -> str:
        if js_length(value) > 120:
            raise ValueError("Identificador invalido")
        return value


def unlock_achievements(db: Connection, user: str, xp: int, today: str) -> int:
    stats = read_training_progress(db, user, today)
    params = {"uid": user}
    rows = db.execute(text("""
        SELECT id FROM fitness_achievement WHERE user_id = :uid
    """), params).scalars().all()
    pr_count = db.execute(text("""
        SELECT coalesce(sum(record_count), 0) FROM fitness_completion WHERE user_id = :uid
    """), params).scalar_one()
    raid = weekly_raid(today, *read_week(db, user, today))
    checks = {
        "first_blood": stats["totalWorkouts"] >= 1,
        "week_warrior": stats["longestStreak"] >= 7,
        "month_master": stats["longestStreak"] >= 30,
        "fat_burner": stats["cardioWorkouts"] >= 10,
        "iron_will": stats["forcaWorkouts"] >= 10,
        "veteran": stats["totalWorkouts"] >= 10,
        "elite": stats["totalWorkouts"] >= 50,
        "legendary": calculate_level(xp) >= 5,
        "first_pr": pr_count >= 1,
        "pr_collector_10": pr_count >= 10,
        "weekly_raid_clear": raid["isDefeated"],
    }
    bonus = 0
    for definition in achievement_definitions():
        ident = definition["id"]
        if ident not in rows and checks[ident]:
            db.execute(text("""
                INSERT INTO fitness_achievement (user_id, id) VALUES (:uid, :id)
            """), {**params, "id": ident})
            bonus += definition["bonusXp"]
    return bonus


def finish_training(db: Connection, user: str, body: FinishInput, today: str) -> dict:
    current = read_totals(db, user, lock=True)
    params = {"uid": user, "id": body.id, "wid": body.workoutId}
    sets = [item.model_dump() for item in body.sets]
    existing = db.execute(text("""
        SELECT workout_id, sets, xp, coins, boss_defeated FROM fitness_completion
        WHERE user_id = :uid AND id = :id
    """), params).mappings().first()
    if existing:
        old = [PerformedSet.model_validate(item).model_dump() for item in existing["sets"]]
        if existing["workout_id"] != body.workoutId or old != sets:
            raise HTTPException(409, "Treino ja registrado com outros dados")
        return {"earnedXp": existing["xp"], "earnedCoins": existing["coins"],
                "xp": current["xp"], "coins": current["coins"],
                "bossDefeated": existing["boss_defeated"]}
    custom = db.execute(text("""
        SELECT data FROM fitness_custom_workout WHERE user_id = :uid AND id = :wid
    """), params).scalar_one_or_none()
    workout = next((item for item in workout_catalog() if item["id"] == body.workoutId), custom)
    exercise_ids = list(dict.fromkeys(item["exerciseId"] for item in sets))
    if not workout or not set(exercise_ids).issubset({item["id"] for item in workout["exercises"]}):
        raise HTTPException(400, "Treino ou exercicio invalido")
    prs = 0
    for ident in exercise_ids:
        record_params = {"uid": user, "eid": ident}
        previous = db.execute(text("""
            SELECT best_weight_kg AS "bestWeightKg", best_reps AS "bestReps",
              best_volume_kg AS "bestVolumeKg", estimated_1rm_kg AS "estimated1RmKg"
            FROM fitness_exercise_record WHERE user_id = :uid AND exercise_id = :eid
        """), record_params).mappings().first()
        has_pr, metrics = evaluate_record(
            [item for item in sets if item["exerciseId"] == ident], dict(previous) if previous else None,
        )
        prs += int(has_pr)
        db.execute(text("""
            INSERT INTO fitness_exercise_record
              (user_id, exercise_id, best_weight_kg, best_reps, best_volume_kg, estimated_1rm_kg)
            VALUES (:uid, :eid, :bestWeightKg, :bestReps, :bestVolumeKg, :estimated1RmKg)
            ON CONFLICT (user_id, exercise_id) DO UPDATE SET
              best_weight_kg = EXCLUDED.best_weight_kg, best_reps = EXCLUDED.best_reps,
              best_volume_kg = EXCLUDED.best_volume_kg, estimated_1rm_kg = EXCLUDED.estimated_1rm_kg
        """), {**record_params, **metrics})
    reward = session_rewards(workout, sets, body.elapsedSeconds,
                             gear_bonus(read_gear(db, user)["equipped"]), prs)
    snapshot = {"name": workout["name"], "type": workout["type"], "elapsedSeconds": body.elapsedSeconds,
                "exercises": {item["id"]: item["name"] for item in workout["exercises"]}}
    db.execute(text("""
        INSERT INTO fitness_completion
          (user_id, id, workout_id, sets, xp, coins, boss_defeated, record_count, workout_snapshot)
        VALUES (:uid, :id, :wid, CAST(:sets AS jsonb), :earnedXp, :earnedCoins,
          :bossDefeated, :prs, CAST(:snapshot AS jsonb))
    """), {**params, **reward, "sets": json.dumps(sets), "prs": prs, "snapshot": json.dumps(snapshot)})
    achievement_xp = unlock_achievements(db, user, current["xp"] + reward["earnedXp"], today)
    reward["earnedXp"] += achievement_xp
    if achievement_xp:
        db.execute(text("UPDATE fitness_completion SET xp = :xp WHERE user_id = :uid AND id = :id"),
                   {**params, "xp": reward["earnedXp"]})
    xp = current["xp"] + reward["earnedXp"]
    coins = current["coins"] + reward["earnedCoins"]
    db.execute(text("UPDATE fitness_progress SET xp = :xp, coins = :coins WHERE user_id = :uid"),
               {"uid": user, "xp": xp, "coins": coins})
    db.execute(text("""
        INSERT INTO fitness_progress_ledger
          (user_id, kind, title, xp_delta, coin_delta, total_xp, gold_coins)
        VALUES (:uid, 'workout', :title, :earnedXp, :earnedCoins, :xp, :coins)
    """), {"uid": user, "title": workout["name"], **reward, "xp": xp, "coins": coins})
    return {**reward, "xp": xp, "coins": coins}


@router.post("/api/treinos/concluir")
def complete_workout(
    body: FinishInput,
    user: Annotated[str, Depends(require_write_user)],
    db: Annotated[Connection, Depends(get_db)],
):
    result = finish_training(db, user, body, today_in_sao_paulo().isoformat())
    db.commit()
    return result
