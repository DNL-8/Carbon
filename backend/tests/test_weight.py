from datetime import date
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app import weight
from app.auth import current_user
from app.config import Settings, get_settings
from app.db import get_db
from app.main import app

ORIGIN = "https://murim.example"
PATH = "/api/saude/peso"


@pytest.fixture
def setup(monkeypatch):
    db = MagicMock()
    app.dependency_overrides[get_settings] = lambda: Settings(
        enable_writes=True, app_origin=ORIGIN, _env_file=None,
    )
    app.dependency_overrides[current_user] = lambda: {"id": "owner", "emailVerified": True}
    app.dependency_overrides[get_db] = lambda: db
    monkeypatch.setattr(weight, "today_in_sao_paulo", lambda: date(2026, 11, 27))
    try:
        with TestClient(app) as client:
            yield client, db
    finally:
        app.dependency_overrides.clear()


@pytest.mark.parametrize("body", [
    {"kg": 19}, {"kg": 501}, {"kg": "80"}, {"kg": True},
    {"kg": 80, "dateKey": "2026-02-30"}, {"kg": 80, "dateKey": None},
    {"kg": 80, "dateKey": "20261127"}, {"kg": 80, "dateKey": "2026-11-28"},
])
def test_bad_weight(setup, body):
    client, db = setup
    assert client.put(PATH, json=body, headers={"Origin": ORIGIN}).status_code == 400
    db.execute.assert_not_called()
    db.commit.assert_not_called()


def test_upsert_and_delete_use_authenticated_owner(setup):
    client, db = setup
    response = client.put(PATH, json={"kg": 80, "user_id": "other"},
                          headers={"Origin": ORIGIN})
    assert response.json() == {"kg": 80}
    assert response.headers["cache-control"] == "private, no-store"
    statement, args = db.execute.call_args.args
    assert "ON CONFLICT (user_id, day)" in str(statement)
    assert args == {"uid": "owner", "day": "2026-11-27", "kg": 80}
    db.commit.assert_called_once()
    response = client.request("DELETE", PATH, json={"dateKey": "2026-11-27", "uid": "other"},
                              headers={"Origin": ORIGIN})
    assert response.json() == {"deleted": True}
    statement, args = db.execute.call_args.args
    assert "WHERE user_id = :uid AND day = :day" in str(statement)
    assert args == {"uid": "owner", "day": "2026-11-27"}
    assert db.commit.call_count == 2


@pytest.mark.parametrize("origin", [None, "null", "https://evil.example", ORIGIN + ".evil"])
@pytest.mark.parametrize("method", ["PUT", "DELETE"])
def test_reject_cross_origin(setup, origin, method):
    client, db = setup
    headers = {"Origin": origin} if origin else {}
    response = client.request(method, PATH, headers=headers,
                              json={"kg": 80, "dateKey": "2026-11-27"})
    assert response.status_code == 403
    db.execute.assert_not_called()


@pytest.mark.parametrize("user,status", [(None, 401), ({"id": "u", "emailVerified": False}, 403)])
def test_requires_verified_session(setup, user, status):
    client, db = setup
    app.dependency_overrides[current_user] = lambda: user
    assert client.put(PATH, json={"kg": 80}, headers={"Origin": ORIGIN}).status_code == status
    db.execute.assert_not_called()


def test_writes_disabled_by_default(setup):
    client, db = setup
    app.dependency_overrides[get_settings] = lambda: Settings(
        app_origin=ORIGIN, _env_file=None,
    )
    assert client.put(PATH, json={"kg": 80}, headers={"Origin": ORIGIN}).status_code == 503
    db.execute.assert_not_called()
