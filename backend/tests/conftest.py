from collections.abc import Generator
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import get_db
from app.deps import get_current_user
from app.main import create_app
from app.models import Base, User
from app.security import hash_password


@pytest.fixture()
def db() -> Generator[Session, None, None]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(bind=engine, expire_on_commit=False)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db: Session) -> Generator[TestClient, None, None]:
    app = create_app()
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as c:
        yield c


def make_user(db: Session, *, username: str, role: str, password: str = "correct-horse") -> User:
    user = User(
        username=username,
        password_hash=hash_password(password),
        role=role,
        created_at=datetime.now(UTC),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture()
def as_user(client: TestClient, db: Session):
    """Override auth to act as a persisted user of the given role."""

    def _as_user(role: str, *, username: str = "test-user") -> TestClient:
        user = make_user(db, username=username, role=role)
        client.app.dependency_overrides[get_current_user] = lambda: user
        return client

    return _as_user
