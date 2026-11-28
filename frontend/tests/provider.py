"""Loopback-only fixture: Google exchange is simulated, signatures are real."""
import json
import time
from os import environ
from datetime import UTC, datetime
from types import SimpleNamespace
from urllib.parse import urlsplit

import httpx
import uvicorn
from app import main, oracle, python_auth, python_auth_routes, strava
from app.strava_config import public_strava_config
from app.db import engine
from app.main import app
from joserfc import jwt
from joserfc.jwk import RSAKey
from sqlalchemy import text

key = RSAKey.generate_key(2048, parameters={"kid": "browser-fixture"})
real_client = httpx.Client
real_oauth = python_auth_routes.oauth


def provider(request):
    if str(request.url) == "https://www.googleapis.com/oauth2/v3/certs":
        return httpx.Response(200, json={"keys": [key.as_dict(private=False)]})
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
    if request.url.host == "www.strava.com" and request.url.path == "/oauth/revoke":
        assert request.headers["authorization"].startswith("Basic ")
        return httpx.Response(200)
    if request.url.host == "www.strava.com" and request.url.path == "/api/v3/athlete/activities":
        assert request.headers["authorization"] == "Bearer test-access"
        return httpx.Response(200, json=[{
            "id": 17, "name": "Atividade Strava de teste", "type": "Run",
            "start_date": datetime.now(UTC).isoformat(), "moving_time": 1800,
        }])
    raise AssertionError("External HTTP disabled in this fixture")


def stub_client(**options):
    return real_client(transport=httpx.MockTransport(provider), **options)


def oauth(settings, origin):
    client = real_oauth(settings, origin)

    def exchange(url, *, code, code_verifier):
        assert url == "https://oauth2.googleapis.com/token"
        assert len(code_verifier) >= 43
        person, nonce = code.split(".", 1)
        assert person in {"a", "b", "outside"}
        return {"id_token": jwt.encode({"alg": "RS256", "kid": "browser-fixture"}, {
            "iss": "https://accounts.google.com", "aud": settings.google_client_id,
            "sub": "browser-" + person, "nonce": nonce, "email_verified": True,
            "email": "browser-" + person + "@example.test",
            "iat": int(time.time()), "exp": int(time.time()) + 120,
        }, key)}

    client.fetch_token = exchange
    return client


def seed(profiles: bool = True):
    with engine().begin() as conn:
        for person in ("a", "b"):
            uid = "python-auth-browser-" + person
            conn.execute(text("DELETE FROM auth_user WHERE id=:id"), {"id": uid})
            conn.execute(text("INSERT INTO auth_user(id,name,email,email_verified) "
                              "VALUES (:id,:name,:email,true)"),
                         {"id": uid, "name": "Browser " + person,
                          "email": "browser-" + person + "@example.test"})
            if profiles:
                profile = {"name": "Hero " + person, "heroClass": "Guerreiro",
                           "objective": "Ambos", "experience": "Iniciante", "avatar": "⚔️"}
                conn.execute(text("INSERT INTO fitness_hero_profile(user_id,data) "
                                  "VALUES (:id,CAST(:data AS jsonb))"),
                             {"id": uid, "data": json.dumps(profile)})


def strava_config(settings):
    return public_strava_config(settings.model_copy(update={"app_origin": "https://murim.example.test"}))


if __name__ == "__main__":
    database = urlsplit(environ["DATABASE_URL"])
    if (database.scheme != "postgresql" or database.hostname != "127.0.0.1"
            or database.path != "/murim_fastapi_test" or database.query or database.fragment):
        raise RuntimeError("Disposable loopback PostgreSQL required")
    seed()
    # Registered exclusively on the disposable test server, not the production app.
    app.post("/__fixture/reset")(seed)
    proxy = SimpleNamespace(
        Client=stub_client, Timeout=httpx.Timeout, HTTPError=httpx.HTTPError,
        HTTPStatusError=httpx.HTTPStatusError, TimeoutException=httpx.TimeoutException,
    )
    python_auth.httpx = oracle.httpx = strava.httpx = proxy
    python_auth_routes.oauth = oauth
    strava.public_strava_config = main.public_strava_config = strava_config
    uvicorn.run(app, host="127.0.0.1", port=38212, access_log=False)
