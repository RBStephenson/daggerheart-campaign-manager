"""User roles."""

from typing import Literal, get_args

Role = Literal["gm", "player"]
ROLES: frozenset[str] = frozenset(get_args(Role))
