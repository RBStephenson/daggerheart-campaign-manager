"""User roles."""

from typing import Literal, get_args

Role = Literal["host", "gm", "player"]
ROLES: frozenset[str] = frozenset(get_args(Role))
