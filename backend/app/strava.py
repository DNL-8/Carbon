"""Strava OAuth with encrypted cookies bound to the signed-in Murim account."""

import base64
import binascii
import hashlib
import hmac
import re
import secrets
import time
from datetime import datetime
from typing import Annotated, Literal
from urllib.parse import urlencode
from zoneinfo import ZoneInfo

import httpx
from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel, Field, ValidationError

from .auth import require_user
from .config import Settings, get_settings
from .db import get_db_factory
from .health_import import Activity, Number, persist_import
from .strava_config import public_strava_config
from .write_access import require_write_user

router = APIRouter(prefix="/api/strava")
STATE, SESSION = "murim_strava_state", "murim_strava_session"
COOKIE = {"httponly": True, "secure": True, "samesite": "lax", "path": "/api/strava"}
STATE_LIFETIME, SESSION_LIFETIME = 600, 30 * 86400
Token = Annotated[str, Field(min_length=1, max_length=512)]
AthleteId = Annotated[int, Field(strict=True, gt=0)]
User = Annotated[str, Depends(require_user)]
Writer = Annotated[str, Depends(require_write_user)]
Config = Annotated[Settings, Depends(get_settings)]


class OAuthState(BaseModel):
    state: str
    userId: str
    expires: int


class StravaSession(BaseModel):
    userId: str
    access: Token
    refresh: Token
    expires: int
    athleteId: AthleteId


class Athlete(BaseModel):
    id: AthleteId


class ProviderToken(BaseModel):
    access_token: Token
    refresh_token: Token
    expires_at: Annotated[int, Field(strict=True)]
    athlete: Athlete | None = None


class ProviderActivity(BaseModel):
    id: AthleteId
    start_date: str
    name: str = ""
    sport_type: str = ""
    type: str = ""
    start_date_local: str | None = None
    moving_time: Number | None = None
    elapsed_time: Number = 0
    distance: Number = 0
    total_elevation_gain: Annotated[float, Field(strict=True, allow_inf_nan=False)] = 0
    calories: Number = 0
    average_heartrate: Number | None = None
    max_heartrate: Number | None = None


class SyncInput(BaseModel):
    days: Literal[7, 28, 90] = 28


def configured(settings: Settings) -> str:
    cfg = public_strava_config(settings)
    if not cfg["configured"]:
        raise HTTPException(503, "Strava nao configurado")
    return cfg["callbackUrl"]


def b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def cipher(settings: Settings) -> AESGCM:
    return AESGCM(hashlib.sha256(settings.strava_session_secret.strip().encode()).digest())


def seal(data: BaseModel, settings: Settings) -> str:
    nonce = secrets.token_bytes(12)
    encrypted = cipher(settings).encrypt(nonce, data.model_dump_json().encode(), None)
    return ".".join(b64(item) for item in (nonce, encrypted[-16:], encrypted[:-16]))


def unseal(raw: str | None, settings: Settings, model: type[OAuthState] | type[StravaSession]):
    if not raw or len(raw) > 4096:
        return None
    try:
        nonce, tag, encrypted = [base64.urlsafe_b64decode(part + "=" * (-len(part) % 4)) for part in raw.split(".")]
        if len(nonce) != 12 or len(tag) != 16:
            return None
        return model.model_validate_json(cipher(settings).decrypt(nonce, encrypted + tag, None))
    except (ValueError, binascii.Error, InvalidTag):
        return None


def read_session(request: Request, user: str, settings: Settings) -> StravaSession | None:
    value = unseal(request.cookies.get(SESSION), settings, StravaSession)
    return value if value and value.userId == user else None


def save_session(response: Response, session: StravaSession, settings: Settings) -> None:
    response.set_cookie(SESSION, seal(session, settings), max_age=SESSION_LIFETIME, **COOKIE)


def exchange(settings: Settings, **data) -> ProviderToken:
    try:
        with httpx.Client(timeout=8, trust_env=False) as client:
            result = client.post("https://www.strava.com/oauth/token", data={
                "client_id": settings.strava_client_id.strip(),
                "client_secret": settings.strava_client_secret.strip(), **data,
            })
        result.raise_for_status()
        token = ProviderToken.model_validate(result.json())
    except (httpx.HTTPError, ValueError):
        raise HTTPException(502, "Autorizacao Strava recusada") from None
    if token.expires_at <= time.time():
        raise HTTPException(502, "Sessao Strava invalida")
    return token


def map_activity(raw: object) -> Activity | None:
    try:
        row = ProviderActivity.model_validate(raw)
        local = row.start_date_local
        if local is None:
            local = datetime.fromisoformat(row.start_date).astimezone(ZoneInfo("America/Sao_Paulo")).date().isoformat()
        sport = (row.sport_type or row.type or "Workout")[:240]
        duration = (row.elapsed_time if row.moving_time is None else row.moving_time) / 60
        if duration <= 0:
            return None
        return Activity(
            externalId=f"strava_{row.id}", source="strava", title=(row.name.strip() or sport)[:240],
            sportType=sport, dateKey=local[:10], startedAt=row.start_date, durationMinutes=duration,
            distanceKm=row.distance / 1000, calories=row.calories, elevationGainM=max(0, row.total_elevation_gain),
            avgHeartRate=row.average_heartrate, maxHeartRate=row.max_heartrate,
            zoneMinutes=(0, 0, 0, 0, 0), hrSamplePoints=[],
        )
    except (ValueError, OverflowError):
        return None


def fetch_activities(session: StravaSession, days: int) -> tuple[list[Activity], bool]:
    after = int(time.time()) - days * 86400
    deadline = time.monotonic() + 18
    records = []
    try:
        with httpx.Client(trust_env=False) as client:
            for page in range(1, 4):
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise ValueError("Tempo excedido")
                result = client.get(
                    "https://www.strava.com/api/v3/athlete/activities",
                    headers={"Authorization": "Bearer " + session.access},
                    params={"after": after, "per_page": 50, "page": page},
                    timeout=remaining,
                )
                result.raise_for_status()
                rows = result.json()
                if not isinstance(rows, list) or len(rows) > 50:
                    raise ValueError("Atividades invalidas")
                records.extend(mapped for row in rows if (mapped := map_activity(row)) is not None)
                if len(rows) < 50:
                    return records, False
    except (httpx.HTTPError, ValueError):
        raise HTTPException(502, "Falha ao consultar atividades Strava") from None
    return records, True


@router.get("/status")
def status(request: Request, user: User, settings: Config):
    result = public_strava_config(settings)
    result["connected"] = bool(result["configured"] and read_session(request, user, settings))
    return result


@router.post("/auth-url")
def authorize(response: Response, user: Writer, settings: Config):
    callback_url = configured(settings)
    state = secrets.token_urlsafe(32)
    payload = OAuthState(state=state, userId=user, expires=int(time.time() * 1000) + STATE_LIFETIME * 1000)
    response.set_cookie(STATE, seal(payload, settings), max_age=STATE_LIFETIME, **COOKIE)
    query = urlencode({
        "client_id": settings.strava_client_id.strip(), "redirect_uri": callback_url,
        "response_type": "code", "approval_prompt": "auto", "scope": "activity:read_all", "state": state,
    })
    return {"url": "https://www.strava.com/oauth/authorize?" + query}


@router.get("/callback")
def callback(request: Request, user: User, settings: Config):
    result = RedirectResponse("/?tab=progresso&strava=error", 303, headers={"Referrer-Policy": "no-referrer"})
    if not settings.enable_writes:
        return result
    result.delete_cookie(STATE, **COOKIE)
    try:
        configured(settings)
        state = unseal(request.cookies.get(STATE), settings, OAuthState)
        query = request.query_params
        supplied = query.get("state", "")
        if (
            not state or state.userId != user or state.expires < time.time() * 1000
            or not hmac.compare_digest(state.state.encode(), supplied.encode())
            or not re.fullmatch(r"[A-Za-z0-9_-]{1,512}", query.get("code", ""))
            or "activity:read_all" not in query.get("scope", "").split(",")
            or any(len(query.getlist(key)) != 1 for key in ("state", "code", "scope"))
        ):
            return result
        token = exchange(settings, code=query["code"], grant_type="authorization_code")
        if token.athlete is None:
            return result
        session = StravaSession(userId=user, access=token.access_token, refresh=token.refresh_token,
                                expires=token.expires_at, athleteId=token.athlete.id)
        save_session(result, session, settings)
        result.headers["location"] = "/?tab=progresso&strava=connected"
    except (HTTPException, ValidationError):
        pass
    return result


@router.post("/disconnect")
def disconnect(request: Request, response: Response, user: Writer, settings: Config):
    configured(settings)
    session = read_session(request, user, settings)
    if session is not None:
        try:
            with httpx.Client(timeout=8, trust_env=False) as client:
                result = client.post("https://www.strava.com/oauth/revoke",
                                     auth=(settings.strava_client_id.strip(), settings.strava_client_secret.strip()),
                                     data={"token": session.refresh, "token_type_hint": "refresh_token"})
                result.raise_for_status()
        except httpx.HTTPError:
            raise HTTPException(502, "Nao foi possivel revogar o Strava; tente novamente") from None
    response.delete_cookie(SESSION, **COOKIE)
    response.delete_cookie(STATE, **COOKIE)
    return {"disconnected": True}


@router.post("/sync")
def sync(body: SyncInput, request: Request, response: Response, user: Writer, settings: Config,
         db_factory: Annotated[object, Depends(get_db_factory)]):
    configured(settings)
    session = read_session(request, user, settings)
    if session is None:
        raise HTTPException(401, "Conecte o Strava")
    refreshed = False
    if session.expires <= time.time() + 120:
        token = exchange(settings, refresh_token=session.refresh, grant_type="refresh_token")
        session = session.model_copy(update={
            "access": token.access_token, "refresh": token.refresh_token, "expires": token.expires_at,
        })
        refreshed = True
    try:
        records, truncated = fetch_activities(session, body.days)
        with db_factory() as db, db.begin():
            result = persist_import(db, user, "strava", records, [])
    except HTTPException as exc:
        if not refreshed:
            raise
        failure = JSONResponse({"statusCode": exc.status_code, "statusMessage": exc.detail},
                               status_code=exc.status_code, headers=exc.headers)
        save_session(failure, session, settings)
        return failure
    if refreshed:
        save_session(response, session, settings)
    return {key: result[key] for key in ("imported", "duplicates", "xp")} | {"truncated": truncated}
