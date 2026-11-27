import time
from urllib.parse import parse_qs, urlsplit

import httpx
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from joserfc import jwt
from joserfc.jwk import RSAKey

from app import python_auth
from app.config import Settings, get_settings
from app.main import app

ORIGIN = "http://127.0.0.1:38200"


def settings():
    return Settings(_env_file=None, app_origin=ORIGIN,
                    google_client_id="test-client", google_client_secret="fixture",
                    python_auth_secret="x" * 48, google_users={"sub-a": "existing-a",
                                                              "sub-b": "existing-b"})


@pytest.fixture
def client():
    app.dependency_overrides[get_settings] = settings
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.clear()


def test_google_redirect_and_csrf(client):
    assert client.post("/api/auth/sign-in/social", json={"provider": "google"}).status_code == 403
    response = client.post("/api/auth/sign-in/social", headers={"Origin": ORIGIN},
                           json={"provider": "google", "callbackURL": "https://evil.test"})
    assert response.status_code == 200
    url = urlsplit(response.json()["url"])
    params = parse_qs(url.query)
    assert url.hostname == "accounts.google.com"
    assert params["redirect_uri"] == [ORIGIN + "/api/auth/callback/google"]
    assert params["code_challenge_method"] == ["S256"]
    assert params["nonce"] and params["state"]
    assert "HttpOnly" in response.headers["set-cookie"]
    assert client.get("/api/auth/callback/google?code=bad&state=bad").status_code == 401


def test_google_token_signature_and_claims(monkeypatch):
    key = RSAKey.generate_key(2048, parameters={"kid": "test"})
    public = key.as_dict(private=False)
    real = httpx.Client
    transport = httpx.MockTransport(lambda _: httpx.Response(200, json={"keys": [public]}))
    monkeypatch.setattr(httpx, "Client", lambda **kw: real(transport=transport, **kw))
    claims = {"iss": "https://accounts.google.com", "aud": "test-client", "sub": "sub-a",
              "email": "test@example.test", "email_verified": True, "nonce": "nonce",
              "exp": int(time.time()) + 60, "iat": int(time.time())}
    def signed(values):
        return jwt.encode({"alg": "RS256", "kid": "test"}, values, key)
    assert python_auth.verify_google(signed(claims), settings(), "nonce")["sub"] == "sub-a"
    for changes in ({"aud": "wrong"}, {"email_verified": False}, {"exp": 1},
                    {"iss": "https://evil.test"}, {"nonce": "wrong"}):
        with pytest.raises(HTTPException) as exc:
            python_auth.verify_google(signed({**claims, **changes}), settings(), "nonce")
        assert exc.value.status_code == 401


def test_fail_closed_and_private_only(client, monkeypatch):
    assert client.get("/api/auth/get-session").json() is None
    assert client.post("/api/auth/sign-up/email", json={}).status_code == 404
    monkeypatch.setattr("app.python_auth_routes.verify_google",
                        lambda *_: {"sub": "outside", "email": "other@example.test"})
    response = client.post("/api/auth/sign-in/social", headers={"Origin": ORIGIN},
                           json={"provider": "google", "idToken": {"token": "fixture"}})
    assert response.status_code == 403


def test_session_lifecycle_postgres(client, monkeypatch):
    import os
    import secrets

    from sqlalchemy import create_engine, text
    from sqlalchemy.engine import make_url

    raw = os.environ.get("MURIM_TEST_DATABASE_URL")
    if not raw:
        pytest.skip("requires disposable local PostgreSQL")
    url = make_url(raw)
    assert url.host in {"127.0.0.1", "localhost"} and url.database == "murim_fastapi_test"
    db = create_engine(url.set(drivername="postgresql+psycopg"))
    uid = "python-auth-test-" + secrets.token_hex(8)
    email = uid + "@example.test"
    configured = settings().model_copy(update={"google_users": {"sub-a": uid}})
    app.dependency_overrides[get_settings] = lambda: configured
    monkeypatch.setattr(python_auth, "engine", lambda: db)
    monkeypatch.setattr("app.python_auth_routes.engine", lambda: db)
    claims = {"sub": "sub-a", "email": email, "exp": int(time.time()) + 300}
    monkeypatch.setattr("app.python_auth_routes.verify_google", lambda *_: claims)
    raw_token = secrets.token_urlsafe(48)
    data = {"provider": "google", "idToken": {"token": raw_token}}
    headers = {"Origin": ORIGIN}
    try:
        with db.begin() as conn:
            conn.execute(text("INSERT INTO auth_user(id,name,email,email_verified) "
                              "VALUES (:id,'Test',:email,true)"), {"id": uid, "email": email})
        response = client.post("/api/auth/sign-in/social", headers=headers, json=data)
        assert response.status_code == 200
        assert response.json()["user"]["id"] == uid
        cookie = client.cookies[python_auth.cookie_name(ORIGIN)]
        with db.connect() as conn:
            stored = conn.execute(text("SELECT token FROM auth_session WHERE user_id=:uid"),
                                  {"uid": uid}).scalar_one()
            assert stored == python_auth.digest(cookie) and cookie != stored
        assert client.get("/api/conta").json() == {"authenticated": True}
        assert client.post("/api/auth/sign-in/social", headers=headers, json=data).status_code == 401
        assert client.post("/api/auth/sign-out", headers=headers).status_code == 200
        assert client.get("/api/conta").json() == {"authenticated": False}
        with db.connect() as conn:
            assert not conn.execute(text("SELECT id FROM auth_session WHERE user_id=:uid"),
                                    {"uid": uid}).first()
    finally:
        import hashlib

        with db.begin() as conn:
            conn.execute(text("DELETE FROM auth_user WHERE id=:uid"), {"uid": uid})
            conn.execute(text("DELETE FROM auth_verification WHERE id=:id"),
                         {"id": "murim-native:" + hashlib.sha256(raw_token.encode()).hexdigest()})
        db.dispose()
