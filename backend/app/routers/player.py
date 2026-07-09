"""Player area: characters, joined campaigns, notes. Gated by player_area_enabled."""

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_role
from app.models import Campaign, CampaignMembership, CampaignNote, Character, User
from app.routers.settings import get_settings
from app.schemas.player import (
    CharacterCreate,
    CharacterOut,
    CharacterUpdate,
    MemberCampaignOut,
    NoteOut,
    NoteUpdate,
)


def _require_player_area_enabled(db: Annotated[Session, Depends(get_db)]) -> None:
    if not get_settings(db).get("player_area_enabled", False):
        raise HTTPException(status_code=404)


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
    for field, value in updates.items():
        setattr(character, field, value)
    db.commit()
    db.refresh(character)
    return character


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
