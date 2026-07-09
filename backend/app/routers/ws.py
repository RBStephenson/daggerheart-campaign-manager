"""Single WebSocket endpoint, room-scoped, gated by realtime_enabled."""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user_ws
from app.models import User
from app.routers.chat import is_chat_enabled, record_chat_message
from app.routers.settings import get_settings
from app.schemas.chat import ChatSendPayload
from app.ws.manager import manager
from app.ws.messages import Envelope

router = APIRouter(tags=["ws"])
logger = logging.getLogger(__name__)


@router.websocket("/ws/{room}")
async def websocket_endpoint(
    websocket: WebSocket, room: str, db: Annotated[Session, Depends(get_db)]
) -> None:
    if not get_settings(db).get("realtime_enabled", False):
        await websocket.close(code=1008)
        return

    user: User | None = get_current_user_ws(websocket, db)
    if user is None:
        await websocket.close(code=1008)
        return

    await websocket.accept()
    manager.join(room, websocket)
    try:
        while True:
            raw = await websocket.receive_json()
            try:
                envelope = Envelope.model_validate(raw)
            except ValidationError:
                continue
            if envelope.type == "ping":
                await manager.send_personal(websocket, {"type": "pong", "payload": {}})
                continue
            if envelope.type == "chat":
                if not is_chat_enabled(db):
                    continue
                try:
                    chat_payload = ChatSendPayload.model_validate(envelope.payload)
                except ValidationError:
                    continue
                message = record_chat_message(db, room=room, author=user, body=chat_payload.body)
                await manager.broadcast(
                    room, {"type": "chat", "payload": message.model_dump(mode="json")}
                )
                continue
            await manager.broadcast(room, envelope.model_dump(), exclude=websocket)
    except WebSocketDisconnect:
        pass
    finally:
        manager.leave(room, websocket)
