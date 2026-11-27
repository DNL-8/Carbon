from typing import Annotated

from fastapi import Depends, HTTPException, Request

from .config import Settings, get_settings


def current_user(
    request: Request, settings: Annotated[Settings, Depends(get_settings)]
) -> dict | None:
    from .python_auth import session_user

    return session_user(request, settings)


def require_user(user: Annotated[dict | None, Depends(current_user)]) -> str:
    if not user or not isinstance(user.get("id"), str) or not user["id"]:
        raise HTTPException(401, "Entre na sua conta")
    if user.get("emailVerified") is not True:
        raise HTTPException(403, "Verifique seu email")
    return user["id"]
