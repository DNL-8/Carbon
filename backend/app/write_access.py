from typing import Annotated

from fastapi import Depends, HTTPException, Request

from .auth import require_user
from .config import Settings, get_settings
from .strava_config import web_origin


def require_write_user(
    user: Annotated[str, Depends(require_user)],
    settings: Annotated[Settings, Depends(get_settings)],
    request: Request,
) -> str:
    # Explicit opt-in for business writes. Never trust Host/X-Forwarded-Host.
    if not settings.enable_writes:
        raise HTTPException(503, "Escrita indisponivel")
    origin = web_origin(settings.app_origin)
    if not origin or request.headers.get("origin") != origin:
        raise HTTPException(403, "Origem invalida")
    expected_owner = request.headers.get("x-murim-owner")
    if expected_owner is not None and expected_owner != user:
        raise HTTPException(409, "Conta alterada; recarregue a pagina")
    return user
