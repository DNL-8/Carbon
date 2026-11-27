"""Daily and weekly objectives, their claims, and the weekly raid."""

from datetime import date, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.engine import Connection

from .arsenal import read_totals
from .auth import require_user
from .db import get_db
from .health_summary import today_in_sao_paulo
from .progression import js_round
from .rewards import fixed
from .write_access import require_write_user

router = APIRouter()
ROSTER = (
    ("Hidra do Ferro Semanal", "Drene o HP compartilhado concluindo treinos e volume de segunda a domingo", "hydra"),
    ("Colosso de Basalto", "Volume levantado e recordes pessoais causam dano massivo à armadura semanal", "golem"),
    ("Sentinela da Torre Vermelha", "Consistência de 3+ treinos na semana rompe o escudo da cidadela", "sentinel"),
    ("Dragão do Monarca Semanal", "Chefe supremo da semana: combine volume, PRs e missões semanais", "dragon"),
)
WORKOUT_DAY = "CAST(CAST(timezone('America/Sao_Paulo', created_at) AS date) AS text)"


class ClaimInput(BaseModel):
    id: Literal[
        "workout_today", "steps_6000", "weight_today", "weekly_workouts_3",
        "weekly_volume_4000", "weekly_pr_1",
    ] = "workout_today"


def read_week(db: Connection, user: str, today: str) -> tuple[list, list]:
    day = date.fromisoformat(today)
    monday = day - timedelta(days=day.weekday())
    params = {"uid": user, "start": monday.isoformat(), "end": (monday + timedelta(days=6)).isoformat()}
    workouts = db.execute(text(f"""
        SELECT {WORKOUT_DAY} AS day, sets, record_count FROM fitness_completion
        WHERE user_id = :uid AND {WORKOUT_DAY} BETWEEN :start AND :end
    """), params).mappings().all()
    activities = db.execute(text("""
        SELECT data->>'dateKey' FROM fitness_health_activity
        WHERE user_id = :uid AND data->>'dateKey' BETWEEN :start AND :end
    """), params).scalars().all()
    return workouts, activities


def weekly_raid(today: str, workouts: list, activities: list) -> dict:
    year, week, _ = date.fromisoformat(today).isocalendar()
    # Nitro aggregates sets within a workout before accumulating the weekly total.
    volume = int(fixed(sum(sum(min(500, item["weightKg"]) * item["reps"]
                             for item in row["sets"]) for row in workouts), 0))
    records = sum(row["record_count"] for row in workouts)
    count = len(workouts) + len(activities)
    damage = min(120, count * 25 + (volume // 200) * 2 + records * 15)
    hp = 120 - damage
    name, subtitle, variant = ROSTER[week % len(ROSTER)]
    return {
        "weekKey": f"{year:04d}-W{week:02d}", "bossName": name, "bossSubtitle": subtitle,
        "variant": variant, "maxHp": 120, "currentHp": hp, "damageDealt": damage,
        "hpPercent": js_round(hp / 120 * 100), "isDefeated": hp == 0,
        "workoutsThisWeek": count, "weeklyVolumeKg": volume, "weeklyPrCount": records,
    }


def decimal_pt(value: float) -> str:
    output = f"{value:,.3f}".rstrip("0").rstrip(".")
    return output.translate(str.maketrans(",.", ".,"))


def evaluate_quests(today: str, workouts: list, activities: list, steps: float,
                    weight: float | None, claims: set[tuple[str, str]]) -> dict:
    raid = weekly_raid(today, workouts, activities)
    week = raid["weekKey"]
    count, volume, records = (raid[key] for key in ("workoutsThisWeek", "weeklyVolumeKg", "weeklyPrCount"))
    trained = today in activities or any(row["day"] == today for row in workouts)
    weighed = weight is not None
    daily_defs = (
        ("steps_6000", "Passos: 6.000 hoje", "Sincronizado via Samsung Health, Apple Health ou CSV",
         25, 20, steps, 6000, f"{decimal_pt(steps)} / 6.000 passos"),
        ("workout_today", "Treino ou Atividade Diária", "Sessão guiada no app ou treino importado (Strava/Samsung/GPX)",
         30, 25, trained, 1, "1 / 1 concluído" if trained else "0 / 1 hoje"),
        ("weight_today", "Check-in de Peso Corporal", "Registre seu peso no card de evolução física hoje",
         15, 15, weighed, 1, "Registrado hoje" if weighed else "Pendente hoje"),
    )
    weekly_defs = (
        ("weekly_workouts_3", "Consistência Semanal", "Complete 3 sessões de treino entre segunda e domingo",
         60, 40, count, 3, f"{count} / 3 treinos", 25),
        ("weekly_volume_4000", "Volume da Semana", "Movimente 4.000 kg somando carga × reps das séries concluídas",
         75, 50, volume, 4000, f"{decimal_pt(volume)} / 4.000 kg", 30),
        ("weekly_pr_1", "Caçador de Recordes", "Bata pelo menos 1 Novo PR de carga, reps ou 1RM na semana",
         50, 35, records, 1, f"{records} / 1 {'PR' if records == 1 else 'PRs'}", 25),
    )

    def evaluate(definition: tuple, period: str) -> dict:
        ident, title, subtitle, xp, coins, value, target, label = definition
        return {
            "id": ident, "title": title, "subtitle": subtitle, "xpReward": xp,
            "coinsReward": coins, "progressText": label,
            "progressPercent": min(100, js_round(value / target * 100)),
            "isFulfilled": value >= target, "period": period, "claimed": (period, ident) in claims,
        }

    daily = [evaluate(row, today) for row in daily_defs]
    for quest in daily:
        quest["isClaimedToday"] = quest["claimed"]
    weekly = [dict(evaluate(row[:-1], week), weekKey=week, raidDamage=row[-1]) for row in weekly_defs]
    for quest in weekly:
        quest["isClaimedThisWeek"] = quest["claimed"]
    return {"daily": daily, "weekly": weekly, "raid": raid, "weightKg": weight}


def read_quests(db: Connection, user: str, today: str) -> dict:
    workouts, activities = read_week(db, user, today)
    year, week, _ = date.fromisoformat(today).isocalendar()
    params = {"uid": user, "day": today, "week": f"{year:04d}-W{week:02d}"}
    claims = set(db.execute(text("""
        SELECT day, quest_id FROM fitness_quest_claim WHERE user_id = :uid AND day IN (:day, :week)
    """), params))
    steps = db.execute(text("""
        SELECT coalesce(max(CAST(data->>'steps' AS double precision)), 0)
        FROM fitness_health_metric WHERE user_id = :uid AND date_key = :day
    """), params).scalar_one()
    weight = db.execute(text("""
        SELECT kg FROM fitness_weight_check_in WHERE user_id = :uid AND day = :day
    """), params).scalar_one_or_none()
    return evaluate_quests(today, workouts, activities, steps, weight, claims)


def claim_quest(db: Connection, user: str, ident: str, today: str) -> dict:
    balance = read_totals(db, user, lock=True)
    missions = read_quests(db, user, today)
    quest = next(item for item in missions["daily"] + missions["weekly"] if item["id"] == ident)
    if quest["claimed"]:
        return {"claimed": True}
    if not quest["isFulfilled"]:
        raise HTTPException(409, "Missao pendente")
    xp, coins = quest["xpReward"], quest["coinsReward"]
    params = {
        "uid": user, "day": quest["period"], "id": ident, "title": quest["title"],
        "xp": xp, "coins": coins, "total_xp": balance["xp"] + xp,
        "gold_coins": balance["coins"] + coins,
    }
    db.execute(text("""
        INSERT INTO fitness_quest_claim (user_id, day, quest_id, xp, coins)
        VALUES (:uid, :day, :id, :xp, :coins)
    """), params)
    db.execute(text("""
        UPDATE fitness_progress SET xp = :total_xp, coins = :gold_coins WHERE user_id = :uid
    """), params)
    db.execute(text("""
        INSERT INTO fitness_progress_ledger (user_id, kind, title, xp_delta, coin_delta, total_xp, gold_coins)
        VALUES (:uid, 'daily_quest', :title, :xp, :coins, :total_xp, :gold_coins)
    """), params)
    return {"claimed": True}


@router.get("/api/missao")
def missions(user: Annotated[str, Depends(require_user)], db: Annotated[Connection, Depends(get_db)]):
    return read_quests(db, user, today_in_sao_paulo().isoformat())


@router.post("/api/missao")
def claim(body: ClaimInput, user: Annotated[str, Depends(require_write_user)],
          db: Annotated[Connection, Depends(get_db)]):
    with db.begin():
        return claim_quest(db, user, body.id, today_in_sao_paulo().isoformat())
