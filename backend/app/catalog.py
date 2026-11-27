import json
from functools import lru_cache
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.engine import Connection

from .auth import require_user
from .dates import js_iso_timestamp
from .db import get_db

router = APIRouter()
DATA = Path(__file__).parent / "data"


@lru_cache
def workout_catalog() -> list[dict]:
    return json.loads((DATA / "catalog.json").read_text(encoding="utf-8"))


@lru_cache
def achievement_definitions() -> list[dict]:
    return json.loads((DATA / "achievements.json").read_text(encoding="utf-8"))


@router.get("/api/catalogo")
def catalog():
    return workout_catalog()


@router.get("/api/conquistas")
def achievements(
    user: Annotated[str, Depends(require_user)],
    db: Annotated[Connection, Depends(get_db)],
):
    rows = db.execute(text("""
        SELECT id, unlocked_at FROM fitness_achievement WHERE user_id = :uid
    """), {"uid": user}).mappings()
    unlocked = {row["id"]: js_iso_timestamp(row["unlocked_at"]) for row in rows}
    return [
        {**definition, "unlockedAt": unlocked.get(definition["id"])}
        for definition in achievement_definitions()
    ]
