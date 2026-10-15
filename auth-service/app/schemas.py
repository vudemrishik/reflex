"""Pydantic v2 response schemas for the auth service."""

from __future__ import annotations

from pydantic import BaseModel


class UserResponse(BaseModel):
    id: str
    email: str
    display_name: str
    avatar_url: str | None = None


class MessageResponse(BaseModel):
    message: str


class MobileLoginRequest(BaseModel):
    """Google token submitted by the mobile app (at least one required)."""

    access_token: str | None = None
    id_token: str | None = None


class TokenResponse(BaseModel):
    """Our custom JWT returned as JSON (mobile can't use HttpOnly cookies)."""

    access_token: str
    token_type: str = "bearer"
