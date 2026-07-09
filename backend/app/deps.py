"""Auth dependencies: current user resolution and role gating."""

from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, HTTPException, Request, WebSocket
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User
from app.security import SESSION_COOKIE_NAME, read_session_token


def _resolve_user(token: str | None, db: Session) -> User | None:
    if not token:
        return None
    user_id = read_session_token(token)
    if user_id is None:
        return None
    return db.get(User, user_id)


def get_current_user(
    request: Request, db: Annotated[Session, Depends(get_db)]
) -> User | None:
    return _resolve_user(request.cookies.get(SESSION_COOKIE_NAME), db)


def get_current_user_ws(websocket: WebSocket, db: Session) -> User | None:
    return _resolve_user(websocket.cookies.get(SESSION_COOKIE_NAME), db)


def require_user(
    user: Annotated[User | None, Depends(get_current_user)],
) -> User:
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


def require_role(*roles: str) -> Callable[[User], User]:
    """Require one of `roles`. "host" always passes — it's the superuser role."""

    def dependency(user: Annotated[User, Depends(require_user)]) -> User:
        if user.role != "host" and user.role not in roles:
            raise HTTPException(status_code=403, detail="Forbidden")
        return user

    return dependency
