"""Encrypted-at-rest storage for AI API keys (DHCM-95).

Mirrors STL Studio's `app/services/secrets.py`. The Fernet key is resolved as:

  1. `DHCM_FERNET_KEY` env var, if set. Distinct from `DHCM_SECRET_KEY`
     (app/security.py), which signs session cookies -- unrelated purpose.
  2. Otherwise, an ephemeral key generated in memory for the life of the
     process. Nothing is persisted: without DHCM_FERNET_KEY set, keys
     encrypted now will not be decryptable after a restart.

DHCM-100: unlike STL (which requires an operator to generate and paste the
key in by hand -- deliberately, after an earlier STL version's `.secret_key`
file leaked into version control), DHCM auto-generates and persists the key
to the gitignored repo-root `.env` file via `ensure_fernet_key()` once a GM
account exists. See that function for the full policy.
"""
from __future__ import annotations

import logging
import os
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AppSetting, User

_log = logging.getLogger(__name__)

_FERNET_KEY_ENV = "DHCM_FERNET_KEY"
_ENV_FILE_OVERRIDE_VAR = "DHCM_ENV_FILE"

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


def _env_file_path() -> Path:
    # Locally, __file__ resolves to backend/app/services/secrets.py, so
    # parents[3] is the repo root where .env actually lives. In Docker only
    # ./backend is mounted (as /app), so DHCM_ENV_FILE is set explicitly in
    # docker-compose.yml to wherever the repo-root .env is bind-mounted --
    # the override always wins.
    override = os.environ.get(_ENV_FILE_OVERRIDE_VAR)
    if override:
        return Path(override)
    return Path(__file__).resolve().parents[3] / ".env"


def _persist_key_to_env_file(key: str) -> None:
    path = _env_file_path()
    existing = path.read_text(encoding="utf-8") if path.exists() else ""
    if f"{_FERNET_KEY_ENV}=" in existing:
        # Already persisted by an earlier boot -- never overwrite a key
        # that may already have encrypted data at rest under it.
        return
    if existing and not existing.endswith("\n"):
        existing += "\n"
    path.write_text(f"{existing}{_FERNET_KEY_ENV}={key}\n", encoding="utf-8")


def ensure_fernet_key(db: Session) -> None:
    """Generate and persist DHCM_FERNET_KEY on first boot, once a GM account
    exists. Called from both the env-var GM bootstrap path (main.py) and the
    first-run GM setup endpoint (DHCM-101) -- the "does a GM exist yet" guard
    lives here rather than in each caller so both paths get it for free.

    No-op if the env var is already set (an operator set it by hand, or a
    prior boot already persisted one -- reused, never regenerated) or if no
    GM account exists yet (key generation must not fire prematurely).
    """
    if os.environ.get(_FERNET_KEY_ENV):
        return
    if db.scalar(select(User).where(User.role == "gm")) is None:
        return
    key = Fernet.generate_key().decode()
    _persist_key_to_env_file(key)
    os.environ[_FERNET_KEY_ENV] = key
    reset_cache()


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
