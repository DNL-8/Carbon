from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.auth import current_user
from app.config import Settings, get_settings
from app.db import get_db
from app.main import app

PATH = "/api/treinos/concluir"
ORIGIN = "https://murim.example"
BODY = {"id": "d99676b3-0000-4000-8000-000000000001", "workoutId": "w-despertar-guerreiro-a",
        "sets": [{"exerciseId": "ex-dg-a-1", "reps": 10, "weightKg": 10}]}


@pytest.fixture
def setup():
    db = MagicMock()
    app.dependency_overrides[current_user] = lambda: {"id": "owner", "emailVerified": True}
    app.dependency_overrides[get_settings] = lambda: Settings(
        enable_writes=True, app_origin=ORIGIN, _env_file=None,
    )
    app.dependency_overrides[get_db] = lambda: db
    try:
        with TestClient(app) as client:
            yield client, db
    finally:
        app.dependency_overrides.clear()


@pytest.mark.parametrize("change", [
    {"id": "bad"}, {"sets": []}, {"elapsedSeconds": 28801},
    {"sets": [{"exerciseId": "x", "reps": True, "weightKg": 10}]},
])
def test_invalid_completion(setup, change):
    client, db = setup
    assert client.post(PATH, json={**BODY, **change}, headers={"Origin": ORIGIN}).status_code == 400
    db.execute.assert_not_called()


def test_guard(setup):
    client, db = setup
    assert client.post(PATH, json=BODY).status_code == 403
    db.execute.assert_not_called()
