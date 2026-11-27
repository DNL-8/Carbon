from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app import training_progress
from app.auth import current_user
from app.db import get_db
from app.main import app


@pytest.fixture
def client():
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.clear()


def test_progress_auth(client):
    app.dependency_overrides[current_user] = lambda: None
    app.dependency_overrides[get_db] = lambda: pytest.fail("unauthorized")
    assert client.get("/api/progresso").status_code == 401


def test_progress_scoped(client, monkeypatch):
    db = MagicMock()
    app.dependency_overrides[current_user] = lambda: {"id": "owner", "emailVerified": True}
    app.dependency_overrides[get_db] = lambda: db
    read = MagicMock(return_value={"xp": 100})
    monkeypatch.setattr(training_progress, "read_progress_response", read)
    response = client.get("/api/progresso?user_id=other")
    assert response.json() == {"xp": 100}
    assert response.headers["cache-control"] == "private, no-store"
    assert read.call_args.args[:2] == (db, "owner")
