"""Auth schemas."""

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    token: str
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=8, max_length=255)


class InviteCreateRequest(BaseModel):
    role: str


class InviteOut(BaseModel):
    token: str
    role: str


class UserOut(BaseModel):
    id: int
    username: str
    role: str
