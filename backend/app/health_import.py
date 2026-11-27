"""Validate health import payloads and persist samples and rewards atomically."""

import json
import re
from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import (
    BaseModel,
    BeforeValidator,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)
from sqlalchemy import text
from sqlalchemy.engine import Connection

from .arsenal import read_totals
from .db import get_db
from .profile import js_length
from .progression import js_round
from .weight import iso_day
from .write_access import require_write_user

router = APIRouter()
ManualSource = Literal["apple_health", "samsung_health", "gpx", "csv"]
Source = Literal["apple_health", "samsung_health", "gpx", "csv", "strava", "health_connect"]
Number = Annotated[float, Field(strict=True, ge=0, allow_inf_nan=False)]
Day = Annotated[str, BeforeValidator(iso_day)]
Label = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=240)]


class Activity(BaseModel):
    externalId: Label
    source: Source
    title: Label
    sportType: Label
    dateKey: Day
    startedAt: str
    durationMinutes: Number
    distanceKm: Number
    calories: Number
    elevationGainM: Number
    avgHeartRate: Number | None
    maxHeartRate: Number | None
    zoneMinutes: tuple[Number, Number, Number, Number, Number]
    hrSamplePoints: Annotated[list[Number], Field(max_length=40)]

    @field_validator("externalId", "title", "sportType")
    @classmethod
    def valid_label(cls, value: str) -> str:
        if js_length(value) > 240:
            raise ValueError("Texto invalido")
        return value

    @field_validator("startedAt")
    @classmethod
    def valid_timestamp(cls, value: str) -> str:
        if not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(?::[0-9]{2}(?:\.[0-9]+)?)?(?:Z|[+-][0-9]{2}:[0-9]{2})", value):
            raise ValueError("Horario invalido")
        datetime.fromisoformat(value)
        return value


class Metric(BaseModel):
    dateKey: Day
    steps: Number
    activeCalories: Number
    sleepHours: Number
    restingHeartRate: Number | None
    hrvMs: Number | None
    trainingLoadScore: Number
    recoveryScore: Number


class PartialMetric(BaseModel):
    dateKey: Day
    steps: Number = None
    activeCalories: Number = None
    sleepHours: Number = None
    restingHeartRate: Number | None = None
    hrvMs: Number | None = None
    trainingLoadScore: Number = None
    recoveryScore: Number = None

    @model_validator(mode="after")
    def has_measurement(self):
        if not any(value is not None for value in self.model_dump(exclude={"dateKey"}).values()):
            raise ValueError("Medicoes ausentes")
        return self


class ManualImport(BaseModel):
    source: ManualSource
    activities: Annotated[list[Activity], Field(max_length=25)]
    dailyMetrics: Annotated[list[Metric], Field(max_length=25)]

    @model_validator(mode="after")
    def matches_source(self):
        if not (self.activities or self.dailyMetrics) or any(a.source != self.source for a in self.activities):
            raise ValueError("Importacao invalida")
        return self


class ConnectImport(BaseModel):
    source: Literal["health_connect"]
    activities: Annotated[list[Activity], Field(max_length=25)]
    dailyMetrics: Annotated[list[PartialMetric], Field(max_length=25)]

    @model_validator(mode="after")
    def matches_source(self):
        if not (self.activities or self.dailyMetrics) or any(
            a.source != self.source or not a.externalId.startswith("health-connect-")
            or a.sportType == "heart_rate_monitor" for a in self.activities
        ):
            raise ValueError("Importacao invalida")
        return self


def activity_xp(duration: float, distance: float, sport: str) -> int:
    name = sport.lower()
    if "run" in name or "corrida" in name:
        multiplier = 1.25
    elif "hiit" in name or "cross" in name:
        multiplier = 1.3
    elif "walk" in name or "caminhada" in name or "yoga" in name:
        multiplier = 0.85
    else:
        multiplier = 1.0
    score = (duration * 3 + distance * 6) * multiplier
    return max(15, js_round(min(500, score)))


def persist_import(db: Connection, user: str, source: Source, activities: list[Activity],
                   metrics: list[Metric] | list[PartialMetric]) -> dict:
    params = {"uid": user, "source": source}
    imported = xp = 0
    if activities:
        balance = read_totals(db, user, lock=True)
        for item in sorted(activities, key=lambda item: item.externalId):
            reward = activity_xp(item.durationMinutes, item.distanceKm, item.sportType)
            inserted = db.execute(text("""
                INSERT INTO fitness_health_activity (user_id, source, external_id, data, xp)
                VALUES (:uid, :source, :id, CAST(:data AS jsonb), :reward)
                ON CONFLICT (user_id, source, external_id) DO NOTHING RETURNING xp
            """), {**params, "id": item.externalId, "data": item.model_dump_json(), "reward": reward}).scalar_one_or_none()
            if inserted is None:
                if source == "health_connect":
                    # Preserve the original reward and measurements omitted by older Android clients.
                    data = item.model_dump(mode="json")
                    for key in ("distanceKm", "calories", "elevationGainM"):
                        if data[key] == 0:
                            del data[key]
                    if not any(data["zoneMinutes"]):
                        del data["zoneMinutes"]
                    for key in ("avgHeartRate", "maxHeartRate"):
                        if data[key] is None:
                            del data[key]
                    if not data["hrSamplePoints"]:
                        del data["hrSamplePoints"]
                    db.execute(text("""
                        UPDATE fitness_health_activity SET data = data || CAST(:data AS jsonb)
                        WHERE user_id = :uid AND source = :source AND external_id = :id
                        AND data IS DISTINCT FROM data || CAST(:data AS jsonb)
                    """), {**params, "id": item.externalId, "data": json.dumps(data)})
                continue
            imported += 1
            xp += inserted
            db.execute(text("""
                INSERT INTO fitness_progress_ledger (user_id, kind, title, xp_delta, coin_delta, total_xp, gold_coins)
                VALUES (:uid, 'health_activity', :title, :delta, 0, :xp, :coins)
            """), {**params, "title": item.title, "delta": inserted, "xp": balance["xp"] + xp, "coins": balance["coins"]})
        if imported:
            db.execute(text("UPDATE fitness_progress SET xp = :xp WHERE user_id = :uid"),
                       {**params, "xp": balance["xp"] + xp})

    merge = source == "health_connect"
    by_day: dict[str, dict] = {}
    for metric in metrics:
        data = metric.model_dump(exclude_unset=True, exclude_none=merge)
        by_day[metric.dateKey] = {**by_day.get(metric.dateKey, {}), **data} if merge else data
    for day, data in sorted(by_day.items()):
        db.execute(text("""
            INSERT INTO fitness_health_metric (user_id, source, date_key, data)
            VALUES (:uid, :source, :day, CAST(:data AS jsonb))
            ON CONFLICT (user_id, source, date_key) DO UPDATE SET data =
                CASE WHEN :merge THEN fitness_health_metric.data || EXCLUDED.data ELSE EXCLUDED.data END
        """), {**params, "day": day, "data": json.dumps(data), "merge": merge})
    return {"imported": imported, "duplicates": len(activities) - imported, "days": len(by_day), "xp": xp}


@router.post("/api/saude/importar")
def import_manual(body: ManualImport, user: Annotated[str, Depends(require_write_user)],
                  db: Annotated[Connection, Depends(get_db)]):
    with db.begin():
        return persist_import(db, user, body.source, body.activities, body.dailyMetrics)


@router.post("/api/saude/health-connect")
def import_health_connect(body: ConnectImport, user: Annotated[str, Depends(require_write_user)],
                          db: Annotated[Connection, Depends(get_db)]):
    with db.begin():
        return persist_import(db, user, body.source, body.activities, body.dailyMetrics)
