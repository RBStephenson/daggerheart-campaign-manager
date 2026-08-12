"""Quick-generate endpoint for GM live play (names, NPC sketches, loot).

Gated by `generators_enabled` (404 when off) and requires an authenticated
GM, matching `app.routers.bestiary`'s pattern. Stateless: every call returns
a fresh suggestion, nothing is persisted here.
"""

from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_role
from app.routers.settings import get_settings
from app.services import generators


def _require_generators_enabled(db: Annotated[Session, Depends(get_db)]) -> None:
    if not get_settings(db).get("generators_enabled", False):
        raise HTTPException(status_code=404)


router = APIRouter(
    prefix="/api/gm/generate",
    tags=["generators"],
    dependencies=[Depends(_require_generators_enabled), Depends(require_role("gm"))],
)

Kind = Literal["name", "npc", "loot"]


@router.get("/{kind}")
def generate(
    kind: Kind, ancestry: str | None = None, party_tier: int | None = None
) -> dict[str, Any]:
    if kind == "name":
        return generators.generate_name(ancestry=ancestry)
    if kind == "npc":
        return generators.generate_npc_sketch()
    return generators.generate_loot(party_tier=party_tier)
