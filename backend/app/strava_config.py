from urllib.parse import urlsplit

from .config import Settings


def web_origin(raw: str) -> str | None:
    try:
        parsed = urlsplit(raw.strip())
        host = parsed.hostname
        port = parsed.port
        if parsed.scheme not in {"http", "https"} or not host:
            return None
        if any(c.isspace() or c in "%\\/" for c in host):
            return None
        if ":" in host:
            host = f"[{host}]"
        else:
            host = host.encode("idna").decode("ascii").lower()
        default_port = 443 if parsed.scheme == "https" else 80
        suffix = f":{port}" if port is not None and port != default_port else ""
        return f"{parsed.scheme}://{host}{suffix}"
    except (ValueError, UnicodeError):
        return None


def public_strava_config(settings: Settings) -> dict:
    origin = web_origin(settings.app_origin)
    configured = bool(
        settings.strava_client_id.strip()
        and settings.strava_client_secret.strip()
        and len(settings.strava_session_secret.strip()) >= 32
        and origin
        and origin.startswith("https://")
    )
    return {
        "configured": configured,
        "callbackUrl": origin + "/api/strava/callback" if origin else None,
    }
