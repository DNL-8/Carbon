import json
from typing import Annotated, Literal, Self

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy import text
from sqlalchemy.engine import Connection

from .db import get_db
from .write_access import require_write_user

router = APIRouter()
Height = Annotated[float, Field(strict=True, ge=100, le=250, allow_inf_nan=False)]
Weight = Annotated[float, Field(strict=True, ge=25, le=350, allow_inf_nan=False)]
RestingHeartRate = Annotated[int, Field(strict=True, ge=30, le=120)]
MaximumHeartRate = Annotated[int, Field(strict=True, ge=120, le=220)]


def js_length(value: str) -> int:
    return len(value.encode("utf-16-le")) // 2


class ProfileInput(BaseModel):
    name: str
    heroClass: Literal["Guerreiro", "Arqueiro", "Mago"]
    objective: Literal["Emagrecer", "Condicionamento", "Ambos"]
    experience: Literal["Iniciante", "Intermediário", "Avançado"]
    avatar: str | None = None
    heightCm: Height | None = None
    weightKg: Weight | None = None
    restingHrBaseline: RestingHeartRate | None = None
    maxHrEstimated: MaximumHeartRate | None = None

    @field_validator("name")
    @classmethod
    def name_length(cls, value: str) -> str:
        value = value.strip().strip("\ufeff").strip()
        if not 1 <= js_length(value) <= 80:
            raise ValueError("Nome invalido")
        return value

    @field_validator("avatar")
    @classmethod
    def avatar_length(cls, value: str | None) -> str:
        if value is None or js_length(value) > 24:
            raise ValueError("Avatar invalido")
        return value

    @field_validator("restingHrBaseline", "maxHrEstimated", mode="before")
    @classmethod
    def normalize_json_integer(cls, value: object) -> object:
        if isinstance(value, float) and value.is_integer():
            return int(value)
        return value

    @model_validator(mode="after")
    def validate_heart_rates(self) -> Self:
        rest, maximum = self.restingHrBaseline, self.maxHrEstimated
        if rest is not None and maximum is not None and maximum <= rest:
            raise ValueError("FC maxima precisa ser maior que FC de repouso")
        return self


def save_profile(db: Connection, user: str, data: dict) -> None:
    db.execute(text("""
        INSERT INTO fitness_hero_profile (user_id, data)
        VALUES (:uid, CAST(:data AS jsonb))
        ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data
    """), {"uid": user, "data": json.dumps(data, ensure_ascii=True, allow_nan=False)})


@router.put("/api/heroi")
def put_profile(
    body: ProfileInput,
    user: Annotated[str, Depends(require_write_user)],
    db: Annotated[Connection, Depends(get_db)],
):
    data = body.model_dump(exclude_unset=True)
    save_profile(db, user, data)
    db.commit()
    return {"profile": data}
