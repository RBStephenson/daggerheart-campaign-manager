"""AI text draft generation (DHCM-96): call a configured AiApiConfig and
return a plain draft string. Advisory only -- callers never auto-save the
result, a GM confirms it before it lands anywhere.

Dual transport, mirroring STL Studio's ai_organize.py: the Anthropic SDK for
"anthropic" configs, a plain OpenAI-compatible /v1/chat/completions call via
httpx for "openai" configs (e.g. Ollama). Unlike ai_organize.py, there is no
JSON-suggestion parsing here -- the model's raw text response IS the draft.

Failures never raise -- they return (None, detail) so the router can surface
a clean error to the frontend instead of a stack trace.
"""
from __future__ import annotations

import logging
import time
from typing import Any

import httpx
from anthropic import Anthropic

from app.models import AiApiConfig

_log = logging.getLogger(__name__)

_DEFAULT_MAX_TOKENS = 2000
_EFFORT_THINKING_BUDGET = {"low": 0, "medium": 2000, "high": 8000}


def _text_from_anthropic(resp: Any) -> str:
    parts = []
    for block in getattr(resp, "content", []) or []:
        if getattr(block, "type", None) == "text":
            parts.append(getattr(block, "text", ""))
    return "".join(parts).strip()


def _generate_anthropic(
    config: AiApiConfig, api_key: str, prompt: str
) -> tuple[str | None, str | None]:
    if not api_key:
        return None, "No API key configured for this connection."

    t0 = time.monotonic()
    try:
        client = Anthropic(api_key=api_key, timeout=float(config.request_timeout))
        kwargs: dict[str, Any] = {
            "model": config.model,
            "max_tokens": _DEFAULT_MAX_TOKENS,
            "messages": [{"role": "user", "content": prompt}],
        }
        budget = _EFFORT_THINKING_BUDGET.get(config.effort or "low", 0)
        if budget:
            kwargs["thinking"] = {"type": "enabled", "budget_tokens": budget}
            kwargs["max_tokens"] = _DEFAULT_MAX_TOKENS + budget
        resp = client.messages.create(**kwargs)
    except Exception as exc:  # anthropic.APIError, auth, timeout, etc.
        detail = f"{exc.__class__.__name__}: {exc}".strip().rstrip(":")
        _log.warning("ai_text llm_error source=Anthropic reason=%s", detail)
        return None, detail

    _log.info("ai_text llm_response elapsed_s=%.1f", time.monotonic() - t0)
    draft = _text_from_anthropic(resp)
    if not draft:
        stop_reason = getattr(resp, "stop_reason", None)
        return None, f"Empty response from Anthropic API (stop_reason={stop_reason!r})"
    return draft, None


def _generate_openai(
    config: AiApiConfig, api_key: str, prompt: str
) -> tuple[str | None, str | None]:
    if not config.url:
        return None, "No endpoint URL configured for this connection."

    base_url = config.url.rstrip("/")
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    payload: dict[str, Any] = {
        "model": config.model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.7,
        "max_tokens": _DEFAULT_MAX_TOKENS,
    }
    if not config.reasoning_enabled:
        # See STL Studio's ai_organize.py for why: a thinking-capable local
        # model can otherwise spend its whole budget on hidden reasoning and
        # return empty content. Ignored by servers/models that don't
        # recognize either field.
        payload["think"] = False
        payload["reasoning_effort"] = "none"

    endpoint = f"{base_url}/v1/chat/completions"
    t0 = time.monotonic()
    try:
        resp = httpx.post(
            endpoint, json=payload, headers=headers, timeout=float(config.request_timeout)
        )
        resp.raise_for_status()
    except httpx.TimeoutException:
        detail = (
            f"Timed out after {config.request_timeout}s calling {endpoint} -- the "
            f"model may be cold-starting; raise this API's timeout in Settings."
        )
        _log.warning("ai_text llm_error endpoint=%r reason=%s", endpoint, detail)
        return None, detail
    except httpx.HTTPError as exc:
        detail = f"{exc.__class__.__name__}: {exc}".strip().rstrip(":")
        _log.warning("ai_text llm_error endpoint=%r reason=%s", endpoint, detail)
        return None, detail

    _log.info("ai_text llm_response elapsed_s=%.1f", time.monotonic() - t0)
    try:
        data = resp.json()
        draft = data["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError, ValueError) as exc:
        detail = f"Unexpected response shape from {endpoint}: {exc}"
        _log.warning("ai_text llm_error %s", detail)
        return None, detail

    if not draft:
        return None, f"Empty response from {endpoint}"
    return draft, None


def generate_draft(config: AiApiConfig, api_key: str, prompt: str) -> tuple[str | None, str | None]:
    """Returns (draft, error) -- exactly one is non-None."""
    if config.api_type == "anthropic":
        return _generate_anthropic(config, api_key, prompt)
    return _generate_openai(config, api_key, prompt)
