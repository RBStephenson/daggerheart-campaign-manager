"""Player area: characters, joined campaigns, notes. Gated by player_area_enabled."""

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_role
from app.models import Campaign, CampaignMembership, CampaignNote, Character, User
from app.routers.settings import get_settings
from app.schemas.character_rest import RestRequest, apply_rest
from app.schemas.character_sheet import validate_extra
from app.schemas.character_state import CharacterStateUpdate, validate_state_update
from app.schemas.player import (
    CharacterCreate,
    CharacterOut,
    CharacterUpdate,
    MemberCampaignOut,
    NoteOut,
    NoteUpdate,
    RestResponse,
)


def _require_player_area_enabled(db: Annotated[Session, Depends(get_db)]) -> None:
    if not get_settings(db).get("player_area_enabled", False):
        raise HTTPException(status_code=404)


def _require_character_sheet_enabled(db: Annotated[Session, Depends(get_db)]) -> None:
    if not get_settings(db).get("character_sheet_enabled", False):
        raise HTTPException(status_code=404)


def _require_downtime_enabled(db: Annotated[Session, Depends(get_db)]) -> None:
    if not get_settings(db).get("downtime_enabled", False):
        raise HTTPException(status_code=404)


def _validate_extra_or_422(extra: str | None) -> None:
    """Validate a populated `extra` sheet, translating failures to HTTP 422."""
    try:
        validate_extra(extra)
    except (ValidationError, ValueError) as e:
        raise HTTPException(status_code=422, detail=f"Invalid character sheet: {e}") from e


router = APIRouter(
    prefix="/api/player",
    tags=["player"],
    dependencies=[Depends(_require_player_area_enabled)],
)


def _require_membership(campaign_id: int, db: Session, player: User) -> None:
    member = db.scalar(
        select(CampaignMembership).where(
            CampaignMembership.campaign_id == campaign_id,
            CampaignMembership.player_user_id == player.id,
        )
    )
    if member is None:
        raise HTTPException(status_code=404, detail="Campaign not found")


def _get_owned_character(character_id: int, db: Session, player: User) -> Character:
    character = db.get(Character, character_id)
    if character is None or character.player_user_id != player.id:
        raise HTTPException(status_code=404, detail="Character not found")
    return character


@router.get("/campaigns", response_model=list[MemberCampaignOut])
def list_my_campaigns(
    db: Annotated[Session, Depends(get_db)],
    player: Annotated[User, Depends(require_role("player"))],
) -> list[Campaign]:
    return list(
        db.scalars(
            select(Campaign)
            .join(CampaignMembership, CampaignMembership.campaign_id == Campaign.id)
            .where(CampaignMembership.player_user_id == player.id)
        )
    )


@router.get("/characters", response_model=list[CharacterOut])
def list_my_characters(
    db: Annotated[Session, Depends(get_db)],
    player: Annotated[User, Depends(require_role("player"))],
    campaign_id: int | None = None,
) -> list[Character]:
    stmt = select(Character).where(Character.player_user_id == player.id)
    if campaign_id is not None:
        stmt = stmt.where(Character.campaign_id == campaign_id)
    return list(db.scalars(stmt))


@router.post("/characters", response_model=CharacterOut)
def create_character(
    body: CharacterCreate,
    db: Annotated[Session, Depends(get_db)],
    player: Annotated[User, Depends(require_role("player"))],
) -> Character:
    _require_membership(body.campaign_id, db, player)
    _validate_extra_or_422(body.extra)
    character = Character(
        player_user_id=player.id,
        campaign_id=body.campaign_id,
        name=body.name,
        char_class=body.char_class,
        ancestry=body.ancestry,
        community=body.community,
        level=body.level,
        extra=body.extra,
        created_at=datetime.now(UTC),
    )
    db.add(character)
    db.commit()
    db.refresh(character)
    return character


@router.put("/characters/{character_id}", response_model=CharacterOut)
def update_character(
    character_id: int,
    body: CharacterUpdate,
    db: Annotated[Session, Depends(get_db)],
    player: Annotated[User, Depends(require_role("player"))],
) -> Character:
    character = _get_owned_character(character_id, db, player)
    updates = body.model_dump(exclude_unset=True)
    if "extra" in updates:
        _validate_extra_or_422(updates["extra"])
    for field, value in updates.items():
        setattr(character, field, value)
    db.commit()
    db.refresh(character)
    return character


@router.patch(
    "/characters/{character_id}/state",
    response_model=CharacterOut,
    dependencies=[Depends(_require_character_sheet_enabled)],
)
def update_character_state(
    character_id: int,
    body: CharacterStateUpdate,
    db: Annotated[Session, Depends(get_db)],
    player: Annotated[User, Depends(require_role("player"))],
) -> Character:
    """Mark/clear HP, Stress, Hope, and Armor Slots during play.

    Distinct from `PUT /characters/{id}`, which replaces the immutable
    creation-time sheet — this only ever touches mutable play state, bounds-
    checked against that sheet (see `app.schemas.character_state`).
    """
    character = _get_owned_character(character_id, db, player)
    try:
        validate_state_update(character.extra, body)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(character, field, value)
    db.commit()
    db.refresh(character)
    return character


@router.get(
    "/downtime",
    dependencies=[Depends(_require_downtime_enabled)],
)
def downtime_available(
    _player: Annotated[User, Depends(require_role("player"))],
) -> dict[str, bool]:
    """True no-op flag probe — the rest endpoint itself always mutates real
    state (or is a state-dependent no-op), so it can't safely double as its
    own availability check the way the empty-body state PATCH does."""
    return {"available": True}


@router.post(
    "/characters/{character_id}/rest",
    response_model=RestResponse,
    dependencies=[Depends(_require_downtime_enabled)],
)
def rest_character(
    character_id: int,
    body: RestRequest,
    db: Annotated[Session, Depends(get_db)],
    player: Annotated[User, Depends(require_role("player"))],
) -> RestResponse:
    """Apply one SRD downtime rest move (short or long rest) to a character.

    Self-targeting only — see `app.schemas.character_rest` for the full list
    of scope trims against the SRD's Downtime section (DHCM-51).
    """
    character = _get_owned_character(character_id, db, player)
    current = {
        "hp_marked": character.hp_marked,
        "stress_marked": character.stress_marked,
        "armor_slots_marked": character.armor_slots_marked,
        "hope": character.hope,
    }
    try:
        result = apply_rest(character.extra, character.level, current, body)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    setattr(character, result.field, result.new_value)
    db.commit()
    db.refresh(character)
    character_out = CharacterOut.model_validate(character, from_attributes=True)
    return RestResponse(character=character_out, result=result)


@router.delete("/characters/{character_id}", status_code=204)
def delete_character(
    character_id: int,
    db: Annotated[Session, Depends(get_db)],
    player: Annotated[User, Depends(require_role("player"))],
) -> None:
    character = _get_owned_character(character_id, db, player)
    db.delete(character)
    db.commit()


@router.get("/campaigns/{campaign_id}/note", response_model=NoteOut)
def get_note(
    campaign_id: int,
    db: Annotated[Session, Depends(get_db)],
    player: Annotated[User, Depends(require_role("player"))],
) -> NoteOut:
    _require_membership(campaign_id, db, player)
    note = db.scalar(
        select(CampaignNote).where(
            CampaignNote.campaign_id == campaign_id,
            CampaignNote.player_user_id == player.id,
        )
    )
    if note is None:
        return NoteOut(campaign_id=campaign_id, body="", updated_at=datetime.now(UTC))
    return NoteOut(campaign_id=note.campaign_id, body=note.body, updated_at=note.updated_at)


@router.put("/campaigns/{campaign_id}/note", response_model=NoteOut)
def update_note(
    campaign_id: int,
    body: NoteUpdate,
    db: Annotated[Session, Depends(get_db)],
    player: Annotated[User, Depends(require_role("player"))],
) -> NoteOut:
    _require_membership(campaign_id, db, player)
    note = db.scalar(
        select(CampaignNote).where(
            CampaignNote.campaign_id == campaign_id,
            CampaignNote.player_user_id == player.id,
        )
    )
    now = datetime.now(UTC)
    if note is None:
        note = CampaignNote(
            campaign_id=campaign_id, player_user_id=player.id, body=body.body, updated_at=now
        )
        db.add(note)
    else:
        note.body = body.body
        note.updated_at = now
    db.commit()
    return NoteOut(campaign_id=campaign_id, body=body.body, updated_at=now)
