import json
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.auth import current_user
from app.config import Settings, get_settings
from app.db import get_db
from app.main import app

ORIGIN = "https://murim.example"
PROFILE = {
    "name": "Herói teste", "heroClass": "Mago",
    "objective": "Ambos", "experience": "Iniciante",
}


@pytest.fixture
def setup():
    db = MagicMock()
    app.dependency_overrides[get_settings] = lambda: Settings(
        enable_writes=True, better_auth_url=ORIGIN, _env_file=None,
    )
    app.dependency_overrides[current_user] = lambda: {"id": "owner", "emailVerified": True}
    app.dependency_overrides[get_db] = lambda: db
    try:
        with TestClient(app) as client:
            yield client, db
    finally:
        app.dependency_overrides.clear()


def test_profile_optional_fields_and_owner(setup):
    client, db = setup
    body = {**PROFILE, "name": "  Herói teste  ", "heightCm": None, "weightKg": 81.5,
            "restingHrBaseline": 60.0, "maxHrEstimated": 190, "userId": "other"}
    expected = {**PROFILE, "heightCm": None, "weightKg": 81.5,
                "restingHrBaseline": 60, "maxHrEstimated": 190}
    response = client.put("/api/heroi", json=body, headers={"Origin": ORIGIN})
    assert response.status_code == 200
    assert response.json() == {"profile": expected}
    assert response.headers["cache-control"] == "private, no-store"
    query, args = db.execute.call_args.args
    assert "ON CONFLICT (user_id)" in str(query)
    assert args["uid"] == "owner"
    assert json.loads(args["data"]) == expected
    db.commit.assert_called_once()


def test_profile_without_biometrics(setup):
    client, db = setup
    response = client.put("/api/heroi", json=PROFILE, headers={"Origin": ORIGIN})
    assert response.json() == {"profile": PROFILE}
    db.commit.assert_called_once()


@pytest.mark.parametrize("change", [
    {"name": " "}, {"name": "a" * 81}, {"name": "😀" * 41}, {"name": 12},
    {"heroClass": "other"}, {"objective": "other"}, {"experience": "other"},
    {"avatar": None}, {"avatar": "😀" * 13}, {"avatar": 12},
    {"heightCm": "180"}, {"heightCm": 99}, {"weightKg": 351}, {"weightKg": True},
    {"restingHrBaseline": 60.5}, {"restingHrBaseline": "60"}, {"restingHrBaseline": 29},
    {"maxHrEstimated": 221}, {"restingHrBaseline": 120, "maxHrEstimated": 120},
])
def test_invalid_profile(setup, change):
    client, db = setup
    response = client.put("/api/heroi", json={**PROFILE, **change}, headers={"Origin": ORIGIN})
    assert response.status_code == 400
    db.execute.assert_not_called()
    db.commit.assert_not_called()


@pytest.mark.parametrize("user,status", [(None, 401), ({"id": "u", "emailVerified": False}, 403)])
def test_profile_requires_verified_account(setup, user, status):
    client, db = setup
    app.dependency_overrides[current_user] = lambda: user
    assert client.put("/api/heroi", json=PROFILE, headers={"Origin": ORIGIN}).status_code == status
    db.execute.assert_not_called()


def test_profile_write_guard(setup):
    client, db = setup
    assert client.put("/api/heroi", json=PROFILE).status_code == 403
    assert client.put("/api/heroi", json=PROFILE,
                      headers={"Origin": "https://other.example"}).status_code == 403
    app.dependency_overrides[get_settings] = lambda: Settings(
        enable_writes=False, better_auth_url=ORIGIN, _env_file=None,
    )
    assert client.put("/api/heroi", json=PROFILE, headers={"Origin": ORIGIN}).status_code == 503
    db.execute.assert_not_called()
