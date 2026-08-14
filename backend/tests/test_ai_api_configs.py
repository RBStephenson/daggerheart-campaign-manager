import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import AiApiConfig
from app.services import secrets


@pytest.fixture(autouse=True)
def _reset_secrets_cache():
    secrets.reset_cache()
    yield
    secrets.reset_cache()


def _config_body(**overrides) -> dict:
    body = {
        "name": "My Anthropic",
        "api_type": "anthropic",
        "model": "claude-sonnet-5",
        "api_key": "sk-ant-testkey1234",
    }
    body.update(overrides)
    return body


def test_defaults_include_ai_text_flags(as_user) -> None:
    client = as_user("gm")
    resp = client.get("/api/settings")
    assert resp.json()["ai_text_enabled"] is False
    assert resp.json()["ai_text_api"] is None


def test_list_requires_gm(as_user) -> None:
    resp = as_user("player").get("/api/settings/ai-apis")
    assert resp.status_code == 403


def test_list_requires_auth(client: TestClient) -> None:
    resp = client.get("/api/settings/ai-apis")
    assert resp.status_code == 401


def test_create_and_list_config(as_user) -> None:
    client = as_user("gm")
    resp = client.post("/api/settings/ai-apis", json=_config_body())
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "My Anthropic"
    assert body["api_type"] == "anthropic"
    assert body["key_set"] is True
    assert body["key_hint"] == "…1234"

    listed = client.get("/api/settings/ai-apis").json()
    assert len(listed) == 1
    assert listed[0]["id"] == body["id"]


def test_api_key_never_returned_in_full(as_user) -> None:
    client = as_user("gm")
    resp = client.post("/api/settings/ai-apis", json=_config_body())
    body = resp.json()
    assert "api_key" not in body
    assert "sk-ant-testkey1234" not in resp.text


def test_config_creatable_without_key(as_user) -> None:
    client = as_user("gm")
    body = _config_body(name="Local Ollama", api_type="openai", api_key=None)
    resp = client.post("/api/settings/ai-apis", json=body)
    assert resp.status_code == 201
    out = resp.json()
    assert out["key_set"] is False
    assert out["key_hint"] is None


def test_invalid_api_type_rejected(as_user) -> None:
    client = as_user("gm")
    resp = client.post("/api/settings/ai-apis", json=_config_body(api_type="ollama"))
    assert resp.status_code == 422


def test_update_config_fields(as_user) -> None:
    client = as_user("gm")
    created = client.post("/api/settings/ai-apis", json=_config_body()).json()
    resp = client.patch(
        f"/api/settings/ai-apis/{created['id']}", json={"model": "claude-opus-5"}
    )
    assert resp.status_code == 200
    assert resp.json()["model"] == "claude-opus-5"
    assert resp.json()["name"] == "My Anthropic"  # unchanged


def test_update_rotates_key(as_user, db: Session) -> None:
    client = as_user("gm")
    created = client.post("/api/settings/ai-apis", json=_config_body()).json()
    client.patch(f"/api/settings/ai-apis/{created['id']}", json={"api_key": "sk-ant-newkey5678"})
    assert secrets.get_ai_api_config_key(db, created["id"]) == "sk-ant-newkey5678"


def test_update_unknown_config_404s(as_user) -> None:
    resp = as_user("gm").patch("/api/settings/ai-apis/999", json={"model": "x"})
    assert resp.status_code == 404


def test_update_rejects_unknown_field(as_user) -> None:
    client = as_user("gm")
    created = client.post("/api/settings/ai-apis", json=_config_body()).json()
    resp = client.patch(f"/api/settings/ai-apis/{created['id']}", json={"bogus": 1})
    assert resp.status_code == 422


def test_delete_config_and_its_key(as_user, db: Session) -> None:
    client = as_user("gm")
    created = client.post("/api/settings/ai-apis", json=_config_body()).json()
    resp = client.delete(f"/api/settings/ai-apis/{created['id']}")
    assert resp.status_code == 204
    assert db.get(AiApiConfig, created["id"]) is None
    assert secrets.get_ai_api_config_key(db, created["id"]) is None


def test_delete_unknown_config_404s(as_user) -> None:
    resp = as_user("gm").delete("/api/settings/ai-apis/999")
    assert resp.status_code == 404


def test_multiple_configs_keys_independent(as_user, db: Session) -> None:
    client = as_user("gm")
    a = client.post("/api/settings/ai-apis", json=_config_body(name="A", api_key="key-a")).json()
    b = client.post("/api/settings/ai-apis", json=_config_body(name="B", api_key="key-b")).json()

    client.delete(f"/api/settings/ai-apis/{a['id']}")

    assert secrets.get_ai_api_config_key(db, a["id"]) is None
    assert secrets.get_ai_api_config_key(db, b["id"]) == "key-b"


def test_ai_text_api_settable_via_settings(as_user) -> None:
    client = as_user("gm")
    created = client.post("/api/settings/ai-apis", json=_config_body()).json()
    resp = client.put("/api/settings", json={"ai_text_enabled": True, "ai_text_api": created["id"]})
    assert resp.status_code == 200
    assert resp.json()["ai_text_enabled"] is True
    assert resp.json()["ai_text_api"] == created["id"]
