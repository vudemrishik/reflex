"""JWT helpers for verifying auth tokens and issuing game-session tokens."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import jwt

from app.config import settings


# ── Auth JWT verification (shared secret with auth-service) ─
def decode_auth_token(token: str) -> dict:
    """Verify an auth JWT issued by the auth-service."""
    return jwt.decode(
        token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
    )


# ── Game session tokens (separate secret) ───────────────────
def create_session_token(user_id: str, game_slug: str) -> tuple[str, str]:
    """Issue a short-lived session token with a server-side start timestamp.

    Returns (session_id, signed_token).
    """
    session_id = str(uuid.uuid4())
    payload = {
        "sid": session_id,
        "sub": user_id,
        "game": game_slug,
        "started_at": datetime.now(timezone.utc).timestamp(),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=10),
    }
    token = jwt.encode(
        payload, settings.session_secret, algorithm=settings.jwt_algorithm
    )
    return session_id, token


def decode_session_token(token: str) -> dict:
    """Verify a game-session token."""
    return jwt.decode(
        token, settings.session_secret, algorithms=[settings.jwt_algorithm]
    )
