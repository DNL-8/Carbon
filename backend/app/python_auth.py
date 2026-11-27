"""Google-only authentication with explicitly provisioned existing user IDs."""
import hashlib
import secrets
import time
from datetime import UTC, datetime, timedelta

import httpx
from fastapi import HTTPException
from joserfc import jwt
from joserfc.errors import JoseError
from joserfc.jwk import KeySet
from sqlalchemy import text

from .db import engine
from .strava_config import web_origin

GOOGLE = "https://accounts.google.com"
TTL = 604800


def config(settings):
    origin = web_origin(settings.better_auth_url)
    users = settings.google_users
    if (settings.auth_provider != "authlib" or not origin
            or not (origin.startswith(("https://", "http://127.0.0.1:")))
            or not settings.google_client_id or not settings.google_client_secret
            or len(settings.python_auth_secret) < 32 or not 1 <= len(users) <= 2
            or len(set(users.values())) != len(users) or not all(users)
            or not all(users.values())):
        raise HTTPException(503, "Autenticacao Google indisponivel")
    return origin, users


def cookie_name(origin):
    return ("__Secure-" if origin.startswith("https://") else "") + "better-auth.session_token"


def digest(token):
    return "murim-v1:" + hashlib.sha256(token.encode()).hexdigest()


def session_user(request, settings):
    origin, users = config(settings)
    token = request.cookies.get(cookie_name(origin), "")
    if not token.startswith("m1.") or len(token) > 100:
        return None
    with engine().connect() as conn:
        row = conn.execute(text("""
            SELECT u.id, u.email, u.name, u.image, u.email_verified AS "emailVerified"
            FROM auth_session s JOIN auth_user u ON u.id=s.user_id
            WHERE s.token=:token AND s.expires_at>now() AND u.email_verified
        """), {"token": digest(token)}).mappings().one_or_none()
    return dict(row) if row and row["id"] in users.values() else None


def verify_google(raw, settings, nonce=None):
    try:
        with httpx.Client(timeout=8, trust_env=False) as client:
            response = client.get("https://www.googleapis.com/oauth2/v3/certs")
            response.raise_for_status()
        claims = jwt.decode(raw, KeySet.import_key_set(response.json()),
                            algorithms=["RS256"]).claims
        now = time.time()
        if (claims["iss"] not in (GOOGLE, "accounts.google.com")
                or claims["aud"] != settings.google_client_id
                or claims.get("azp", settings.google_client_id) != settings.google_client_id
                or not now < claims["exp"] or claims["iat"] > now + 60
                or claims.get("email_verified") is not True
                or not isinstance(claims["sub"], str)
                or not isinstance(claims["email"], str)
                or (nonce is not None and claims.get("nonce") != nonce)):
            raise ValueError("invalid claims")
        return claims
    except (httpx.HTTPError, JoseError, ValueError, KeyError, TypeError, AttributeError):
        raise HTTPException(401, "Identidade Google invalida") from None


def issue(claims, settings, response, native_token=None):
    origin, users = config(settings)
    uid = users.get(claims["sub"])
    if not uid:
        raise HTTPException(403, "Conta nao autorizada")
    token = "m1." + secrets.token_urlsafe(32)
    with engine().begin() as conn:
        row = conn.execute(text("""
            SELECT id, email, name, image, email_verified AS "emailVerified"
            FROM auth_user WHERE id=:uid AND email_verified AND lower(email)=lower(:email)
        """), {"uid": uid, "email": claims["email"]}).mappings().one_or_none()
        if not row:
            raise HTTPException(403, "Conta nao provisionada")
        if native_token:
            marker = "murim-native:" + hashlib.sha256(native_token.encode()).hexdigest()
            conn.execute(text("DELETE FROM auth_verification WHERE id LIKE 'murim-native:%' AND expires_at < now()"))
            inserted = conn.execute(text("""
                INSERT INTO auth_verification(id,identifier,value,expires_at)
                VALUES (:id,:id,'redeemed',:expires) ON CONFLICT (id) DO NOTHING
                RETURNING id
            """), {"id": marker, "expires": datetime.fromtimestamp(claims["exp"], UTC)}).scalar()
            if not inserted:
                raise HTTPException(401, "Identidade Google ja utilizada")
        conn.execute(text("DELETE FROM auth_session WHERE token LIKE 'murim-v1:%' AND expires_at < now()"))
        conn.execute(text("""
            INSERT INTO auth_session(id,user_id,token,expires_at)
            VALUES (:id,:uid,:token,:expires)
        """), {"id": secrets.token_hex(24), "uid": uid, "token": digest(token),
               "expires": datetime.now(UTC) + timedelta(seconds=TTL)})
        user = dict(row)
    response.set_cookie(cookie_name(origin), token, max_age=TTL, httponly=True,
                        secure=origin.startswith("https://"), samesite="lax")
    return user
