"""Custom-content schemas: GM-authored classes/ancestries/communities/domains/
domain cards/weapons/armor, alongside the SRD's static datasets (DHCM-20).

Each type has its own shape (matching its model's columns 1:1), so each gets
its own Create/Update/Out trio rather than a shared generic schema.
"""

from datetime import datetime

from pydantic import BaseModel, Field


class CustomClassCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    domains_json: str
    starting_evasion: int
    starting_hp: int
    class_items_json: str
    subclasses_json: str


class CustomClassUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    domains_json: str | None = None
    starting_evasion: int | None = None
    starting_hp: int | None = None
    class_items_json: str | None = None
    subclasses_json: str | None = None

    model_config = {"extra": "forbid"}


class CustomClassOut(BaseModel):
    id: int
    name: str
    domains_json: str
    starting_evasion: int
    starting_hp: int
    class_items_json: str
    subclasses_json: str
    created_at: datetime


class CustomAncestryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    features_json: str = "[]"


class CustomAncestryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    features_json: str | None = None

    model_config = {"extra": "forbid"}


class CustomAncestryOut(BaseModel):
    id: int
    name: str
    features_json: str
    created_at: datetime


class CustomCommunityCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    adjectives_json: str = "[]"
    feature_json: str = "null"


class CustomCommunityUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    adjectives_json: str | None = None
    feature_json: str | None = None

    model_config = {"extra": "forbid"}


class CustomCommunityOut(BaseModel):
    id: int
    name: str
    adjectives_json: str
    feature_json: str
    created_at: datetime


class CustomDomainCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    classes_json: str


class CustomDomainUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    classes_json: str | None = None

    model_config = {"extra": "forbid"}


class CustomDomainOut(BaseModel):
    id: int
    name: str
    classes_json: str
    created_at: datetime


class CustomDomainCardCreate(BaseModel):
    domain: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=100)
    type: str = Field(min_length=1, max_length=50)
    recall_cost: int


class CustomDomainCardUpdate(BaseModel):
    domain: str | None = Field(default=None, min_length=1, max_length=100)
    name: str | None = Field(default=None, min_length=1, max_length=100)
    type: str | None = Field(default=None, min_length=1, max_length=50)
    recall_cost: int | None = None

    model_config = {"extra": "forbid"}


class CustomDomainCardOut(BaseModel):
    id: int
    domain: str
    name: str
    type: str
    recall_cost: int
    created_at: datetime


class CustomWeaponCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    trait: str = Field(min_length=1, max_length=20)
    range: str = Field(min_length=1, max_length=20)
    damage: str = Field(min_length=1, max_length=50)
    burden: str = Field(min_length=1, max_length=20)
    is_magic: bool
    feature: str | None = None


class CustomWeaponUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    trait: str | None = Field(default=None, min_length=1, max_length=20)
    range: str | None = Field(default=None, min_length=1, max_length=20)
    damage: str | None = Field(default=None, min_length=1, max_length=50)
    burden: str | None = Field(default=None, min_length=1, max_length=20)
    is_magic: bool | None = None
    feature: str | None = None

    model_config = {"extra": "forbid"}


class CustomWeaponOut(BaseModel):
    id: int
    name: str
    trait: str
    range: str
    damage: str
    burden: str
    is_magic: bool
    feature: str | None
    created_at: datetime


class CustomArmorCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    threshold_low: int
    threshold_high: int
    base_score: int
    feature: str | None = None


class CustomArmorUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    threshold_low: int | None = None
    threshold_high: int | None = None
    base_score: int | None = None
    feature: str | None = None

    model_config = {"extra": "forbid"}


class CustomArmorOut(BaseModel):
    id: int
    name: str
    threshold_low: int
    threshold_high: int
    base_score: int
    feature: str | None
    created_at: datetime
