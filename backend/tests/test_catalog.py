from datetime import UTC, datetime
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.auth import current_user
from app.catalog import achievement_definitions, workout_catalog
from app.db import get_db
from app.main import app


@pytest.fixture
def client():
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.clear()


def test_catalog_public(client):
    app.dependency_overrides[current_user] = lambda: pytest.fail("public route")
    app.dependency_overrides[get_db] = lambda: pytest.fail("public route")
    response = client.get("/api/catalogo")
    assert response.status_code == 200
    assert response.json() == workout_catalog()
    assert response.headers["cache-control"] == "no-store"
    assert len({w["id"] for w in response.json()}) == len(response.json())


def test_achievements_scoped(client):
    db = MagicMock()
    unlocked = achievement_definitions()[0]["id"]
    when = datetime(2026, 11, 27, tzinfo=UTC)
    db.execute.return_value.mappings.return_value = [
        {"id": unlocked, "unlocked_at": when},
        {"id": "unknown", "unlocked_at": when},
    ]
    app.dependency_overrides[current_user] = lambda: {"id": "owner", "emailVerified": True}
    app.dependency_overrides[get_db] = lambda: db
    response = client.get("/api/conquistas?user_id=other")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "private, no-store"
    actual = response.json()
    assert [x["id"] for x in actual] == [x["id"] for x in achievement_definitions()]
    assert actual[0]["unlockedAt"] == "2026-11-27T00:00:00.000Z"
    assert all(x["unlockedAt"] is None for x in actual[1:])
    query, params = db.execute.call_args.args
    assert "WHERE user_id = :uid" in str(query)
    assert params == {"uid": "owner"}


def test_achievements_requires_session(client):
    app.dependency_overrides[current_user] = lambda: None
    app.dependency_overrides[get_db] = lambda: pytest.fail("unauthorized")
    assert client.get("/api/conquistas").status_code == 401
