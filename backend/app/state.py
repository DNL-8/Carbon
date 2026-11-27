"""Raw character state for synchronizing the existing Nuxt client."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.engine import Connection

from .arsenal import read_totals
from .auth import require_user
from .db import get_db
from .health_summary import today_in_sao_paulo
from .quests import read_quests

router = APIRouter()


@router.get("/api/estado")
def state(user: Annotated[str, Depends(require_user)], db: Annotated[Connection, Depends(get_db)]):
    params = {"uid": user}
    profile = db.execute(text("SELECT data FROM fitness_hero_profile WHERE user_id = :uid"), params).scalar_one_or_none()
    gear = db.execute(text("SELECT equipped, owned, loadouts FROM fitness_arsenal WHERE user_id = :uid"), params).mappings().first()
    workouts = db.execute(text("SELECT data FROM fitness_custom_workout WHERE user_id = :uid"), params).scalars().all()
    vows = db.execute(text("""
        SELECT id, title, resolved_day AS "resolvedDay", outcome FROM fitness_daily_vow WHERE user_id = :uid
    """), params).mappings()
    return {
        "profile": profile, "stats": read_totals(db, user), "arsenal": dict(gear) if gear else None,
        "workouts": list(workouts), "vows": [dict(item) for item in vows],
        "missions": read_quests(db, user, today_in_sao_paulo().isoformat()),
    }
