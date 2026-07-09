"""Chat history endpoint and message persistence. Gated by chat_enabled."""

from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_user
from app.models import ChatMessage, User
from app.routers.settings import get_settings
from app.schemas.chat import ChatMessageOut


def _require_chat_enabled(db: Annotated[Session, Depends(get_db)]) -> None:
    if not get_settings(db).get("chat_enabled", False):
        raise HTTPException(status_code=404)


router = APIRouter(prefix="/api/chat", tags=["chat"], dependencies=[Depends(_require_chat_enabled)])

HISTORY_PAGE_SIZE = 50


def _to_out(message: ChatMessage, username: str) -> ChatMessageOut:
    return ChatMessageOut(
        id=message.id,
        room=message.room,
        author_user_id=message.author_user_id,
        author_username=username,
        body=message.body,
        created_at=message.created_at,
    )


def record_chat_message(db: Session, *, room: str, author: User, body: str) -> ChatMessageOut:
    """Persist a chat message and return it in broadcast/API shape."""
    message = ChatMessage(
        room=room, author_user_id=author.id, body=body, created_at=datetime.now(UTC)
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return _to_out(message, author.username)


def is_chat_enabled(db: Session) -> bool:
    return bool(get_settings(db).get("chat_enabled", False))


@router.get("/{room}/messages", response_model=list[ChatMessageOut])
def get_history(
    room: str,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_user)],
    before: Annotated[int | None, Query()] = None,
    limit: Annotated[int, Query(le=HISTORY_PAGE_SIZE)] = HISTORY_PAGE_SIZE,
) -> list[ChatMessageOut]:
    stmt = (
        select(ChatMessage, User.username)
        .join(User, ChatMessage.author_user_id == User.id)
        .where(ChatMessage.room == room)
    )
    if before is not None:
        stmt = stmt.where(ChatMessage.id < before)
    stmt = stmt.order_by(ChatMessage.id.desc()).limit(limit)

    rows: list[Any] = list(db.execute(stmt).all())
    return [_to_out(message, username) for message, username in reversed(rows)]
