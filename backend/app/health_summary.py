from datetime import date, datetime, timedelta
from typing import Annotated, Literal
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.engine import Connection

from .auth import require_user
from .db import get_db

router = APIRouter()
Period = Literal["7", "28", "30", "90"]
Source = Literal["all", "apple_health", "samsung_health", "gpx", "csv", "strava", "health_connect"]

ACTIVITY_FILTER = """
FROM fitness_health_activity
WHERE user_id = :uid
  AND (data->>'dateKey') BETWEEN :since AND :today
  AND (:source = 'all' OR source = :source)
"""
METRIC_FILTER = """
FROM fitness_health_metric
WHERE user_id = :uid
  AND date_key BETWEEN :since AND :today
  AND (:source = 'all' OR source = :source)
"""


def today_in_sao_paulo() -> date:
    return datetime.now(ZoneInfo("America/Sao_Paulo")).date()


def read_health_summary(db: Connection, user: str, period: Period, source: Source, today: date):
    since = today - timedelta(days=int(period) - 1)
    params = {"uid": user, "since": since.isoformat(), "today": today.isoformat(), "source": source}

    def rows(query: str) -> list[dict]:
        return [dict(row) for row in db.execute(text(query), params).mappings()]

    activities = rows(
        'SELECT external_id AS id, source, data ' + ACTIVITY_FILTER
        + " ORDER BY CASE WHEN pg_input_is_valid(data->>'startedAt', 'timestamp with time zone')"
          " THEN CAST(data->>'startedAt' AS timestamptz) END DESC NULLS LAST, source, external_id LIMIT 20"
    )
    # GPX calories were previously estimated and are not measured by our importer.
    # Do not present old estimates as measurements; retain original stored data.
    for activity in activities:
        if activity["source"] == "gpx":
            activity["data"]["calories"] = None
        # Legacy Android sends zero for uncollected activity measurements.
        if activity["source"] == "health_connect":
            for key in ("distanceKm", "calories", "elevationGainM"):
                if activity["data"].get(key) == 0:
                    activity["data"][key] = None
            if activity["data"].get("zoneMinutes") == [0, 0, 0, 0, 0]:
                activity["data"]["zoneMinutes"] = None
    daily_metrics = rows(
        'SELECT date_key AS date, source, data ' + METRIC_FILTER
        + " ORDER BY date_key DESC, source LIMIT 20"
    )
    trend = rows(
        """
        SELECT data->>'dateKey' AS "dateKey",
          sum(CAST(data->>'durationMinutes' AS double precision)) AS "durationMinutes",
          sum(CASE WHEN source = 'health_connect' THEN NULLIF(CAST(data->>'distanceKm' AS double precision), 0)
                   ELSE CAST(data->>'distanceKm' AS double precision) END) AS "distanceKm",
          sum(CASE WHEN source = 'gpx' THEN NULL
                   WHEN source = 'health_connect' THEN NULLIF(CAST(data->>'calories' AS double precision), 0)
                   ELSE CAST(data->>'calories' AS double precision) END) AS calories
        """ + ACTIVITY_FILTER + " GROUP BY data->>'dateKey' ORDER BY data->>'dateKey'"
    )
    totals = rows(
        """
        SELECT CAST(count(*) AS integer) AS count,
          coalesce(sum(CAST(data->>'durationMinutes' AS double precision)), 0) AS "durationMinutes",
          sum(CASE WHEN source = 'health_connect' THEN NULLIF(CAST(data->>'distanceKm' AS double precision), 0)
                   ELSE CAST(data->>'distanceKm' AS double precision) END) AS "distanceKm",
          sum(CASE WHEN source = 'gpx' THEN NULL
                   WHEN source = 'health_connect' THEN NULLIF(CAST(data->>'calories' AS double precision), 0)
                   ELSE CAST(data->>'calories' AS double precision) END) AS calories,
          avg(CAST(data->>'avgHeartRate' AS double precision)) AS "avgHeartRate",
          coalesce(sum(CAST(data->'zoneMinutes'->>0 AS double precision)), 0) AS z1,
          coalesce(sum(CAST(data->'zoneMinutes'->>1 AS double precision)), 0) AS z2,
          coalesce(sum(CAST(data->'zoneMinutes'->>2 AS double precision)), 0) AS z3,
          coalesce(sum(CAST(data->'zoneMinutes'->>3 AS double precision)), 0) AS z4,
          coalesce(sum(CAST(data->'zoneMinutes'->>4 AS double precision)), 0) AS z5
        """ + ACTIVITY_FILTER
    )[0]
    return {
        "activities": activities, "dailyMetrics": daily_metrics, "trend": trend,
        "totals": totals, "since": since.isoformat(), "today": today.isoformat(),
    }


@router.get("/api/saude/resumo")
def health_summary(
    user: Annotated[str, Depends(require_user)],
    db: Annotated[Connection, Depends(get_db)],
    period: Period = "30",
    source: Source = "all",
):
    return read_health_summary(db, user, period, source, today_in_sao_paulo())
