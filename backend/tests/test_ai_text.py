"""AI text draft generation (DHCM-96). The Anthropic client and httpx are
monkeypatched at the boundary -- no live API calls."""
import types

import httpx
import pytest

from app.models import AiApiConfig
from app.services import ai_text, secrets


@pytest.fixture(autouse=True)
def _reset_secrets_cache():
    secrets.reset_cache()
    yield
    secrets.reset_cache()


def _anthropic_config(**overrides) -> AiApiConfig:
    defaults = dict(
        id=1, name="Claude", api_type="anthropic", url=None, model="claude-sonnet-5",
        effort="low", request_timeout=10, batch_size=None, reasoning_enabled=False,
    )
    defaults.update(overrides)
    return AiApiConfig(**defaults)


def _openai_config(**overrides) -> AiApiConfig:
    defaults = dict(
        id=2, name="Ollama", api_type="openai", url="http://localhost:11434",
        model="llama3", effort=None, request_timeout=10, batch_size=None,
        reasoning_enabled=False,
    )
    defaults.update(overrides)
    return AiApiConfig(**defaults)


def _anthropic_response(text: str, *, stop_reason: str | None = None):
    block = types.SimpleNamespace(type="text", text=text)
    return types.SimpleNamespace(content=[block], stop_reason=stop_reason)


def _fake_anthropic_client(text: str, *, stop_reason: str | None = None, captured=None):
    response = _anthropic_response(text, stop_reason=stop_reason)

    def _create(**kw):
        if captured is not None:
            captured.update(kw)
        return response

    class _Client:
        def __init__(self, *a, **k):
            self.messages = types.SimpleNamespace(create=_create)

    return _Client


class _Boom:
    def __init__(self, *a, **k):
        raise RuntimeError("connection refused")


def test_anthropic_success(monkeypatch):
    monkeypatch.setattr(ai_text, "Anthropic", _fake_anthropic_client("Here is a draft."))
    draft, error = ai_text.generate_draft(_anthropic_config(), "sk-test", "write something")
    assert draft == "Here is a draft."
    assert error is None


def test_anthropic_no_key_is_a_clean_error(monkeypatch):
    monkeypatch.setattr(ai_text, "Anthropic", _fake_anthropic_client("unused"))
    draft, error = ai_text.generate_draft(_anthropic_config(), "", "write something")
    assert draft is None
    assert "No API key" in error


def test_anthropic_exception_is_a_clean_error(monkeypatch):
    monkeypatch.setattr(ai_text, "Anthropic", _Boom)
    draft, error = ai_text.generate_draft(_anthropic_config(), "sk-test", "write something")
    assert draft is None
    assert "connection refused" in error


def test_anthropic_empty_response_is_a_clean_error(monkeypatch):
    monkeypatch.setattr(
        ai_text, "Anthropic", _fake_anthropic_client("", stop_reason="max_tokens")
    )
    draft, error = ai_text.generate_draft(_anthropic_config(), "sk-test", "write something")
    assert draft is None
    assert "Empty response" in error


def test_anthropic_effort_sets_thinking_budget(monkeypatch):
    captured: dict = {}
    monkeypatch.setattr(
        ai_text, "Anthropic", _fake_anthropic_client("draft", captured=captured)
    )
    ai_text.generate_draft(_anthropic_config(effort="high"), "sk-test", "write something")
    assert captured["thinking"] == {"type": "enabled", "budget_tokens": 8000}
    assert captured["max_tokens"] == ai_text._DEFAULT_MAX_TOKENS + 8000


def _fake_response(status_code: int, **kwargs) -> httpx.Response:
    return httpx.Response(
        status_code, request=httpx.Request("POST", "http://localhost:11434/v1/chat/completions"),
        **kwargs,
    )


def test_openai_success(monkeypatch):
    def _fake_post(url, json, headers, timeout):
        return _fake_response(
            200, json={"choices": [{"message": {"content": "Here is a draft."}}]}
        )

    monkeypatch.setattr(httpx, "post", _fake_post)
    draft, error = ai_text.generate_draft(_openai_config(), "", "write something")
    assert draft == "Here is a draft."
    assert error is None


def test_openai_no_url_is_a_clean_error():
    draft, error = ai_text.generate_draft(_openai_config(url=None), "", "write something")
    assert draft is None
    assert "No endpoint URL" in error


def test_openai_timeout_is_a_clean_error(monkeypatch):
    def _fake_post(*a, **k):
        raise httpx.TimeoutException("timed out")

    monkeypatch.setattr(httpx, "post", _fake_post)
    draft, error = ai_text.generate_draft(_openai_config(), "", "write something")
    assert draft is None
    assert "Timed out" in error


def test_openai_http_error_is_a_clean_error(monkeypatch):
    def _fake_post(url, json, headers, timeout):
        return _fake_response(500, text="internal error")

    monkeypatch.setattr(httpx, "post", _fake_post)
    draft, error = ai_text.generate_draft(_openai_config(), "", "write something")
    assert draft is None
    assert error is not None


def test_openai_empty_content_is_a_clean_error(monkeypatch):
    def _fake_post(url, json, headers, timeout):
        return _fake_response(200, json={"choices": [{"message": {"content": ""}}]})

    monkeypatch.setattr(httpx, "post", _fake_post)
    draft, error = ai_text.generate_draft(_openai_config(), "", "write something")
    assert draft is None
    assert "Empty response" in error


def test_openai_unexpected_shape_is_a_clean_error(monkeypatch):
    def _fake_post(url, json, headers, timeout):
        return _fake_response(200, json={"unexpected": "shape"})

    monkeypatch.setattr(httpx, "post", _fake_post)
    draft, error = ai_text.generate_draft(_openai_config(), "", "write something")
    assert draft is None
    assert "Unexpected response shape" in error
