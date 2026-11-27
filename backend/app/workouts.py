import json
import re
from typing import Annotated, Literal, Self
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, BeforeValidator, Field, model_validator
from sqlalchemy import text
from sqlalchemy.engine import Connection

from .db import get_db
from .profile import js_length
from .write_access import require_write_user

router = APIRouter()
UUID_PATTERN = re.compile(
    r"(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}"
    r"|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)",
    re.IGNORECASE,
)


def uuid_string(value: object) -> str:
    if not isinstance(value, str) or not UUID_PATTERN.fullmatch(value):
        raise ValueError("UUID invalido")
    return value


def trimmed(minimum: int, maximum: int):
    def validate(value: object) -> str:
        if not isinstance(value, str):
            raise ValueError("Texto invalido")  # noqa: TRY004 - Pydantic converts ValueError to 400
        value = value.strip().strip("\ufeff").strip()
        if not minimum <= js_length(value) <= maximum:
            raise ValueError("Comprimento invalido")
        return value
    return validate


def json_integer(value: object) -> object:
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return value


WorkoutId = Annotated[str, BeforeValidator(uuid_string)]
Name = Annotated[str, BeforeValidator(trimmed(1, 120))]
Description = Annotated[str, BeforeValidator(trimmed(0, 600))]
Muscle = Annotated[str, BeforeValidator(trimmed(1, 60))]
Equipment = Annotated[str, BeforeValidator(trimmed(0, 120))]
Duration = Annotated[int, Field(strict=True, ge=1, le=300), BeforeValidator(json_integer)]
Rest = Annotated[int, Field(strict=True, ge=0, le=900), BeforeValidator(json_integer)]
Load = Annotated[float, Field(strict=True, ge=0, le=2000, allow_inf_nan=False)]


class ExerciseInput(BaseModel):
    name: Name
    prescription: Name
    id: WorkoutId | None = None
    restSeconds: Rest | None = None
    muscleGroups: Annotated[list[Muscle], Field(max_length=12)] | None = None
    executionTip: Description | None = None
    loadKg: Load | None = None
    equipment: Equipment | None = None
    unilateral: Annotated[bool, Field(strict=True)] | None = None

    @model_validator(mode="after")
    def reject_explicit_null(self) -> Self:
        if any(getattr(self, field) is None for field in self.model_fields_set):
            raise ValueError("Campo opcional nao aceita null")
        return self


class WorkoutInput(BaseModel):
    name: Name
    description: Description
    type: Literal["forca", "cardio", "hiit", "core", "mobilidade", "corpo_inteiro"]
    durationMinutes: Duration
    exercises: Annotated[list[ExerciseInput], Field(min_length=1, max_length=30)]

    @model_validator(mode="after")
    def unique_ids(self) -> Self:
        ids = [exercise.id for exercise in self.exercises if exercise.id is not None]
        if len(ids) != len(set(ids)):
            raise ValueError("Cada exercicio precisa ter um ID unico")
        return self


def lock_workout(db: Connection, user: str, workout_id: str) -> None:
    # Serialize Python writes for this owner/workout even before its row exists.
    # Mixed Nitro/FastAPI writes must remain disabled until cutover.
    db.execute(text("SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))"),
               {"key": json.dumps(["murim-workout", user, workout_id])})


def save_workout(db: Connection, user: str, workout_id: str, body: WorkoutInput) -> dict:
    lock_workout(db, user, workout_id)
    existing = db.execute(text("""
        SELECT data FROM fitness_custom_workout WHERE user_id = :uid AND id = :id
        FOR UPDATE
    """), {"uid": user, "id": workout_id}).scalar_one_or_none()
    known = {exercise["id"] for exercise in existing["exercises"]} if existing else set()
    if any(ex.id is not None and ex.id not in known for ex in body.exercises):
        raise HTTPException(400, "Exercicio invalido para este treino")

    data = body.model_dump(exclude_unset=True)
    data.update(id=workout_id, baseXp=100, rank="F", difficulty="Iniciante")
    for exercise in data["exercises"]:
        exercise.setdefault("restSeconds", 60)
        exercise.setdefault("muscleGroups", [])
        exercise.setdefault("executionTip", "")
    if existing:
        # A retry of the same template can omit IDs assigned in the first response.
        retry = {**data, "exercises": [dict(item) for item in data["exercises"]]}
        for item, stored in zip(retry["exercises"], existing["exercises"]):
            item.setdefault("id", stored["id"])
        if retry == existing:
            return existing
    for exercise in data["exercises"]:
        if "id" not in exercise:
            exercise["id"] = str(uuid4())
    db.execute(text("""
        INSERT INTO fitness_custom_workout (user_id, id, data)
        VALUES (:uid, :id, CAST(:data AS jsonb))
        ON CONFLICT (user_id, id) DO UPDATE SET data = EXCLUDED.data
    """), {"uid": user, "id": workout_id,
           "data": json.dumps(data, ensure_ascii=True, allow_nan=False)})
    return data


def delete_workout(db: Connection, user: str, workout_id: str) -> None:
    lock_workout(db, user, workout_id)
    db.execute(text("DELETE FROM fitness_custom_workout WHERE user_id = :uid AND id = :id"),
               {"uid": user, "id": workout_id})


@router.put("/api/treinos/personalizados/{id}")
def put_workout(
    id: WorkoutId,
    body: WorkoutInput,
    user: Annotated[str, Depends(require_write_user)],
    db: Annotated[Connection, Depends(get_db)],
):
    data = save_workout(db, user, id, body)
    db.commit()
    return data


@router.delete("/api/treinos/personalizados/{id}")
def remove_workout(
    id: WorkoutId,
    user: Annotated[str, Depends(require_write_user)],
    db: Annotated[Connection, Depends(get_db)],
):
    delete_workout(db, user, id)
    db.commit()
    return {"deleted": True}
