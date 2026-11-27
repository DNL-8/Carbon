"""Dashboard aggregates and training recovery shared with the Oracle."""

from collections import Counter
from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.engine import Connection

from .auth import require_user
from .db import get_db
from .health_summary import today_in_sao_paulo
from .progression import dual_progression, js_round
from .quests import WORKOUT_DAY
from .rewards import fixed
from .training_progress import read_training_progress

router = APIRouter()


def recovery(workouts: list, activities: list, metrics: list, hp: int,
             baseline: float | None, today: str) -> dict:
    def days_ago(day: str) -> int:
        return (date.fromisoformat(today) - date.fromisoformat(day)).days

    logs = [
        {"dateKey": item["dateKey"], "durationMinutes": item["snapshot"]["elapsedSeconds"] / 60}
        for item in workouts
        if isinstance((item["snapshot"] or {}).get("elapsedSeconds"), (int, float))
        and not isinstance(item["snapshot"]["elapsedSeconds"], bool)
    ]
    complete = len(logs) == len(workouts)
    sessions = logs + activities
    if not complete or not any(item["durationMinutes"] > 0 for item in sessions):
        return {"recovery": None, "acwr": None, "completeDurations": complete}

    acute = chronic = 0
    for item in sessions:
        age = days_ago(item["dateKey"])
        if 0 <= age < 28:
            zones = item.get("zoneMinutes") or []
            load = sum(i * value for i, value in enumerate(zones, 1)) if any(zones) else item["durationMinutes"] * 2
            chronic += load
            if age < 7:
                acute += load
    weekly = js_round(chronic / 4)
    ratio = fixed(acute / weekly, 2) if weekly > 0 else (1.0 if acute > 0 else 0.8)
    recent = sorted((item for item in metrics if 0 <= days_ago(item["dateKey"]) < 7),
                    key=lambda item: item["dateKey"], reverse=True)

    def positive(key: str) -> list:
        return [item[key] for item in recent if (item.get(key) or 0) > 0]

    sleep, hrv = positive("sleepHours"), positive("hrvMs")
    avg_sleep = fixed(sum(sleep) / len(sleep), 1) if sleep else None
    latest_hr = next(iter(positive("restingHeartRate")), None) if baseline is not None else None
    score = hp
    if ratio > 1.5:
        score -= 22
    elif ratio > 1.3:
        score -= 12
    elif 0.8 <= ratio <= 1.25:
        score += 6
    if avg_sleep is not None:
        if avg_sleep >= 7.5:
            score += 8
        elif avg_sleep < 6:
            score -= 15
        elif avg_sleep < 7:
            score -= 6
    if latest_hr is not None:
        delta = latest_hr - baseline
        if delta >= 6:
            score -= 12
        elif delta <= -2:
            score += 5
    score = min(100, max(15, js_round(score)))
    if score < 45 or ratio > 1.5:
        label = "Sobrecarga"
        recommendation = "Carga aguda elevada ou recuperação baixa. Priorize hoje Mobilidade, caminhada leve em Zona 1 e sono reparador."
    elif score < 68 or ratio > 1.3:
        label = "Atenção"
        recommendation = "Sinais moderados de fadiga acumulada. Prefira sessões técnicas ou cardio aeróbico leve em Zona 2."
    elif score < 82:
        label = "Moderada"
        recommendation = "Bom equilíbrio entre esforço e descanso. Mantenha volume controlado entre Zonas 2 e 4."
    else:
        label = "Ótima"
        recommendation = "Prontidão elevada! Você pode realizar treinos de Força ou HIIT (Zonas 3–5) com boa margem de recuperação."
    assessment = {
        "score": score, "statusLabel": label, "acwrRatio": ratio, "acuteLoad7d": acute,
        "chronicWeeklyAvg28d": weekly, "avgSleepHours": avg_sleep, "latestRestingHr": latest_hr,
        "avgHrvMs": js_round(sum(hrv) / len(hrv)) if hrv else None, "recommendation": recommendation,
    }
    return {"recovery": assessment if sleep or latest_hr is not None else None,
            "acwr": ratio if weekly else None, "completeDurations": complete}


def attributes(stats: dict, hero_class: str) -> dict:
    values = {
        "forca": 10 + 6 * (hero_class == "Guerreiro") + stats["forcaWorkouts"] * 5
                 + stats["corpoInteiroWorkouts"] * 4 + stats["level"] * 2,
        "resistencia": 10 + 3 * (hero_class in {"Guerreiro", "Arqueiro"}) + stats["cardioWorkouts"] * 4
                       + stats["hiitWorkouts"] * 3 + stats["totalMinutes"] // 20,
        "agilidade": 10 + 6 * (hero_class == "Arqueiro") + stats["hiitWorkouts"] * 5
                     + stats["mobilidadeWorkouts"] * 4 + stats["cardioWorkouts"] * 2,
        "disciplina": 10 + 8 * (hero_class == "Mago") + stats["currentStreak"] * 3
                       + stats["longestStreak"] * 2 + stats["totalWorkouts"] * 2,
    }
    return {key: min(100, max(10, js_round(value))) for key, value in values.items()}


def recent_workouts(db: Connection, params: dict) -> list:
    return list(db.execute(text(f"""
        SELECT {WORKOUT_DAY} AS "dateKey", workout_id AS "workoutId", sets, workout_snapshot AS snapshot
        FROM fitness_completion WHERE user_id = :uid AND {WORKOUT_DAY} BETWEEN :since AND :today
        ORDER BY created_at DESC, id DESC
    """), params).mappings())


def recent_health(db: Connection, params: dict) -> tuple[list, list]:
    activities = db.execute(text("""
        SELECT data FROM fitness_health_activity WHERE user_id = :uid
        AND data->>'dateKey' BETWEEN :since AND :today
    """), params).scalars().all()
    metrics = db.execute(text("""
        SELECT data FROM fitness_health_metric WHERE user_id = :uid
        AND date_key BETWEEN :since AND :today
    """), params).scalars().all()
    return list(activities), list(metrics)


def dashboard_context(user: str, today: date) -> dict:
    return {"uid": user, "since": (today - timedelta(days=27)).isoformat(), "today": today.isoformat()}


@router.get("/api/painel")
def dashboard(user: Annotated[str, Depends(require_user)], db: Annotated[Connection, Depends(get_db)]):
    day = today_in_sao_paulo()
    params = dashboard_context(user, day)
    today = params["today"]
    workouts = recent_workouts(db, params)
    activities, metrics = recent_health(db, params)
    stats = read_training_progress(db, user, today)
    hero = db.execute(text("SELECT data FROM fitness_hero_profile WHERE user_id = :uid"), params).scalar_one_or_none()
    count = db.execute(text("SELECT count(*) FROM fitness_health_activity WHERE user_id = :uid"), params).scalar_one()
    weights = db.execute(text("""
        SELECT day AS "dateKey", kg FROM fitness_weight_check_in WHERE user_id = :uid ORDER BY day DESC LIMIT 90
    """), params).mappings()
    by_day = Counter(item["dateKey"] for item in workouts + activities)
    dates = [(day - timedelta(days=offset)).isoformat() for offset in range(6, -1, -1)]
    steps = [item["steps"] for item in metrics if item["dateKey"] == today and item.get("steps") is not None]
    return {
        "today": today, "days": [{"dateKey": key, "count": by_day[key]} for key in dates],
        "weights": [dict(row) for row in weights],
        "workoutDates": [{key: item[key] for key in ("dateKey", "workoutId")} for item in workouts],
        "stepsToday": max(steps, default=None), "importedCount": count,
        **{key: stats[key] for key in ("totalWorkouts", "bossesDefeated", "longestStreak", "currentStreak")},
        **recovery(workouts, activities, metrics, stats["hunterHp"], (hero or {}).get("restingHrBaseline"), today),
        "dual": dual_progression(stats, today), "attributes": attributes(stats, hero["heroClass"]) if hero else None,
    }
