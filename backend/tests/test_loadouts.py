from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.auth import current_user
from app.config import Settings, get_settings
from app.db import get_db
from app.main import app

PATH = "/api/arsenal/conjuntos"
ORIGIN = "https://murim.example"
ID = "d99676b3-0000-4000-8000-000000000001"


@pytest.fixture
def client_db():
    db = MagicMock()
    app.dependency_overrides[current_user] = lambda: {"id": "owner", "emailVerified": True}
    app.dependency_overrides[get_settings] = lambda: Settings(
        enable_writes=True, better_auth_url=ORIGIN, _env_file=None,
    )
    app.dependency_overrides[get_db] = lambda: db
    try:
        with TestClient(app) as client:
            yield client, db
    finally:
        app.dependency_overrides.clear()


@pytest.mark.parametrize("body", [
    {"action": "save", "id": ID, "name": " "},
    {"action": "save", "id": ID, "name": "😀" * 31},
    {"action": "save", "id": ID, "name": None},
    {"action": "save", "id": "bad", "name": "Build"},
    {"action": "invalid", "id": ID},
])
def test_bad_input(client_db, body):
    client, db = client_db
    assert client.post(PATH, json=body, headers={"Origin": ORIGIN}).status_code == 400
    db.execute.assert_not_called()


def test_write_guard(client_db):
    client, db = client_db
    assert client.post(PATH, json={"action": "delete", "id": ID}).status_code == 403
    app.dependency_overrides[current_user] = lambda: None
    assert client.post(PATH, json={"action": "delete", "id": ID},
                       headers={"Origin": ORIGIN}).status_code == 401
    db.execute.assert_not_called()
