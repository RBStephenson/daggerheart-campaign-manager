"""Broadcast state changes to a campaign's active session room, if any.

Shared by any REST endpoint that mutates state a live GM/player view should
reflect (character sheets, Fear, countdowns) — a campaign with no active
session has nowhere to broadcast to, so this is a safe no-op in that case
rather than something callers need to check for themselves.
"""

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import GameSession
from app.ws.manager import manager


async def broadcast_to_campaign(campaign_id: int, db: Session, message: dict[str, Any]) -> None:
    session = db.scalar(
        select(GameSession).where(
            GameSession.campaign_id == campaign_id, GameSession.status == "active"
        )
    )
    if session is None:
        return
    await manager.broadcast(session.room, message)
