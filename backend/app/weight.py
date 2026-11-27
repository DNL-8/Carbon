import re
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import text
from sqlalchemy.engine import Connection

from .db import get_db
from .health_summary import today_in_sao_paulo
from .write_access import require_write_user

router = APIRouter()


def iso_day(value: object) -> str:
    if not isinstance(value, str) or not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value):
        raise ValueError("Data invalida")
    date.fromisoformat(value)
    return value


class WeightInput(BaseModel):
    kg: Annotated[float, Field(strict=True, ge=20, le=500, allow_inf_nan=False)]
    dateKey: str | None = None

    @field_validator("dateKey", mode="before")
    @classmethod
    def validate_day(cls, value: object) -> str:
        return iso_day(value)


class DeleteWeightInput(BaseModel):
    dateKey: str

    @field_validator("dateKey", mode="before")
    @classmethod
    def validate_day(cls, value: object) -> str:
        return iso_day(value)


def save_weight(db: Connection, user: str, day: str, kg: float) -> None:
    db.execute(text("""
        INSERT INTO fitness_weight_check_in (user_id, day, kg)
        VALUES (:uid, :day, :kg)
        ON CONFLICT (user_id, day) DO UPDATE SET kg = EXCLUDED.kg
    """), {"uid": user, "day": day, "kg": kg})


def delete_weight(db: Connection, user: str, day: str) -> None:
    db.execute(text("""
        DELETE FROM fitness_weight_check_in WHERE user_id = :uid AND day = :day
    """), {"uid": user, "day": day})


@router.put("/api/saude/peso")
def put_weight(
    body: WeightInput,
    user: Annotated[str, Depends(require_write_user)],
    db: Annotated[Connection, Depends(get_db)],
):
    today = today_in_sao_paulo().isoformat()
    day = body.dateKey or today
    if day > today:
        raise HTTPException(400, "Data futura nao permitida")
    save_weight(db, user, day, body.kg)
    db.commit()
    return {"kg": body.kg}


@router.delete("/api/saude/peso")
def remove_weight(
    body: DeleteWeightInput,
    user: Annotated[str, Depends(require_write_user)],
    db: Annotated[Connection, Depends(get_db)],
):
    delete_weight(db, user, body.dateKey)
    db.commit()
    return {"deleted": True}
