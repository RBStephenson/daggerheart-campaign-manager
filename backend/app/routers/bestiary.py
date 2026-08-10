"""Read-only SRD bestiary reference data (adversary + environment stat blocks).

Serves the canonical dataset (`app.services.bestiary`) to the GM-facing
reference browser. Gated by `combat_tools_enabled` (404 when off) and
requires an authenticated GM, matching `app.routers.srd`'s pattern.
"""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_role
from app.routers.settings import get_settings
from app.services import bestiary


def _require_combat_tools_enabled(db: Annotated[Session, Depends(get_db)]) -> None:
    if not get_settings(db).get("combat_tools_enabled", False):
        raise HTTPException(status_code=404)


router = APIRouter(
    prefix="/api/bestiary",
    tags=["bestiary"],
    dependencies=[Depends(_require_combat_tools_enabled), Depends(require_role("gm"))],
)


@router.get("/")
def bestiary_data() -> dict[str, Any]:
    """Return the full SRD bestiary dataset (adversaries + environments)."""
    return bestiary.get_dataset()
