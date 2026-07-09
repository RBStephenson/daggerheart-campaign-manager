"""Read-only SRD reference data for the character-creation wizard.

Serves the canonical dataset (`app.services.srd`) to the frontend so the wizard
and the backend share a single source of truth. Gated by
`character_creation_enabled` (404 when off) and requires an authenticated user.
"""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_user
from app.routers.settings import get_settings
from app.services import srd


def _require_character_creation_enabled(db: Annotated[Session, Depends(get_db)]) -> None:
    if not get_settings(db).get("character_creation_enabled", False):
        raise HTTPException(status_code=404)


router = APIRouter(
    prefix="/api/srd",
    tags=["srd"],
    dependencies=[Depends(_require_character_creation_enabled), Depends(require_user)],
)


@router.get("/character-creation")
def character_creation_data() -> dict[str, Any]:
    """Return the full SRD character-creation dataset."""
    return srd.get_dataset()
