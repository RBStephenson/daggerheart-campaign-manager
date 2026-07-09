"""Room-based WebSocket connection manager."""

import logging
from collections import defaultdict
from typing import Any, Protocol

logger = logging.getLogger(__name__)


class SendsJSON(Protocol):
    async def send_json(self, data: Any) -> None: ...


class ConnectionManager:
    """Tracks connections per room and broadcasts/sends to them.

    Rooms are opaque string keys — for now typically a campaign session id
    (assigned by the feature that owns the room), but the manager itself
    has no opinion on what a room represents.
    """

    def __init__(self) -> None:
        self._rooms: dict[str, set[SendsJSON]] = defaultdict(set)

    def join(self, room: str, connection: SendsJSON) -> None:
        self._rooms[room].add(connection)

    def leave(self, room: str, connection: SendsJSON) -> None:
        self._rooms[room].discard(connection)
        if not self._rooms[room]:
            del self._rooms[room]

    def room_size(self, room: str) -> int:
        return len(self._rooms.get(room, set()))

    async def send_personal(self, connection: SendsJSON, message: dict[str, Any]) -> None:
        await connection.send_json(message)

    async def broadcast(
        self, room: str, message: dict[str, Any], *, exclude: SendsJSON | None = None
    ) -> None:
        dead: list[SendsJSON] = []
        for connection in list(self._rooms.get(room, set())):
            if connection is exclude:
                continue
            try:
                await connection.send_json(message)
            except Exception:
                logger.exception("Failed to send to a connection in room %s", room)
                dead.append(connection)
        for connection in dead:
            self.leave(room, connection)


manager = ConnectionManager()
