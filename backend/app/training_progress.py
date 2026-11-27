from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.engine import Connection

from .auth import require_user
from .catalog import workout_catalog
from .db import get_db
from .equipment import DEFAULT_GEAR, gear_bonus
from .health_summary import today_in_sao_paulo
from .progression import calculate_level, dual_progression, effective_streak

router = APIRouter()
TYPE_KEYS = {
    "forca": "forcaWorkouts", "cardio": "cardioWorkouts", "hiit": "hiitWorkouts",
    "core": "coreWorkouts", "mobilidade": "mobilidadeWorkouts",
    "corpo_inteiro": "corpoInteiroWorkouts",
}


def streaks(days: list[str]) -> tuple[int, int]:
    streak = longest = 0
    previous = None
    for day in days:
        current = date.fromisoformat(day)
        streak = streak + 1 if previous and (current - previous).days == 1 else 1
        longest = max(longest, streak)
        previous = current
    return streak, longest


def read_training_progress(db: Connection, user: str, today: str) -> dict:
    params = {"uid": user}
    totals = db.execute(text("""
        SELECT xp, coins, hp FROM fitness_progress WHERE user_id = :uid
    """), params).mappings().first()
    days = db.execute(text("""
        SELECT DISTINCT CAST(CAST(timezone('America/Sao_Paulo', created_at) AS date) AS text)
        AS day FROM fitness_completion WHERE user_id = :uid ORDER BY day
    """), params).scalars().all()
    counts = db.execute(text("""
        SELECT workout_id, workout_snapshot->>'type' AS type, CAST(count(*) AS int) AS count,
        CAST(count(*) FILTER (WHERE boss_defeated) AS int) AS bosses,
        coalesce(sum(CAST(workout_snapshot->>'elapsedSeconds' AS double precision)), 0) AS elapsed
        FROM fitness_completion WHERE user_id = :uid
        GROUP BY workout_id, workout_snapshot->>'type'
    """), params).mappings().all()
    streak, longest = streaks(days)
    last_day = days[-1] if days else None
    xp = totals["xp"] if totals else 0
    stats = {
        "userId": user, "totalXp": xp, "level": calculate_level(xp),
        "hunterHp": totals["hp"] if totals else 100,
        "goldCoins": totals["coins"] if totals else 0,
        "currentStreak": effective_streak(streak, last_day, today),
        "longestStreak": longest, "lastWorkoutDate": last_day,
        "totalWorkouts": sum(item["count"] for item in counts),
        "bossesDefeated": sum(item["bosses"] for item in counts),
        "totalMinutes": sum(item["elapsed"] for item in counts) / 60,
        **dict.fromkeys(TYPE_KEYS.values(), 0),
    }
    catalog_types = {item["id"]: item["type"] for item in workout_catalog()}
    for item in counts:
        kind = item["type"] if item["type"] is not None else catalog_types.get(item["workout_id"])
        if kind in TYPE_KEYS:
            stats[TYPE_KEYS[kind]] += item["count"]
    return stats


def read_progress_response(db: Connection, user: str, today: str) -> dict:
    stats = read_training_progress(db, user, today)
    gear = db.execute(text("""
        SELECT equipped FROM fitness_arsenal WHERE user_id = :uid
    """), {"uid": user}).scalar_one_or_none()
    equipped = DEFAULT_GEAR if gear is None else gear
    dual = dual_progression(stats, today)
    return {
        "xp": stats["totalXp"], "currentStreak": stats["currentStreak"],
        "equippedGear": equipped, "coins": stats["goldCoins"],
        "rank": dual["hunter"]["current"]["rank"], "level": dual["hunter"]["level"],
        "realm": dual["murim"]["current"]["name"], "hp": stats["hunterHp"],
        "bossDamageBonus": gear_bonus(equipped)["bossDamageBonusPercent"], "dual": dual,
    }


@router.get("/api/progresso")
def progress(
    user: Annotated[str, Depends(require_user)],
    db: Annotated[Connection, Depends(get_db)],
):
    return read_progress_response(db, user, today_in_sao_paulo().isoformat())
