"""POST /api/ai/generate (DHCM-96) -- endpoint-level gating and wiring.
Actual model-call behavior is covered in test_ai_text.py; here the Anthropic
client is mocked purely to exercise the router's success path."""
import types

import pytest

from app.services import ai_text, secrets


@pytest.fixture(autouse=True)
def _reset_secrets_cache():
    secrets.reset_cache()
    yield
    secrets.reset_cache()


def _fake_anthropic_client(text: str):
    block = types.SimpleNamespace(type="text", text=text)
    response = types.SimpleNamespace(content=[block], stop_reason=None)

    class _Client:
        def __init__(self, *a, **k):
            self.messages = types.SimpleNamespace(create=lambda **kw: response)

    return _Client


def _create_config(client, **overrides):
    body = {
        "name": "Claude",
        "api_type": "anthropic",
        "model": "claude-sonnet-5",
        "api_key": "sk-test",
    }
    body.update(overrides)
    return client.post("/api/settings/ai-apis", json=body).json()


def _enable(client, config_id):
    client.put("/api/settings", json={"ai_text_enabled": True, "ai_text_api": config_id})


def _generate_body(**overrides):
    body = {"entity_type": "npc", "existing_fields": {"name": "Grask"}, "prompt": "a rumor hook"}
    body.update(overrides)
    return body


def test_requires_auth(client) -> None:
    resp = client.post("/api/ai/generate", json=_generate_body())
    assert resp.status_code == 401


def test_requires_gm(as_user) -> None:
    resp = as_user("player").post("/api/ai/generate", json=_generate_body())
    assert resp.status_code == 403


def test_disabled_flag_rejected(as_user) -> None:
    client = as_user("gm")
    _create_config(client)
    resp = client.post("/api/ai/generate", json=_generate_body())
    assert resp.status_code == 403


def test_enabled_but_no_config_selected_rejected(as_user) -> None:
    client = as_user("gm")
    client.put("/api/settings", json={"ai_text_enabled": True})
    resp = client.post("/api/ai/generate", json=_generate_body())
    assert resp.status_code == 400


def test_enabled_with_deleted_config_rejected(as_user) -> None:
    client = as_user("gm")
    config = _create_config(client)
    _enable(client, config["id"])
    client.delete(f"/api/settings/ai-apis/{config['id']}")
    resp = client.post("/api/ai/generate", json=_generate_body())
    assert resp.status_code == 400


def test_successful_generation(as_user, monkeypatch) -> None:
    monkeypatch.setattr(ai_text, "Anthropic", _fake_anthropic_client("A shady merchant rumor."))
    client = as_user("gm")
    config = _create_config(client)
    _enable(client, config["id"])

    resp = client.post("/api/ai/generate", json=_generate_body())
    assert resp.status_code == 200
    assert resp.json() == {"draft": "A shady merchant rumor."}


def test_upstream_failure_surfaces_as_502(as_user, monkeypatch) -> None:
    class _Boom:
        def __init__(self, *a, **k):
            raise RuntimeError("connection refused")

    monkeypatch.setattr(ai_text, "Anthropic", _Boom)
    client = as_user("gm")
    config = _create_config(client)
    _enable(client, config["id"])

    resp = client.post("/api/ai/generate", json=_generate_body())
    assert resp.status_code == 502
    assert "connection refused" in resp.json()["detail"]


def test_empty_prompt_rejected(as_user) -> None:
    client = as_user("gm")
    config = _create_config(client)
    _enable(client, config["id"])
    resp = client.post("/api/ai/generate", json=_generate_body(prompt=""))
    assert resp.status_code == 422
