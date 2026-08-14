"""Encrypted-at-rest storage for AI API keys (DHCM-95).

Mirrors STL Studio's `app/services/secrets.py`. The Fernet key is resolved as:

  1. `DHCM_FERNET_KEY` env var, if set. Distinct from `DHCM_SECRET_KEY`
     (app/security.py), which signs session cookies -- unrelated purpose.
  2. Otherwise, an ephemeral key generated in memory for the life of the
     process. Nothing is persisted: without DHCM_FERNET_KEY set, keys
     encrypted now will not be decryptable after a restart.

DHCM-100 will add automatic generation-and-persistence of DHCM_FERNET_KEY to
the repo-root .env file; until it ships, an operator sets the env var by
hand, same as STL's current (non-DHCM-100) behavior.
"""
from __future__ import annotations

import logging
import os

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy.orm import Session

from app.models import AppSetting

_log = logging.getLogger(__name__)

_FERNET_KEY_ENV = "DHCM_FERNET_KEY"

_fernet: Fernet | None = None


def _load_or_create_key() -> bytes:
    env_key = os.environ.get(_FERNET_KEY_ENV)
    if env_key:
        return env_key.encode()

    _log.warning(
        "DHCM_FERNET_KEY is not set -- using an ephemeral in-memory encryption "
        "key for this process. AI API keys encrypted now will NOT be "
        "decryptable after a restart. Set DHCM_FERNET_KEY to persist them."
    )
    return Fernet.generate_key()


def _get_fernet() -> Fernet:
    global _fernet
    if _fernet is None:
        _fernet = Fernet(_load_or_create_key())
    return _fernet


def reset_cache() -> None:
    """Drop the cached Fernet -- used by tests that swap the key/env."""
    global _fernet
    _fernet = None


# --- Named AI API config keys ---------------------------------------------
# Each config's encrypted key is stored in app_settings under a per-ID row
# so deleting a config can cleanly remove its secret without affecting others.

def _config_key_setting(config_id: int) -> str:
    return f"ai_api_key_{config_id}_enc"


def set_ai_api_config_key(db: Session, config_id: int, raw_key: str) -> None:
    raw_key = raw_key.strip()
    setting_key = _config_key_setting(config_id)
    if not raw_key:
        clear_ai_api_config_key(db, config_id)
        return
    token = _get_fernet().encrypt(raw_key.encode()).decode()
    row = db.get(AppSetting, setting_key)
    if row is None:
        db.add(AppSetting(key=setting_key, value=token))
    else:
        row.value = token
    db.commit()


def get_ai_api_config_key(db: Session, config_id: int) -> str | None:
    row = db.get(AppSetting, _config_key_setting(config_id))
    if row is None:
        return None
    try:
        return _get_fernet().decrypt(row.value.encode()).decode()
    except InvalidToken:
        # Key material changed/lost -- treat as "no key set".
        return None


def clear_ai_api_config_key(db: Session, config_id: int) -> None:
    row = db.get(AppSetting, _config_key_setting(config_id))
    if row is not None:
        db.delete(row)
        db.commit()


def ai_api_config_key_hint(db: Session, config_id: int) -> str | None:
    key = get_ai_api_config_key(db, config_id)
    if not key:
        return None
    tail = key[-4:] if len(key) >= 4 else key
    return f"…{tail}"
