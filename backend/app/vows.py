"""Daily vows and their transactional effects on hunter progress."""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, StringConstraints, field_validator
from sqlalchemy import text
from sqlalchemy.engine import Connection

from .arsenal import read_totals
from .db import get_db
from .health_summary import today_in_sao_paulo
from .profile import js_length
from .workouts import WorkoutId
from .write_access import require_write_user

router = APIRouter()


class CreateVow(BaseModel):
    action: Literal["create"]
    id: WorkoutId
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]

    @field_validator("title")
    @classmethod
    def valid_title(cls, title: str) -> str:
        if js_length(title) > 120:
            raise ValueError("Titulo invalido")
        return title


class ChangeVow(BaseModel):
    action: Literal["complete", "violate", "delete"]
    id: WorkoutId


VowInput = Annotated[CreateVow | ChangeVow, Field(discriminator="action")]


def change_vow(db: Connection, user: str, body: CreateVow | ChangeVow, today: str) -> dict:
    balance = read_totals(db, user, lock=True)
    params = {"uid": user, "id": body.id}
    vow = db.execute(text("""
        SELECT title, resolved_day, outcome FROM fitness_daily_vow WHERE user_id = :uid AND id = :id
    """), params).mappings().first()
    result = {"id": body.id}
    if isinstance(body, CreateVow):
        if vow:
            return result
        count = db.execute(text("SELECT count(*) FROM fitness_daily_vow WHERE user_id = :uid"), params).scalar_one()
        if count >= 20:
            raise HTTPException(409, "Limite de votos ativos")
        db.execute(text("""
            INSERT INTO fitness_daily_vow (user_id, id, title) VALUES (:uid, :id, :title)
        """), {**params, "title": body.title})
        return result
    if body.action == "delete":
        if vow and vow["resolved_day"] == today:
            raise HTTPException(409, "Remova o voto a partir de amanha")
        db.execute(text("DELETE FROM fitness_daily_vow WHERE user_id = :uid AND id = :id"), params)
        return result
    if vow is None:
        raise HTTPException(404, "Voto inexistente")
    if vow["resolved_day"] == today:
        if vow["outcome"] == body.action:
            return result
        raise HTTPException(409, "Voto ja resolvido hoje")

    completed = body.action == "complete"
    xp = max(0, balance["xp"] + (15 if completed else -15))
    hp = min(100, max(0 if completed else 10, balance["hp"] + (5 if completed else -15)))
    entry = {
        **params, "day": today, "outcome": body.action, "xp": xp, "hp": hp,
        "delta": xp - balance["xp"], "coins": balance["coins"], "title": vow["title"],
        "kind": "vow_completed" if completed else "vow_broken",
    }
    db.execute(text("""
        UPDATE fitness_daily_vow SET resolved_day = :day, outcome = :outcome WHERE user_id = :uid AND id = :id
    """), entry)
    db.execute(text("UPDATE fitness_progress SET xp = :xp, hp = :hp WHERE user_id = :uid"), entry)
    db.execute(text("""
        INSERT INTO fitness_progress_ledger (user_id, kind, title, xp_delta, coin_delta, total_xp, gold_coins)
        VALUES (:uid, :kind, :title, :delta, 0, :xp, :coins)
    """), entry)
    return result


@router.post("/api/votos")
def update_vow(body: VowInput, user: Annotated[str, Depends(require_write_user)],
               db: Annotated[Connection, Depends(get_db)]):
    with db.begin():
        return change_vow(db, user, body, today_in_sao_paulo().isoformat())
