from typing import Annotated

import httpx
from fastapi import Depends, HTTPException, Request

from .config import Settings, get_settings


def fetch_session(cookie: str, settings: Settings, response_cookies: list[str]) -> dict | None:
    if not settings.auth_origin:
        raise HTTPException(503, "Autenticacao indisponivel")
    if not cookie:
        return None
    # Never trust an identity supplied by the caller. Better Auth verifies its own cookie.
    try:
        with httpx.Client(timeout=5.0, follow_redirects=False, trust_env=False) as client:
            result = client.get(
                settings.auth_origin + "/api/auth/get-session",
                headers={"Cookie": cookie, "Accept": "application/json"},
            )
        if result.status_code in {200, 401}:
            response_cookies.extend(result.headers.get_list("set-cookie"))
        if result.status_code == 401:
            return None
        if result.status_code != 200:
            raise HTTPException(503, "Autenticacao indisponivel")
        data = result.json()
        if data is None:
            return None
        if not isinstance(data, dict) or not isinstance(data.get("user"), dict):
            raise HTTPException(503, "Autenticacao indisponivel")
        return data["user"]
    except (httpx.HTTPError, ValueError):
        raise HTTPException(503, "Autenticacao indisponivel") from None


def current_user(
    request: Request, settings: Annotated[Settings, Depends(get_settings)]
) -> dict | None:
    request.state.auth_cookies = []
    return fetch_session(request.headers.get("cookie", ""), settings, request.state.auth_cookies)


def require_user(user: Annotated[dict | None, Depends(current_user)]) -> str:
    if not user or not isinstance(user.get("id"), str) or not user["id"]:
        raise HTTPException(401, "Entre na sua conta")
    if user.get("emailVerified") is not True:
        raise HTTPException(403, "Verifique seu email")
    return user["id"]
