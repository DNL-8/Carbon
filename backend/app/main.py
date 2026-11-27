import re
from datetime import datetime
from typing import Annotated
from zoneinfo import ZoneInfo

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.engine import Connection
from sqlalchemy.exc import SQLAlchemyError

from .arsenal import router as arsenal_router
from .auth import current_user, require_user
from .catalog import router as catalog_router
from .completion import router as completion_router
from .config import Settings, get_settings
from .dashboard import router as dashboard_router
from .dates import js_iso_timestamp
from .db import get_db
from .health_import import router as health_import_router
from .health_summary import router as health_summary_router
from .history import router as history_router
from .oracle import router as oracle_router
from .profile import router as profile_router
from .python_auth_routes import router as python_auth_router
from .quests import router as quests_router
from .state import router as state_router
from .strava import router as strava_router
from .strava_config import public_strava_config
from .training_progress import router as progress_router
from .vows import router as vows_router
from .weight import router as weight_router
from .workouts import router as workouts_router

app = FastAPI(title="Murim API", version="0.1.0", docs_url="/docs")
app.include_router(health_summary_router)
app.include_router(health_import_router)
app.include_router(weight_router)
app.include_router(profile_router)
app.include_router(python_auth_router)
app.include_router(workouts_router)
app.include_router(catalog_router)
app.include_router(history_router)
app.include_router(progress_router)
app.include_router(arsenal_router)
app.include_router(completion_router)
app.include_router(quests_router)
app.include_router(state_router)
app.include_router(vows_router)
app.include_router(dashboard_router)
app.include_router(oracle_router)
app.include_router(strava_router)
User = Annotated[str, Depends(require_user)]
Db = Annotated[Connection, Depends(get_db)]


@app.middleware("http")
async def no_cache(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
        if request.url.path not in {"/api/health", "/api/ready", "/api/mobile/config", "/api/strava/config", "/api/catalogo"}:
            response.headers["Cache-Control"] = "private, no-store"
    return response


@app.exception_handler(HTTPException)
async def api_error(request: Request, exc: HTTPException):
    return JSONResponse(
        {"statusCode": exc.status_code, "statusMessage": exc.detail},
        status_code=exc.status_code,
        headers=exc.headers,
    )


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    return JSONResponse(
        {"statusCode": 400, "statusMessage": "Dados invalidos"}, status_code=400
    )


@app.get("/api/health")
def health(settings: Annotated[Settings, Depends(get_settings)]):
    result = {"status": "ok"}
    if re.fullmatch(r"[a-f0-9]{40}", settings.vercel_git_commit_sha):
        result["revision"] = settings.vercel_git_commit_sha
    return result


@app.get("/api/ready")
def ready(settings: Annotated[Settings, Depends(get_settings)]):
    # Readiness is intentionally conservative; no credentials or DB errors are exposed.
    from .db import engine

    try:
        from .python_auth import config

        config(settings)
        with engine().connect() as conn:
            conn.execute(text("SELECT xp FROM fitness_progress LIMIT 0"))
        return {"ready": True}
    except (HTTPException, SQLAlchemyError, ValueError):
        return JSONResponse({"ready": False}, status_code=503)


@app.get("/api/conta")
def account(user: Annotated[dict | None, Depends(current_user)]):
    return {"authenticated": bool(user and user.get("emailVerified") is True)}


@app.get("/api/heroi")
def hero(user: User, db: Db):
    row = db.execute(
        text("SELECT data FROM fitness_hero_profile WHERE user_id = :uid"), {"uid": user}
    ).first()
    return {"profile": row[0] if row else None}


@app.get("/api/treinos/personalizados")
def workouts(user: User, db: Db):
    return list(db.execute(
        text("SELECT data FROM fitness_custom_workout WHERE user_id = :uid"), {"uid": user}
    ).scalars())


@app.get("/api/arsenal/conjuntos")
def loadouts(user: User, db: Db):
    row = db.execute(
        text("SELECT loadouts FROM fitness_arsenal WHERE user_id = :uid"), {"uid": user}
    ).first()
    return row[0] if row else []


@app.get("/api/votos")
def vows(user: User, db: Db):
    today = datetime.now(ZoneInfo("America/Sao_Paulo")).date().isoformat()
    rows = db.execute(
        text("SELECT id, title, resolved_day, outcome FROM fitness_daily_vow "
             "WHERE user_id = :uid ORDER BY title"), {"uid": user}
    ).mappings()
    return [
        {"id": row["id"], "title": row["title"],
         "outcome": row["outcome"] if row["resolved_day"] == today else None}
        for row in rows
    ]


@app.get("/api/extrato")
def ledger(user: User, db: Db, cursor: Annotated[int | None, Query(gt=0, le=2147483647)] = None):
    rows = db.execute(
        text('SELECT id, kind, title, created_at AS "createdAt", xp_delta AS "xpDelta", '
             'coin_delta AS "coinDelta", total_xp AS "totalXp", gold_coins AS "goldCoins" '
             'FROM fitness_progress_ledger WHERE user_id = :uid '
             'AND (CAST(:cursor AS integer) IS NULL OR id < :cursor) '
             'ORDER BY id DESC LIMIT 21'),
        {"uid": user, "cursor": cursor},
    ).mappings().all()
    entries = [dict(row, createdAt=js_iso_timestamp(row["createdAt"])) for row in rows[:20]]
    return {"entries": entries, "nextCursor": entries[-1]["id"] if len(rows) > 20 else None}


@app.get("/api/saude/health-connect")
def health_connect(user: User, db: Db):
    params = {"uid": user}
    days = db.execute(text("SELECT count(*) FROM fitness_health_metric "
        "WHERE user_id = :uid AND source = 'health_connect'"), params).scalar_one()
    activities = db.execute(text("SELECT count(*) FROM fitness_health_activity "
        "WHERE user_id = :uid AND source = 'health_connect'"), params).scalar_one()
    rows = db.execute(text("SELECT date_key, data FROM fitness_health_metric "
        "WHERE user_id = :uid AND source = 'health_connect' "
        "ORDER BY date_key DESC LIMIT 30"), params).mappings().all()
    daily = [
        {"dateKey": row["date_key"], "steps": row["data"].get("steps"),
         "calories": row["data"].get("activeCalories"), "sleepHours": row["data"].get("sleepHours")}
        for row in rows
    ]
    latest = daily[0] if daily else {}
    return {"daysCount": days, "activitiesCount": activities,
            "latestDateKey": latest.get("dateKey"), "latestSteps": latest.get("steps"),
            "latestCalories": latest.get("calories"), "dailyMetrics": daily}


@app.get("/api/mobile/config")
def mobile_config(settings: Annotated[Settings, Depends(get_settings)]):
    client_id = settings.google_client_id.strip()
    if not client_id or not settings.google_client_secret:
        raise HTTPException(503, "Google nao configurado")
    return {"googleClientId": client_id}


@app.get("/api/strava/config")
def strava_config(settings: Annotated[Settings, Depends(get_settings)]):
    return public_strava_config(settings)
