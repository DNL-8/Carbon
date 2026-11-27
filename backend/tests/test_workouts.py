import json
from unittest.mock import MagicMock
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.auth import current_user
from app.config import Settings, get_settings
from app.db import get_db
from app.main import app

ORIGIN = "https://murim.example"
ID = "62ea3473-2400-4ea8-b4dd-03e7c50b9649"
EXERCISE = "5d2d32db-250b-4383-b311-0490d3eebd87"
PATH = "/api/treinos/personalizados/" + ID
BODY = {"name": "Treino", "description": "", "type": "forca", "durationMinutes": 30,
        "exercises": [{"name": "Remada", "prescription": "3 x 10"}]}


@pytest.fixture
def setup():
    db = MagicMock()
    db.execute.return_value.scalar_one_or_none.return_value = None
    app.dependency_overrides[get_settings] = lambda: Settings(
        enable_writes=True, app_origin=ORIGIN, _env_file=None,
    )
    app.dependency_overrides[current_user] = lambda: {"id": "owner", "emailVerified": True}
    app.dependency_overrides[get_db] = lambda: db
    try:
        with TestClient(app) as client:
            yield client, db
    finally:
        app.dependency_overrides.clear()


def test_create_and_edit(setup):
    client, db = setup
    response = client.put(PATH, json={**BODY, "baseXp": 999, "userId": "other"},
                          headers={"Origin": ORIGIN})
    assert response.status_code == 200
    created = response.json()
    exercise = created["exercises"][0]
    assert UUID(exercise["id"]).version == 4
    assert exercise == {**BODY["exercises"][0], "id": exercise["id"],
                        "restSeconds": 60, "muscleGroups": [], "executionTip": ""}
    assert created["id"] == ID and created["baseXp"] == 100
    assert created["rank"] == "F" and created["difficulty"] == "Iniciante"
    assert "userId" not in created
    _, params = db.execute.call_args.args
    assert params["uid"] == "owner" and params["id"] == ID
    assert json.loads(params["data"]) == created
    db.execute.return_value.scalar_one_or_none.return_value = created
    edited = {**BODY, "exercises": [{**exercise, "restSeconds": 0, "unilateral": False}]}
    response = client.put(PATH, json=edited, headers={"Origin": ORIGIN})
    assert response.json()["exercises"] == edited["exercises"]
    assert db.commit.call_count == 2


@pytest.mark.parametrize("change", [
    {"name": " "}, {"name": "😀" * 61}, {"description": None}, {"type": "other"},
    {"durationMinutes": "30"}, {"durationMinutes": 301}, {"durationMinutes": 1.5},
    {"exercises": []}, {"exercises": [BODY["exercises"][0]] * 31},
    {"exercises": [{**BODY["exercises"][0], "restSeconds": None}]},
    {"exercises": [{**BODY["exercises"][0], "id": "not-uuid"}]},
    {"exercises": [{**BODY["exercises"][0], "loadKg": True}]},
    {"exercises": [{**BODY["exercises"][0], "unilateral": "false"}]},
    {"exercises": [{**BODY["exercises"][0], "muscleGroups": [""]}]},
    {"exercises": [{**BODY["exercises"][0], "id": EXERCISE}] * 2},
])
def test_invalid_body(setup, change):
    client, db = setup
    assert client.put(PATH, json={**BODY, **change},
                      headers={"Origin": ORIGIN}).status_code == 400
    db.execute.assert_not_called()


def test_unknown_exercise_not_written(setup):
    client, db = setup
    body = {**BODY, "exercises": [{**BODY["exercises"][0], "id": EXERCISE}]}
    response = client.put(PATH, json=body, headers={"Origin": ORIGIN})
    assert response.status_code == 400
    assert response.json()["statusMessage"] == "Exercicio invalido para este treino"
    assert db.execute.call_count == 2
    db.commit.assert_not_called()


def test_delete_only_owner_and_template(setup):
    client, db = setup
    response = client.delete(PATH, headers={"Origin": ORIGIN})
    assert response.json() == {"deleted": True}
    statement, params = db.execute.call_args.args
    assert "DELETE FROM fitness_custom_workout WHERE user_id = :uid AND id = :id" in str(statement)
    assert params == {"uid": "owner", "id": ID}
    db.commit.assert_called_once()


@pytest.mark.parametrize("method", ["PUT", "DELETE"])
def test_guard_and_invalid_id(setup, method):
    client, db = setup
    body = {"json": BODY} if method == "PUT" else {}
    assert client.request(method, PATH, **body).status_code == 403
    assert client.request(method, "/api/treinos/personalizados/bad",
                          headers={"Origin": ORIGIN}, **body).status_code == 400
    app.dependency_overrides[current_user] = lambda: None
    assert client.request(method, PATH, headers={"Origin": ORIGIN}, **body).status_code == 401
    db.execute.assert_not_called()
