from unittest.mock import MagicMock

import httpx
import pytest
from fastapi.testclient import TestClient

from app.auth import current_user, fetch_session
from app.config import Settings, get_settings
from app.db import get_db
from app.main import app


@pytest.fixture
def client():
    app.dependency_overrides[get_settings] = lambda: Settings(_env_file=None)
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_health(client):
    response = client.get("/api/health")
    assert response.json()["status"] == "ok"
    assert response.headers["cache-control"] == "no-store"


def test_ready_without_auth(client):
    assert client.get("/api/ready").status_code == 503


@pytest.mark.parametrize("user,status", [(None, 401), ({"id": "u", "emailVerified": False}, 403)])
def test_protected_routes(client, user, status):
    app.dependency_overrides[current_user] = lambda: user
    app.dependency_overrides[get_db] = lambda: pytest.fail("unauthorized DB access")
    for path in ["/api/heroi", "/api/treinos/personalizados", "/api/arsenal/conjuntos",
                 "/api/votos", "/api/extrato", "/api/saude/health-connect", "/api/saude/resumo"]:
        response = client.get(path)
        assert response.status_code == status
        assert response.headers["cache-control"] == "private, no-store"


def test_profile_is_scoped_to_verified_user(client):
    db = MagicMock()
    db.execute.return_value.first.return_value = ({"name": "Murim"},)
    app.dependency_overrides[current_user] = lambda: {"id": "owner-a", "emailVerified": True}
    app.dependency_overrides[get_db] = lambda: db
    response = client.get("/api/heroi?user_id=owner-b")
    assert response.json() == {"profile": {"name": "Murim"}}
    query, parameters = db.execute.call_args.args
    assert "WHERE user_id = :uid" in str(query)
    assert parameters == {"uid": "owner-a"}


def test_empty_loadouts_and_workouts(client):
    db = MagicMock()
    db.execute.return_value.first.return_value = None
    db.execute.return_value.scalars.return_value = []
    app.dependency_overrides[current_user] = lambda: {"id": "u", "emailVerified": True}
    app.dependency_overrides[get_db] = lambda: db
    assert client.get("/api/arsenal/conjuntos").json() == []
    assert client.get("/api/treinos/personalizados").json() == []


def test_invalid_cursor(client):
    app.dependency_overrides[current_user] = lambda: {"id": "u", "emailVerified": True}
    app.dependency_overrides[get_db] = MagicMock
    assert client.get("/api/extrato?cursor=-1").status_code == 400


def test_auth_bridge(monkeypatch):
    def handler(request):
        assert request.url.host == "auth.example.com"
        assert request.url.path == "/api/auth/get-session"
        assert not request.url.query
        assert request.headers["cookie"] == "better-auth.session_token=fixture"
        return httpx.Response(200, headers={"Set-Cookie": "better-auth.session_token=renewed"},
                              json={"user": {"id": "u", "emailVerified": True}})

    original = httpx.Client
    monkeypatch.setattr(httpx, "Client", lambda **kw: original(
        transport=httpx.MockTransport(handler), **kw))
    settings = Settings(auth_origin="https://auth.example.com", _env_file=None)
    cookies = []
    assert fetch_session("better-auth.session_token=fixture", settings, cookies)["id"] == "u"
    assert cookies == ["better-auth.session_token=renewed"]


def test_reject_insecure_remote_auth():
    with pytest.raises(ValueError):
        Settings(auth_origin="http://example.com", _env_file=None)


def test_mobile_config(client):
    app.dependency_overrides[get_settings] = lambda: Settings(
        google_client_id="  public-id  ", google_client_secret="fixture", _env_file=None
    )
    response = client.get("/api/mobile/config")
    assert response.json() == {"googleClientId": "public-id"}
    assert response.headers["cache-control"] == "no-store"


def test_mobile_config_missing_secret(client):
    app.dependency_overrides[get_settings] = lambda: Settings(
        google_client_id="public-id", google_client_secret="", _env_file=None
    )
    response = client.get("/api/mobile/config")
    assert response.status_code == 503
    assert response.json()["statusMessage"] == "Google nao configurado"


@pytest.mark.parametrize(
    "url,secret,configured,callback",
    [
        ("https://MURIM.example:443/path", "x" * 32, True,
         "https://murim.example/api/strava/callback"),
        ("https://murim.example:8443", "short", False,
         "https://murim.example:8443/api/strava/callback"),
        ("http://localhost:3000", "x" * 32, False,
         "http://localhost:3000/api/strava/callback"),
        ("not a url", "x" * 32, False, None),
        ("https://murim.example:99999", "x" * 32, False, None),
    ],
)
def test_strava_config(client, url, secret, configured, callback):
    app.dependency_overrides[get_settings] = lambda: Settings(
        better_auth_url=url, strava_client_id="public",
        strava_client_secret="never-return-this", strava_session_secret=secret,
        _env_file=None,
    )
    response = client.get("/api/strava/config")
    assert response.json() == {"configured": configured, "callbackUrl": callback}
    assert response.headers["cache-control"] == "no-store"


def test_strava_config_missing_credentials(client):
    app.dependency_overrides[get_settings] = lambda: Settings(
        better_auth_url="https://murim.example", strava_client_id="",
        strava_client_secret="", strava_session_secret="",
        _env_file=None,
    )
    assert client.get("/api/strava/config").json() == {
        "configured": False, "callbackUrl": "https://murim.example/api/strava/callback",
    }


@pytest.mark.parametrize("query", ["period=1", "source=other", "period=31"])
def test_health_summary_invalid_filters(client, query):
    app.dependency_overrides[current_user] = lambda: {"id": "u", "emailVerified": True}
    app.dependency_overrides[get_db] = MagicMock
    assert client.get("/api/saude/resumo?" + query).status_code == 400


def test_health_summary_route_contract(client, monkeypatch):
    from datetime import date

    from app import health_summary

    db = MagicMock()
    app.dependency_overrides[current_user] = lambda: {"id": "owner", "emailVerified": True}
    app.dependency_overrides[get_db] = lambda: db
    monkeypatch.setattr(health_summary, "today_in_sao_paulo", lambda: date(2026, 11, 27))
    read = MagicMock(return_value={
        "activities": [], "dailyMetrics": [], "trend": [], "totals": {},
        "since": "2026-11-21", "today": "2026-11-27",
    })
    monkeypatch.setattr(health_summary, "read_health_summary", read)
    response = client.get("/api/saude/resumo?period=7&source=strava&user_id=other")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "private, no-store"
    assert response.json() == read.return_value
    read.assert_called_once_with(db, "owner", "7", "strava", date(2026, 11, 27))
