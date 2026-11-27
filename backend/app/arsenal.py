"""Armory reads and atomic purchase/equip operations."""
import json
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, BeforeValidator, Field
from sqlalchemy import text
from sqlalchemy.engine import Connection

from .auth import require_user
from .db import get_db
from .equipment import BY_ID, CATALOG, DEFAULT_GEAR
from .profile import js_length
from .progression import RANKS, REALMS, calculate_level, dual_progression
from .training_progress import streaks
from .workouts import WorkoutId, trimmed
from .write_access import require_write_user

router = APIRouter()
DEFAULT_OWNED = ["elmo_couro_novato", "arma_bastao_treino"]


def pt_number(value: int) -> str:
    return f"{value:,}".replace(",", ".")


def requirement_progress(item: dict, stats: dict) -> dict:
    kind, target = item["requirement"]["tipo"], item["requirement"]["valor"]
    if kind == "inicial":
        return {"met": True, "current": 1, "target": 1, "progressText": "Requisito liberado"}
    if kind == "rank_cacador":
        rank = stats["dual"]["hunter"]["current"]["rank"]
        current = next(i + 1 for i, row in enumerate(RANKS) if row["rank"] == rank)
        target = max(1, min(len(RANKS), target))
        label = f"Atual: Rank {rank} · Requer: Rank {RANKS[target - 1]['rank']}"
    elif kind == "reino_murim":
        realm = REALMS[max(0, min(len(REALMS) - 1, target - 1))]
        target = realm["minQi"]
        murim = stats["dual"]["murim"]
        current = murim["qiPoints"]
        label = f"{murim['current']['name']} · {pt_number(min(current, target))}/{pt_number(target)} Qi"
    elif kind == "nivel":
        current = stats["level"]
        label = f"Nível {current}/{target}"
    else:
        key, suffix = {
            "moedas_acumuladas": ("totalCoinsEarned", "moedas acumuladas"),
            "streak_dias": ("longestStreak", "dias de streak"),
            "chefes_derrotados": ("bossesDefeated", "chefes derrotados"),
            "treinos_concluidos": ("totalWorkouts", "treinos concluídos"),
        }[kind]
        current = stats[key]
        formatter = pt_number if kind == "moedas_acumuladas" else str
        label = f"{formatter(min(current, target))}/{formatter(target)} {suffix}"
    return {"met": current >= target, "current": current, "target": target, "progressText": label}


def read_totals(db: Connection, user: str, *, lock: bool = False) -> dict:
    params = {"uid": user}
    if lock:
        db.execute(text("INSERT INTO fitness_progress (user_id) VALUES (:uid) ON CONFLICT DO NOTHING"), params)
    query = "SELECT xp, coins, hp FROM fitness_progress WHERE user_id = :uid"
    if lock:
        query += " FOR UPDATE"
    row = db.execute(text(query), params).mappings().first()
    return dict(row) if row else {"xp": 0, "coins": 0, "hp": 100}


def read_gear(db: Connection, user: str) -> dict:
    row = db.execute(text("""
        SELECT owned, equipped, loadouts FROM fitness_arsenal WHERE user_id = :uid
    """), {"uid": user}).mappings().first()
    return dict(row) if row else {
        "owned": list(DEFAULT_OWNED), "equipped": dict(DEFAULT_GEAR), "loadouts": [],
    }


def get_equipment(db: Connection, user: str, totals: dict) -> dict:
    gear = read_gear(db, user)
    params = {"uid": user}
    workouts = db.execute(text("""
        SELECT CAST(CAST(timezone('America/Sao_Paulo', created_at) AS date) AS text) AS day,
          coins, boss_defeated FROM fitness_completion WHERE user_id = :uid
    """), params).mappings().all()
    claims = db.execute(text("""
        SELECT coalesce(sum(coins), 0) FROM fitness_quest_claim WHERE user_id = :uid
    """), params).scalar_one()
    _, longest = streaks(sorted({row["day"] for row in workouts}))
    # Nitro evaluates requirements using starter ownership and initial streak/minute fields.
    stats = {
        "totalXp": totals["xp"], "level": calculate_level(totals["xp"]),
        "totalCoinsEarned": max(claims + sum(row["coins"] for row in workouts), max(0, totals["coins"])),
        "totalWorkouts": len(workouts), "bossesDefeated": sum(row["boss_defeated"] for row in workouts),
        "longestStreak": longest, "currentStreak": 0, "lastWorkoutDate": None, "totalMinutes": 0,
    }
    stats["dual"] = dual_progression(stats, "1970-01-01")
    gear["items"] = [
        {**item, "owned": item["id"] in gear["owned"],
         "equipped": gear["equipped"].get(item["slot"]) == item["id"],
         "unlock": requirement_progress(item, stats)}
        for item in CATALOG
    ]
    return gear


class ArmoryAction(BaseModel):
    id: Annotated[str, Field(min_length=1, max_length=120)]
    action: Literal["buy", "equip"]


def mutate_arsenal(db: Connection, user: str, body: ArmoryAction) -> dict:
    if js_length(body.id) > 120:
        raise HTTPException(400, "Dados invalidos")
    totals = read_totals(db, user, lock=True)
    gear = get_equipment(db, user, totals)
    item = next((row for row in gear["items"] if row["id"] == body.id), None)
    if not item:
        raise HTTPException(404, "Equipamento inexistente")
    if body.action == "buy":
        if item["owned"]:
            return {"id": body.id}
        if not item["unlock"]["met"] or totals["coins"] < item["priceCoins"]:
            raise HTTPException(409, "Requisitos ou moedas insuficientes")
        gear["owned"] = [*gear["owned"], body.id]
    else:
        if not item["owned"]:
            raise HTTPException(409, "Equipamento ainda nao adquirido")
        gear["equipped"] = {**gear["equipped"], item["slot"]: body.id}
    db.execute(text("""
        INSERT INTO fitness_arsenal (user_id, owned, equipped)
        VALUES (:uid, CAST(:owned AS jsonb), CAST(:equipped AS jsonb))
        ON CONFLICT (user_id) DO UPDATE SET owned = EXCLUDED.owned, equipped = EXCLUDED.equipped
    """), {"uid": user, "owned": json.dumps(gear["owned"]), "equipped": json.dumps(gear["equipped"])})
    if body.action == "buy":
        coins = totals["coins"] - item["priceCoins"]
        db.execute(text("UPDATE fitness_progress SET coins = :coins WHERE user_id = :uid"),
                   {"uid": user, "coins": coins})
        db.execute(text("""
            INSERT INTO fitness_progress_ledger
            (user_id, kind, title, xp_delta, coin_delta, total_xp, gold_coins)
            VALUES (:uid, 'armory_purchase', :title, 0, :delta, :xp, :coins)
        """), {"uid": user, "title": item["name"], "delta": -item["priceCoins"],
               "xp": totals["xp"], "coins": coins})
    return {"id": body.id}


@router.get("/api/arsenal")
def arsenal(user: Annotated[str, Depends(require_user)], db: Annotated[Connection, Depends(get_db)]):
    return get_equipment(db, user, read_totals(db, user))["items"]


@router.post("/api/arsenal")
def arsenal_action(
    body: ArmoryAction,
    user: Annotated[str, Depends(require_write_user)],
    db: Annotated[Connection, Depends(get_db)],
):
    result = mutate_arsenal(db, user, body)
    db.commit()
    return result


class SaveLoadout(BaseModel):
    action: Literal["save"]
    id: WorkoutId
    name: Annotated[str, BeforeValidator(trimmed(1, 60))]


class ChangeLoadout(BaseModel):
    action: Literal["apply", "delete"]
    id: WorkoutId


LoadoutAction = Annotated[SaveLoadout | ChangeLoadout, Field(discriminator="action")]


def mutate_loadout(db: Connection, user: str, body: LoadoutAction) -> list:
    # Share the same owner progress lock as purchases and equip.
    read_totals(db, user, lock=True)
    gear = read_gear(db, user)
    selected = next((row for row in gear["loadouts"] if row["id"] == body.id), None)
    if body.action == "save":
        if selected:
            return gear["loadouts"]
        if len(gear["loadouts"]) >= 10:
            raise HTTPException(409, "Limite de conjuntos salvos")
        gear["loadouts"] = [
            *gear["loadouts"], {"id": body.id, "name": body.name, "gear": gear["equipped"]},
        ]
    elif body.action == "delete":
        gear["loadouts"] = [row for row in gear["loadouts"] if row["id"] != body.id]
    else:
        if not selected:
            raise HTTPException(404, "Conjunto inexistente")
        for slot, ident in selected["gear"].items():
            if ident is not None and (
                not isinstance(ident, str) or ident not in gear["owned"]
                or ident not in BY_ID or BY_ID[ident]["slot"] != slot
            ):
                raise HTTPException(409, "Conjunto contem equipamento indisponivel")
        gear["equipped"] = selected["gear"]
    db.execute(text("""
        INSERT INTO fitness_arsenal (user_id, owned, equipped, loadouts)
        VALUES (:uid, CAST(:owned AS jsonb), CAST(:equipped AS jsonb), CAST(:loadouts AS jsonb))
        ON CONFLICT (user_id) DO UPDATE SET
            equipped = EXCLUDED.equipped, loadouts = EXCLUDED.loadouts
    """), {"uid": user, **{key: json.dumps(gear[key]) for key in ("owned", "equipped", "loadouts")}})
    return gear["loadouts"]


@router.post("/api/arsenal/conjuntos")
def loadout_action(
    body: LoadoutAction,
    user: Annotated[str, Depends(require_write_user)],
    db: Annotated[Connection, Depends(get_db)],
):
    result = mutate_loadout(db, user, body)
    db.commit()
    return result
