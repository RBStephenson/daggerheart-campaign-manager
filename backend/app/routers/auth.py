"""Login, logout, current-user, and invite endpoints."""

import os
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user, require_role
from app.models import Invite, User
from app.roles import ROLES
from app.schemas.auth import (
    InviteCreateRequest,
    InviteOut,
    LoginRequest,
    RegisterRequest,
    UserOut,
)
from app.security import (
    SESSION_COOKIE_NAME,
    SESSION_MAX_AGE_SECONDS,
    create_session_token,
    generate_invite_token,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

_COOKIE_SECURE = os.environ.get("DHCM_COOKIE_SECURE", "false").lower() == "true"


def _set_session_cookie(response: Response, user_id: int) -> None:
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=create_session_token(user_id),
        max_age=SESSION_MAX_AGE_SECONDS,
        httponly=True,
        samesite="lax",
        secure=_COOKIE_SECURE,
    )


@router.post("/login", response_model=UserOut)
def login(
    body: LoginRequest, response: Response, db: Annotated[Session, Depends(get_db)]
) -> User:
    user = db.scalar(select(User).where(User.username == body.username))
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    _set_session_cookie(response, user.id)
    return user


@router.post("/logout", status_code=204)
def logout(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE_NAME)


@router.get("/me", response_model=UserOut | None)
def me(user: Annotated[User | None, Depends(get_current_user)]) -> User | None:
    return user


@router.post("/register", response_model=UserOut)
def register(
    body: RegisterRequest, response: Response, db: Annotated[Session, Depends(get_db)]
) -> User:
    invite = db.scalar(select(Invite).where(Invite.token == body.token))
    if invite is None or invite.used_at is not None:
        raise HTTPException(status_code=400, detail="Invalid or already-used invite")
    if db.scalar(select(User).where(User.username == body.username)) is not None:
        raise HTTPException(status_code=409, detail="Username already taken")

    user = User(
        username=body.username,
        password_hash=hash_password(body.password),
        role=invite.role,
        created_at=datetime.now(UTC),
    )
    db.add(user)
    invite.used_at = datetime.now(UTC)
    db.commit()
    db.refresh(user)
    _set_session_cookie(response, user.id)
    return user


@router.post("/invites", response_model=InviteOut)
def create_invite(
    body: InviteCreateRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_role("host", "gm"))],
) -> Invite:
    if body.role not in ROLES:
        raise HTTPException(status_code=422, detail=f"Unknown role: {body.role}")
    if current_user.role == "gm" and body.role != "player":
        raise HTTPException(status_code=403, detail="GMs may only invite players")

    invite = Invite(
        token=generate_invite_token(),
        role=body.role,
        created_by_user_id=current_user.id,
        created_at=datetime.now(UTC),
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)
    return invite
