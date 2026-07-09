"""Chat message schemas."""

from datetime import datetime

from pydantic import BaseModel, Field


class ChatMessageOut(BaseModel):
    id: int
    room: str
    author_user_id: int
    author_username: str
    body: str
    created_at: datetime


class ChatSendPayload(BaseModel):
    """Payload shape for a `type: "chat"` WebSocket envelope."""

    body: str = Field(min_length=1, max_length=2000)
