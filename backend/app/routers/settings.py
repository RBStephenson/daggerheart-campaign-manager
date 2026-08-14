"""App settings key/value store.

Settings (including feature flags) live in the `app_settings` table as
JSON-encoded values. DEFAULTS defines every known setting and its default;
unknown keys are rejected on write.
"""

import json
from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_role
from app.models import AiApiConfig, AppSetting, User
from app.schemas.ai import AiApiConfigCreate, AiApiConfigOut, AiApiConfigUpdate
from app.services import secrets

router = APIRouter(tags=["settings"])

# Every known setting and its default. Feature flags are named
# `<feature>_enabled` and default to False.
DEFAULTS: dict[str, Any] = {
    "realtime_enabled": False,
    "campaigns_enabled": False,
    "chat_enabled": False,
    "player_area_enabled": False,
    "data_management_enabled": False,
    "character_creation_enabled": False,
    "library_enabled": False,
    "session_planning_enabled": False,
    "character_sheet_enabled": False,
    "downtime_enabled": False,
    "combat_tools_enabled": False,
    "generators_enabled": False,
    "custom_content_enabled": False,
    "ai_text_enabled": False,
    # Selected AiApiConfig.id, or None if unset/not yet configured.
    "ai_text_api": None,
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
    _user: Annotated[User, Depends(require_role("gm"))],
) -> dict[str, Any]:
    return get_settings(db)


@router.put("/api/settings")
def update_settings(
    updates: dict[str, Any],
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_role("gm"))],
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


# --- Named AI API configs (DHCM-95) ----------------------------------------

def _config_to_out(db: Session, c: AiApiConfig) -> AiApiConfigOut:
    hint = secrets.ai_api_config_key_hint(db, c.id)
    return AiApiConfigOut(
        id=c.id,
        name=c.name,
        api_type=c.api_type,
        url=c.url,
        model=c.model,
        effort=c.effort,
        request_timeout=c.request_timeout,
        batch_size=c.batch_size,
        reasoning_enabled=c.reasoning_enabled,
        key_set=hint is not None,
        key_hint=hint,
        created_at=c.created_at,
    )


@router.get("/api/settings/ai-apis", response_model=list[AiApiConfigOut])
def list_ai_api_configs(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_role("gm"))],
) -> list[AiApiConfigOut]:
    configs = db.scalars(select(AiApiConfig).order_by(AiApiConfig.created_at)).all()
    return [_config_to_out(db, c) for c in configs]


@router.post("/api/settings/ai-apis", response_model=AiApiConfigOut, status_code=201)
def create_ai_api_config(
    body: AiApiConfigCreate,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_role("gm"))],
) -> AiApiConfigOut:
    c = AiApiConfig(
        name=body.name,
        api_type=body.api_type,
        url=body.url,
        model=body.model,
        effort=body.effort,
        request_timeout=body.request_timeout,
        batch_size=body.batch_size,
        reasoning_enabled=body.reasoning_enabled,
        created_at=datetime.now(UTC),
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    if body.api_key:
        secrets.set_ai_api_config_key(db, c.id, body.api_key)
    return _config_to_out(db, c)


@router.patch("/api/settings/ai-apis/{config_id}", response_model=AiApiConfigOut)
def update_ai_api_config(
    config_id: int,
    body: AiApiConfigUpdate,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_role("gm"))],
) -> AiApiConfigOut:
    c = db.get(AiApiConfig, config_id)
    if c is None:
        raise HTTPException(status_code=404, detail="Config not found")
    updates = body.model_dump(exclude_unset=True)
    api_key = updates.pop("api_key", None)
    for field, value in updates.items():
        setattr(c, field, value)
    if api_key:
        secrets.set_ai_api_config_key(db, config_id, api_key)
    db.commit()
    db.refresh(c)
    return _config_to_out(db, c)


@router.delete("/api/settings/ai-apis/{config_id}", status_code=204)
def delete_ai_api_config(
    config_id: int,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_role("gm"))],
) -> None:
    c = db.get(AiApiConfig, config_id)
    if c is None:
        raise HTTPException(status_code=404, detail="Config not found")
    secrets.clear_ai_api_config_key(db, config_id)
    db.delete(c)
    db.commit()
