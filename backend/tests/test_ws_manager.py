from typing import Any

from app.ws.manager import ConnectionManager


class FakeConnection:
    def __init__(self, *, fails: bool = False) -> None:
        self.sent: list[dict[str, Any]] = []
        self.fails = fails

    async def send_json(self, data: dict[str, Any]) -> None:
        if self.fails:
            raise RuntimeError("boom")
        self.sent.append(data)


async def test_join_and_room_size() -> None:
    manager = ConnectionManager()
    conn = FakeConnection()
    manager.join("room1", conn)
    assert manager.room_size("room1") == 1


async def test_leave_empties_room() -> None:
    manager = ConnectionManager()
    conn = FakeConnection()
    manager.join("room1", conn)
    manager.leave("room1", conn)
    assert manager.room_size("room1") == 0


async def test_leave_unknown_connection_is_noop() -> None:
    manager = ConnectionManager()
    manager.leave("room1", FakeConnection())
    assert manager.room_size("room1") == 0


async def test_broadcast_reaches_all_room_members() -> None:
    manager = ConnectionManager()
    a, b = FakeConnection(), FakeConnection()
    manager.join("room1", a)
    manager.join("room1", b)

    await manager.broadcast("room1", {"type": "hello"})

    assert a.sent == [{"type": "hello"}]
    assert b.sent == [{"type": "hello"}]


async def test_broadcast_excludes_sender() -> None:
    manager = ConnectionManager()
    sender, other = FakeConnection(), FakeConnection()
    manager.join("room1", sender)
    manager.join("room1", other)

    await manager.broadcast("room1", {"type": "hello"}, exclude=sender)

    assert sender.sent == []
    assert other.sent == [{"type": "hello"}]


async def test_broadcast_does_not_cross_rooms() -> None:
    manager = ConnectionManager()
    in_room, other_room = FakeConnection(), FakeConnection()
    manager.join("room1", in_room)
    manager.join("room2", other_room)

    await manager.broadcast("room1", {"type": "hello"})

    assert in_room.sent == [{"type": "hello"}]
    assert other_room.sent == []


async def test_broadcast_drops_dead_connections() -> None:
    manager = ConnectionManager()
    dead = FakeConnection(fails=True)
    manager.join("room1", dead)

    await manager.broadcast("room1", {"type": "hello"})

    assert manager.room_size("room1") == 0


async def test_send_personal() -> None:
    manager = ConnectionManager()
    conn = FakeConnection()
    await manager.send_personal(conn, {"type": "pong"})
    assert conn.sent == [{"type": "pong"}]
