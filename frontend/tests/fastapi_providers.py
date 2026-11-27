"""Run FastAPI against local Better Auth and synthetic responses from external providers."""

import json
import time
from datetime import UTC, datetime
from os import environ
from urllib.parse import urlsplit

import httpx
import uvicorn
from app.config import Settings, get_settings
from app.main import app
from fastapi import Request

real_client = httpx.Client


def provider(request: httpx.Request) -> httpx.Response:
    if request.url.host == "generativelanguage.googleapis.com":
        body = json.loads(request.content)
        context = json.loads(body["contents"][0]["parts"][0]["text"])["context"]
        reply = "Resumo de recuperação autorizado." if "recovery" in context else "Consulta sem resumo de recuperação."
        return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": reply}]}}]})
    if request.url.host == "www.strava.com" and request.url.path == "/oauth/token":
        return httpx.Response(200, json={
            "access_token": "test-access", "refresh_token": "test-refresh",
            "expires_at": int(time.time()) + 3600, "athlete": {"id": 5},
        })
    if request.url.host == "www.strava.com" and request.url.path == "/api/v3/athlete/activities":
        assert request.headers["authorization"] == "Bearer test-access"
        return httpx.Response(200, json=[{
            "id": 17, "name": "Atividade Strava de teste", "type": "Run",
            "start_date": datetime.now(UTC).isoformat(), "moving_time": 1800,
        }])
    assert request.url.host == "127.0.0.1" and request.url.port == 38203
    with real_client(timeout=5, trust_env=False) as client:
        return client.send(request)


def stub_client(**options) -> httpx.Client:
    return real_client(transport=httpx.MockTransport(provider), **options)


def request_settings(request: Request) -> Settings:
    settings = get_settings()
    if request.url.path.startswith("/api/strava/"):
        return settings.model_copy(update={"better_auth_url": "https://murim.example.test"})
    return settings


httpx.Client = stub_client
app.dependency_overrides[get_settings] = request_settings

if __name__ == "__main__":
    database = urlsplit(environ["DATABASE_URL"])
    if (database.scheme != "postgresql" or database.hostname not in {"127.0.0.1", "localhost", "::1"}
            or database.path != "/murim_fastapi_test" or database.query or database.fragment):
        raise RuntimeError("The provider fixture requires a disposable local PostgreSQL database.")
    uvicorn.run(app, host="127.0.0.1", port=38202, access_log=False)
