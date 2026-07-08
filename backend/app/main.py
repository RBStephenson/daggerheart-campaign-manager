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
from app.routers import auth, health, settings
from app.security import hash_password

logger = logging.getLogger(__name__)


def _bootstrap_host_user() -> None:
    """Create the initial host account from env vars if none exists yet."""
    username = os.environ.get("DHCM_HOST_USERNAME")
    password = os.environ.get("DHCM_HOST_PASSWORD")
    if not username or not password:
        logger.warning(
            "DHCM_HOST_USERNAME / DHCM_HOST_PASSWORD not set — skipping host account bootstrap"
        )
        return
    db = SessionLocal()
    try:
        if db.scalar(select(User).where(User.role == "host")) is not None:
            return
        db.add(
            User(
                username=username,
                password_hash=hash_password(password),
                role="host",
                created_at=datetime.now(UTC),
            )
        )
        db.commit()
    finally:
        db.close()


@asynccontextmanager
async def _lifespan(app: FastAPI) -> AsyncIterator[None]:
    _bootstrap_host_user()
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
    return app


app = create_app()
