"""WebSocket message envelope."""

from typing import Any

from pydantic import BaseModel


class Envelope(BaseModel):
    """All WebSocket messages share this shape.

    `type` identifies the message kind; features built on top of the
    connection (chat, campaign events, ...) define their own `type` values
    and payload shapes.
    """

    type: str
    payload: dict[str, Any] = {}
