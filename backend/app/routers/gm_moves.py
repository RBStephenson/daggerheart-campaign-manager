"""Read-only SRD GM-moves reference data (DHCM-65/DHCM-92).

Serves the canonical dataset (`app.services.gm_moves`) for the "spend a
Fear" reference popover (DHCM-93) -- reference only, never automated,
matching the epic's explicit scope. Gated by `combat_tools_enabled` and
requires an authenticated GM, mirroring `app.routers.bestiary`'s pattern.
"""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_role
from app.routers.settings import get_settings
from app.services import gm_moves


def _require_combat_tools_enabled(db: Annotated[Session, Depends(get_db)]) -> None:
    if not get_settings(db).get("combat_tools_enabled", False):
        raise HTTPException(status_code=404)


router = APIRouter(
    prefix="/api/gm-moves",
    tags=["gm-moves"],
    dependencies=[Depends(_require_combat_tools_enabled), Depends(require_role("gm"))],
)


@router.get("/")
def gm_moves_data() -> dict[str, Any]:
    """Return the full SRD GM-moves reference dataset."""
    return gm_moves.get_dataset()
