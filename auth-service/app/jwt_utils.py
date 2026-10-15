"""JWT creation and verification helpers."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import jwt

from app.config import settings


def create_access_token(payload: dict) -> str:
    """Sign a new JWT with an expiry claim."""
    data = payload.copy()
    data.update(
        {
            "exp": datetime.now(timezone.utc)
            + timedelta(hours=settings.jwt_expiry_hours),
            "iat": datetime.now(timezone.utc),
        }
    )
    return jwt.encode(data, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    """Verify and decode a JWT.  Raises jwt.exceptions on failure."""
    return jwt.decode(
        token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
    )
