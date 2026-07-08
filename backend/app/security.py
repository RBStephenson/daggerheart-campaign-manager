"""Password hashing and signed session tokens."""

import os
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from itsdangerous import BadSignature, URLSafeTimedSerializer

_hasher = PasswordHasher()

# Falls back to a random per-process secret when unset: sessions simply
# invalidate on restart rather than silently using a shared/hardcoded key.
_SECRET_KEY = os.environ.get("DHCM_SECRET_KEY") or secrets.token_hex(32)
_serializer = URLSafeTimedSerializer(_SECRET_KEY, salt="dhcm-session")

SESSION_COOKIE_NAME = "dhcm_session"
SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14  # 14 days


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except VerifyMismatchError:
        return False


def create_session_token(user_id: int) -> str:
    return _serializer.dumps({"user_id": user_id})


def read_session_token(token: str) -> int | None:
    try:
        data = _serializer.loads(token, max_age=SESSION_MAX_AGE_SECONDS)
    except BadSignature:
        return None
    user_id = data.get("user_id")
    return user_id if isinstance(user_id, int) else None


def generate_invite_token() -> str:
    return secrets.token_urlsafe(32)
