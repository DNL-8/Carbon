"""Exercise OAuth and Oracle responses with synthetic provider data."""

import time
from urllib.parse import parse_qs, urlsplit

import pytest
from fastapi.testclient import TestClient

from app import oracle, strava
from app.auth import current_user
from app.config import Settings, get_settings
from app.main import app

ORIGIN = "https://murim.example.test"


@pytest.fixture
def client():
    app.dependency_overrides[current_user] = lambda: {"id": "owner", "emailVerified": True}
    app.dependency_overrides[get_settings] = lambda: Settings(
        app_origin=ORIGIN, enable_writes=True, strava_client_id="1",
        strava_client_secret="fixture", strava_session_secret="a" * 40, _env_file=None,
    )
    with TestClient(app, base_url=ORIGIN, follow_redirects=False) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_strava_oauth_ownership_redirect_and_disconnect(client, monkeypatch):
    assert client.post("/api/strava/auth-url").status_code == 403
    response = client.post("/api/strava/auth-url", headers={"Origin": ORIGIN})
    assert response.status_code == 200
    assert "HttpOnly" in response.headers["set-cookie"]
    assert "Secure" in response.headers["set-cookie"]
    query = parse_qs(urlsplit(response.json()["url"]).query)
    assert query["redirect_uri"] == [ORIGIN + "/api/strava/callback"]
    exchanges = []

    def exchange(settings, **kwargs):
        exchanges.append(kwargs)
        return strava.ProviderToken(access_token="fixture-access", refresh_token="fixture-refresh",
                                    expires_at=int(time.time()) + 3600, athlete={"id": 10})

    monkeypatch.setattr(strava, "exchange", exchange)
    parameters = {"state": query["state"][0], "code": "fixture", "scope": "activity:read_all"}
    response = client.get("/api/strava/callback", params=parameters)
    assert response.headers["location"].endswith("strava=connected")
    assert response.headers["referrer-policy"] == "no-referrer"
    assert len(response.headers.get_list("set-cookie")) == 2
    assert len(exchanges) == 1
    assert client.get("/api/strava/callback", params=parameters).headers["location"].endswith("strava=error")
    assert len(exchanges) == 1
    assert client.get("/api/strava/status").json()["connected"] is True
    app.dependency_overrides[current_user] = lambda: {"id": "another", "emailVerified": True}
    assert client.get("/api/strava/status").json()["connected"] is False
    app.dependency_overrides[current_user] = lambda: {"id": "owner", "emailVerified": True}
    import httpx

    def revoke(request):
        assert str(request.url) == "https://www.strava.com/oauth/revoke"
        assert request.headers["authorization"].startswith("Basic ")
        assert parse_qs(request.content.decode())["token"] == ["fixture-refresh"]
        return httpx.Response(200)

    real = httpx.Client
    monkeypatch.setattr(httpx, "Client", lambda **kwargs: real(transport=httpx.MockTransport(revoke), **kwargs))
    assert client.post("/api/strava/disconnect", headers={"Origin": ORIGIN}).json() == {"disconnected": True}
    assert client.get("/api/strava/status").json()["connected"] is False


def test_mapped_strava_workout():
    row = strava.map_activity({"id": 17, "start_date": "2026-11-26T02:00:00Z", "moving_time": 1800,
                               "type": "Run", "distance": 5000, "total_elevation_gain": -2})
    assert (row.externalId, row.dateKey, row.durationMinutes, row.distanceKm) == ("strava_17", "2026-11-25", 30, 5)
    assert row.elevationGainM == 0
    assert not strava.map_activity({"id": 17, "start_date": "2026-11-26T02:00:00Z", "moving_time": 0})


def test_oracle_redacts_identifiers_and_bounds_output(monkeypatch):
    import httpx

    def provider(request):
        assert request.headers["x-goog-api-key"] == "fixture"
        assert "fixture" not in str(request.url)
        return httpx.Response(200, json={"candidates": [{"content": {"parts": [
            {"thought": True, "text": "oculto"}, {"text": " Resposta."},
        ]}}]})

    real = httpx.Client
    monkeypatch.setattr(httpx, "Client", lambda **kwargs: real(transport=httpx.MockTransport(provider), **kwargs))
    assert oracle.gemini_reply("fixture", "test-model", "Como estou?", {"xp": 10}) == "Resposta."


def test_strava_sync_reuses_import_and_refreshes_cookie(client, monkeypatch):
    from unittest.mock import MagicMock

    from app.db import get_db

    app.dependency_overrides[get_db] = lambda: MagicMock()
    settings = app.dependency_overrides[get_settings]()
    session = strava.StravaSession(userId="owner", access="old", refresh="fixture-refresh",
                                   expires=int(time.time()), athleteId=51)
    client.cookies.set(strava.SESSION, strava.seal(session, settings))
    expired = strava.ProviderToken(access_token="fixture-new", refresh_token="fixture-rotated",
                                   expires_at=int(time.time()) + 1000)
    monkeypatch.setattr(strava, "exchange", lambda _settings, **_kwargs: expired)

    def fetch(active_session, days):
        assert active_session.access == "fixture-new" and active_session.athleteId == 51
        assert days == 90
        return [], True

    monkeypatch.setattr(strava, "fetch_activities", fetch)
    response = client.post("/api/strava/sync", json={"days": 90}, headers={"Origin": ORIGIN})
    assert response.json() == {"imported": 0, "duplicates": 0, "xp": 0, "truncated": True}
    value = response.headers["set-cookie"].split(";", 1)[0].split("=", 1)[1]
    assert strava.unseal(value, settings, strava.StravaSession).refresh == "fixture-rotated"


def test_oracle_http_respects_health_opt_in(client, monkeypatch):
    from unittest.mock import MagicMock

    from app.dashboard import dashboard_context
    from app.db import get_db
    from app.health_summary import today_in_sao_paulo

    app.dependency_overrides[get_settings] = lambda: Settings(
        app_origin=ORIGIN, enable_writes=True, gemini_api_key="fixture",
        gemini_model="fixture-model", _env_file=None,
    )
    connection = MagicMock()
    connection.execute.return_value.scalar_one_or_none.return_value = None
    app.dependency_overrides[get_db] = lambda: connection
    monkeypatch.setattr(oracle, "limit", lambda _user: None)
    monkeypatch.setattr(oracle, "read_training_progress", lambda *_args: {"totalXp": 100, "hunterHp": 90})
    monkeypatch.setattr(oracle, "dual_progression", lambda *_args: {
        "hunter": {"level": 2}, "murim": {"current": {"name": "Teste"}},
    })
    monkeypatch.setattr(oracle, "recent_workouts", lambda *_args: [])
    read_health = MagicMock(return_value=([], []))
    monkeypatch.setattr(oracle, "recent_health", read_health)
    reply = MagicMock(return_value="Resposta.")
    monkeypatch.setattr(oracle, "gemini_reply", reply)
    body = {"question": "Como estou?"}
    headers = {"Origin": ORIGIN}
    assert client.post("/api/oracle/ask", json=body, headers=headers).json() == {"reply": "Resposta."}
    read_health.assert_not_called()
    assert "recovery" not in reply.call_args.args[-1]
    assert client.post("/api/oracle/ask", json={**body, "includeHealth": True}, headers=headers).status_code == 200
    read_health.assert_called_once_with(connection, dashboard_context("owner", today_in_sao_paulo()))
    assert reply.call_args.args[-1]["recovery"] == {"periodDays": 28, "acwr": None, "readiness": None}
