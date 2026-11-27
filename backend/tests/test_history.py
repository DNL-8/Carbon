from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app import history
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


@pytest.mark.parametrize("user,status", [(None, 401), ({"id": "u", "emailVerified": False}, 403)])
def test_history_auth(client, user, status):
    app.dependency_overrides[current_user] = lambda: user
    app.dependency_overrides[get_db] = lambda: pytest.fail("unauthorized database access")
    assert client.get("/api/treinos/historico").status_code == status


def test_history_contract(client, monkeypatch):
    db = MagicMock()
    app.dependency_overrides[current_user] = lambda: {"id": "owner", "emailVerified": True}
    app.dependency_overrides[get_db] = lambda: db
    read = MagicMock(return_value={"history": [], "records": []})
    monkeypatch.setattr(history, "read_history", read)
    response = client.get("/api/treinos/historico?user_id=other")
    assert response.json() == {"history": [], "records": []}
    assert response.headers["cache-control"] == "private, no-store"
    read.assert_called_once_with(db, "owner")
