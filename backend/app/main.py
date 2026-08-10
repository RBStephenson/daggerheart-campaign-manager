"""FastAPI application factory."""

import logging
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.db import SessionLocal
from app.models import User
from app.routers import (
    auth,
    bestiary,
    campaigns,
    chat,
    combat,
    database,
    health,
    library,
    player,
    session_plans,
    settings,
    srd,
    ws,
)
from app.security import hash_password

logger = logging.getLogger(__name__)


def _bootstrap_gm_user() -> None:
    """Create the initial GM account from env vars if none exists yet."""
    username = os.environ.get("DHCM_GM_USERNAME")
    password = os.environ.get("DHCM_GM_PASSWORD")
    if not username or not password:
        logger.warning(
            "DHCM_GM_USERNAME / DHCM_GM_PASSWORD not set — skipping GM account bootstrap"
        )
        return
    db = SessionLocal()
    try:
        if db.scalar(select(User).where(User.role == "gm")) is not None:
            return
        db.add(
            User(
                username=username,
                password_hash=hash_password(password),
                role="gm",
                created_at=datetime.now(UTC),
            )
        )
        db.commit()
    finally:
        db.close()


def _bootstrap_player_user() -> None:
    """Create a test player account from env vars if that username doesn't
    exist yet. Unlike the GM bootstrap (singleton — skip if any GM exists),
    this checks for the specific username, since real players are created
    via the invite/register flow and shouldn't collide with this test one."""
    username = os.environ.get("DHCM_PLAYER_USERNAME")
    password = os.environ.get("DHCM_PLAYER_PASSWORD")
    if not username or not password:
        logger.warning(
            "DHCM_PLAYER_USERNAME / DHCM_PLAYER_PASSWORD not set — "
            "skipping player account bootstrap"
        )
        return
    db = SessionLocal()
    try:
        if db.scalar(select(User).where(User.username == username)) is not None:
            return
        db.add(
            User(
                username=username,
                password_hash=hash_password(password),
                role="player",
                created_at=datetime.now(UTC),
            )
        )
        db.commit()
    finally:
        db.close()


@asynccontextmanager
async def _lifespan(app: FastAPI) -> AsyncIterator[None]:
    _bootstrap_gm_user()
    _bootstrap_player_user()
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="Daggerheart Campaign Manager", lifespan=_lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(settings.router)
    app.include_router(ws.router)
    app.include_router(campaigns.router)
    app.include_router(library.router)
    app.include_router(session_plans.router)
    app.include_router(chat.router)
    app.include_router(player.router)
    app.include_router(database.router)
    app.include_router(srd.router)
    app.include_router(bestiary.router)
    app.include_router(combat.fear_router)
    app.include_router(combat.countdown_router)
    return app


app = create_app()
