import base64
import hashlib
import json
import secrets
from typing import Annotated

import httpx
from authlib.integrations.httpx_client import OAuth2Client
from authlib.oauth2.rfc6749.errors import OAuth2Error
from cryptography.fernet import Fernet, InvalidToken
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy import text

from .config import Settings, get_settings
from .db import engine
from .python_auth import GOOGLE, config, cookie_name, digest, issue, session_user, verify_google

router = APIRouter(prefix="/api/auth", include_in_schema=False)
STATE = "murim_oauth"
CALLBACK = "/api/auth/callback/google"


class IdToken(BaseModel):
    token: str = Field(min_length=1, max_length=8192)


class Social(BaseModel):
    provider: str
    idToken: IdToken | None = None


def origin_check(request, origin):
    if request.headers.get("origin") != origin:
        raise HTTPException(403, "Origem invalida")


def cipher(settings):
    return Fernet(base64.urlsafe_b64encode(hashlib.sha256(
        settings.python_auth_secret.encode()).digest()))


def oauth(settings, origin):
    return OAuth2Client(settings.google_client_id, settings.google_client_secret,
                        scope="openid email profile", redirect_uri=origin + CALLBACK,
                        code_challenge_method="S256", timeout=10, trust_env=False,
                        token_endpoint_auth_method="client_secret_post")


@router.post("/sign-in/social")
def social(body: Social, request: Request, settings: Annotated[Settings, Depends(get_settings)]):
    origin, _ = config(settings)
    origin_check(request, origin)
    if body.provider != "google":
        raise HTTPException(400, "Provedor invalido")
    if body.idToken:
        claims = verify_google(body.idToken.token, settings)
        response = JSONResponse({})
        user = issue(claims, settings, response, body.idToken.token)
        result = JSONResponse({"user": user})
        result.headers["set-cookie"] = response.headers["set-cookie"]
        return result
    state, nonce, verifier = (secrets.token_urlsafe(32) for _ in range(3))
    with oauth(settings, origin) as client:
        url, _ = client.create_authorization_url(
            GOOGLE + "/o/oauth2/v2/auth", state=state, nonce=nonce, code_verifier=verifier)
    response = JSONResponse({"url": url})
    value = cipher(settings).encrypt(json.dumps([state, nonce, verifier]).encode()).decode()
    response.set_cookie(STATE, value, max_age=600, httponly=True,
                        secure=origin.startswith("https://"), samesite="lax", path=CALLBACK)
    return response


@router.get("/callback/google")
def callback(request: Request, code: str, state: str,
             settings: Annotated[Settings, Depends(get_settings)]):
    origin, _ = config(settings)
    try:
        saved, nonce, verifier = json.loads(cipher(settings).decrypt(
            request.cookies.get(STATE, "").encode(), ttl=600))
        if not secrets.compare_digest(state, saved):
            raise ValueError("state")
        with oauth(settings, origin) as client:
            token = client.fetch_token("https://oauth2.googleapis.com/token",
                                       code=code, code_verifier=verifier)
        claims = verify_google(token["id_token"], settings, nonce)
    except (HTTPException, httpx.HTTPError, OAuth2Error, InvalidToken, ValueError, KeyError, TypeError):
        raise HTTPException(401, "Login Google invalido") from None
    response = RedirectResponse(origin + "/", status_code=303)
    issue(claims, settings, response)
    response.delete_cookie(STATE, path=CALLBACK, secure=origin.startswith("https://"),
                           httponly=True, samesite="lax")
    return response


@router.get("/get-session")
def get_session(request: Request, settings: Annotated[Settings, Depends(get_settings)]):
    user = session_user(request, settings)
    return {"user": user} if user else None


@router.post("/sign-out")
def sign_out(request: Request, settings: Annotated[Settings, Depends(get_settings)]):
    origin, _ = config(settings)
    origin_check(request, origin)
    name = cookie_name(origin)
    token = request.cookies.get(name, "")
    if token.startswith("m1.") and len(token) <= 100:
        with engine().begin() as conn:
            conn.execute(text("DELETE FROM auth_session WHERE token=:token"),
                         {"token": digest(token)})
    response = JSONResponse({"success": True})
    response.delete_cookie(name, secure=origin.startswith("https://"),
                           httponly=True, samesite="lax")
    return response
