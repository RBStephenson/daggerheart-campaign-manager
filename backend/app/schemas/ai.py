"""AiApiConfig schemas (DHCM-95): named AI API endpoint configs for AI text
generation. Modeled directly on STL Studio's AiApiConfig schemas.

Encrypted keys are never returned -- only whether one is set and a masked hint.
"""

from datetime import datetime

from pydantic import BaseModel, Field


class AiApiConfigCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    api_type: str = Field(pattern="^(anthropic|openai)$")
    url: str | None = Field(default=None, max_length=500)
    model: str = Field(default="", max_length=200)
    effort: str | None = Field(default=None, pattern="^(low|medium|high)$")
    request_timeout: int = Field(default=10, ge=1, le=600)
    batch_size: int | None = Field(default=None, ge=1, le=50)
    reasoning_enabled: bool = False
    # Optional so a config can still be created key-less (e.g. a local model
    # with no auth), but lets the client set the key in the same request
    # instead of a follow-up call.
    api_key: str | None = Field(default=None, max_length=400)


class AiApiConfigUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    url: str | None = Field(default=None, max_length=500)
    model: str | None = Field(default=None, max_length=200)
    effort: str | None = Field(default=None, pattern="^(low|medium|high)$")
    request_timeout: int | None = Field(default=None, ge=1, le=600)
    batch_size: int | None = Field(default=None, ge=1, le=50)
    reasoning_enabled: bool | None = None
    api_key: str | None = Field(default=None, max_length=400)

    model_config = {"extra": "forbid"}


class AiApiConfigOut(BaseModel):
    id: int
    name: str
    api_type: str
    url: str | None
    model: str
    effort: str | None
    request_timeout: int
    batch_size: int | None
    reasoning_enabled: bool
    key_set: bool
    key_hint: str | None
    created_at: datetime
