"""Loopback-only fixture: Google exchange is simulated, signatures are real."""
import json
import time
from os import environ
from types import SimpleNamespace
from urllib.parse import urlsplit

import httpx
import uvicorn
from app import python_auth, python_auth_routes
from app.db import engine
from app.main import app
from joserfc import jwt
from joserfc.jwk import RSAKey
from sqlalchemy import text

key = RSAKey.generate_key(2048, parameters={"kid": "browser-fixture"})
real_client = httpx.Client
real_oauth = python_auth_routes.oauth


def provider(request):
    if str(request.url) != "https://www.googleapis.com/oauth2/v3/certs":
        raise AssertionError("External HTTP disabled in this fixture")
    return httpx.Response(200, json={"keys": [key.as_dict(private=False)]})


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


if __name__ == "__main__":
    database = urlsplit(environ["DATABASE_URL"])
    if (database.scheme != "postgresql" or database.hostname != "127.0.0.1"
            or database.path != "/murim_fastapi_test" or database.query or database.fragment):
        raise RuntimeError("Disposable loopback PostgreSQL required")
    if environ.get("AUTH_PROVIDER") != "authlib" or environ.get("AUTH_ORIGIN"):
        raise RuntimeError("Authlib only; no Nitro origin permitted")
    with engine().begin() as conn:
        for person in ("a", "b"):
            uid = "python-auth-browser-" + person
            conn.execute(text("DELETE FROM auth_user WHERE id=:id"), {"id": uid})
            conn.execute(text("INSERT INTO auth_user(id,name,email,email_verified) "
                              "VALUES (:id,:name,:email,true)"),
                         {"id": uid, "name": "Browser " + person,
                          "email": "browser-" + person + "@example.test"})
            profile = {"name": "Hero " + person, "heroClass": "Guerreiro",
                       "objective": "Ambos", "experience": "Iniciante", "avatar": "⚔️"}
            conn.execute(text("INSERT INTO fitness_hero_profile(user_id,data) "
                              "VALUES (:id,CAST(:data AS jsonb))"),
                         {"id": uid, "data": json.dumps(profile)})
    python_auth.httpx = SimpleNamespace(Client=stub_client, HTTPError=httpx.HTTPError)
    python_auth_routes.oauth = oauth
    uvicorn.run(app, host="127.0.0.1", port=38212, access_log=False)
