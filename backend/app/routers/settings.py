"""App settings key/value store.

Settings (including feature flags) live in the `app_settings` table as
JSON-encoded values. DEFAULTS defines every known setting and its default;
unknown keys are rejected on write.
"""

import json
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_role
from app.models import AppSetting, User

router = APIRouter(tags=["settings"])

# Every known setting and its default. Feature flags are named
# `<feature>_enabled` and default to False.
DEFAULTS: dict[str, Any] = {
    "realtime_enabled": False,
    "campaigns_enabled": False,
    "chat_enabled": False,
}


def get_settings(db: Session) -> dict[str, Any]:
    """Return all settings: defaults overlaid with stored values."""
    settings = dict(DEFAULTS)
    for row in db.scalars(select(AppSetting)):
        if row.key in DEFAULTS:
            settings[row.key] = json.loads(row.value)
    return settings


@router.get("/api/settings")
def read_settings(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_role("host"))],
) -> dict[str, Any]:
    return get_settings(db)


@router.put("/api/settings")
def update_settings(
    updates: dict[str, Any],
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_role("host"))],
) -> dict[str, Any]:
    unknown = set(updates) - set(DEFAULTS)
    if unknown:
        raise HTTPException(status_code=422, detail=f"Unknown settings: {sorted(unknown)}")
    for key, value in updates.items():
        row = db.get(AppSetting, key)
        if row is None:
            db.add(AppSetting(key=key, value=json.dumps(value)))
        else:
            row.value = json.dumps(value)
    db.commit()
    return get_settings(db)
