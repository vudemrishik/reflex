"""Game session management & score submission.

Endpoints:
  POST /api/v1/games/{game_slug}/sessions/start  → issue session token
  POST /api/v1/games/{game_slug}/scores           → submit reaction-time metrics

NOTE: Global leaderboard / Redis ZADD is disabled (single-player focus).
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request

from app.config import settings
from app.database import Database
from app.jwt_utils import decode_auth_token, create_session_token, decode_session_token

# from app.redis_client import RedisClient  # DISABLED — leaderboard off
from app.schemas import (
    ScoreSubmitRequest,
    ScoreSubmitResponse,
    SessionStartResponse,
)

router = APIRouter(prefix="/api/v1/games", tags=["games"])

ROUND_MS = 1000  # must match frontend GameEngine.ROUND_MS


def _get_user_id(request: Request) -> str:
    """Extract and verify the user ID (Bearer header first, cookie fallback)."""
    token = None
    auth = request.headers.get("Authorization", "")
    if auth.lower().startswith("bearer "):
        token = auth[7:].strip() or None
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = decode_auth_token(token)
        return payload["sub"]
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


async def _resolve_game(game_slug: str) -> uuid.UUID:
    """Lookup game by slug; raise 404 if not found or inactive."""
    pool = Database.get_pool()
    row = await pool.fetchrow(
        "SELECT id FROM games WHERE slug = $1 AND is_active = TRUE",
        game_slug,
    )
    if not row:
        raise HTTPException(status_code=404, detail=f"Game '{game_slug}' not found")
    return row["id"]


# ── Start Session ───────────────────────────────────────────
@router.post("/{game_slug}/sessions/start", response_model=SessionStartResponse)
async def start_session(game_slug: str, request: Request):
    """Issue a signed session token containing a server-side start timestamp."""
    user_id = _get_user_id(request)
    await _resolve_game(game_slug)  # validate the game exists

    _session_id, token = create_session_token(user_id, game_slug)
    return SessionStartResponse(session_token=token)


# ── Submit Score ────────────────────────────────────────────
@router.post("/{game_slug}/scores", response_model=ScoreSubmitResponse)
async def submit_score(
    game_slug: str,
    body: ScoreSubmitRequest,
    request: Request,
):
    """Accept reaction-time metrics, run anti-cheat validation, persist."""
    user_id = _get_user_id(request)
    game_id = await _resolve_game(game_slug)

    # 1. Decode session token
    try:
        session = decode_session_token(body.session_token)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid session token")

    # 2. Verify the session belongs to this user & game
    if session["sub"] != user_id or session["game"] != game_slug:
        raise HTTPException(status_code=403, detail="Session mismatch")

    total = body.total_successes
    avg = body.avg_response_time_ms
    saved = body.time_saved_ms
    history = body.reaction_history

    # 3a. Range validation
    if avg < 0 or avg > ROUND_MS:
        raise HTTPException(
            status_code=400,
            detail=f"avg_response_time_ms out of range [0, {ROUND_MS}]",
        )
    if saved < 0 or saved > total * ROUND_MS:
        raise HTTPException(
            status_code=400, detail="time_saved_ms out of range"
        )
    if any(t < 0 or t > ROUND_MS for t in history):
        raise HTTPException(
            status_code=400, detail="reaction_history entries out of range"
        )
    if total == 0:
        if saved != 0 or avg != 0:
            raise HTTPException(
                status_code=400,
                detail="Zero successes must report zero time_saved and avg",
            )
        if history:
            raise HTTPException(
                status_code=400,
                detail="Zero successes must report empty reaction_history",
            )

    # 3b. Anti-cheat: history must agree with the summary metrics.
    if total > 0:
        if len(history) != total:
            raise HTTPException(
                status_code=400,
                detail="reaction_history length must equal total_successes",
            )
        hist_mean = sum(history) / total
        if abs(hist_mean - avg) > 5.0:  # ±5ms absorbs int-rounding only
            raise HTTPException(
                status_code=400,
                detail="avg_response_time_ms does not match reaction_history mean",
            )

    # 3b. Anti-cheat: time_saved ≈ (total × 1000) − (total × avg)
    # Tolerance absorbs float rounding + rAF/server-clock jitter.
    if total > 0:
        expected_saved = total * ROUND_MS - total * avg
        tolerance_ms = max(250.0, total * 10.0)
        if abs(saved - expected_saved) > tolerance_ms:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Metrics inconsistent: time_saved_ms does not match "
                    f"(total × 1000) − (total × avg) (expected ≈{expected_saved:.0f}ms, "
                    f"got {saved}ms)"
                ),
            )

    # 3c. Anti-cheat: server-elapsed sanity (client can't beat physics).
    # Server elapsed must cover the claimed play time (sum of reactions).
    started_at = session["started_at"]
    elapsed_ms = (datetime.now(timezone.utc).timestamp() - started_at) * 1000
    claimed_play_ms = total * avg
    tolerance_ms = max(250.0, total * 10.0)
    if elapsed_ms + tolerance_ms < claimed_play_ms:
        raise HTTPException(
            status_code=400,
            detail="Claimed play time exceeds server-observed session time",
        )
    if elapsed_ms < total * settings.min_round_ms:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Too many successes for elapsed time "
                f"({int(elapsed_ms)}ms < {total * settings.min_round_ms}ms)"
            ),
        )

    # 4. Persist to PostgreSQL (reaction-metrics schema + history)
    pool = Database.get_pool()
    await pool.execute(
        """
        INSERT INTO scores (user_id, game_id, time_saved_ms, total_successes, avg_response_time_ms, reaction_history)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb)
        """,
        uuid.UUID(user_id),
        game_id,
        saved,
        total,
        avg,
        json.dumps(history),
    )

    # 5. Redis leaderboard update DISABLED (single-player focus).
    # await RedisClient.update_leaderboard(...)

    # 6. Personal best by time_saved_ms
    best = await pool.fetchval(
        """
        SELECT MAX(time_saved_ms) FROM scores
        WHERE user_id = $1 AND game_id = $2
        """,
        uuid.UUID(user_id),
        game_id,
    )

    is_high_score = saved >= (best or 0) and total > 0
    return ScoreSubmitResponse(
        time_saved_ms=saved,
        total_successes=total,
        avg_response_time_ms=avg,
        is_high_score=is_high_score,
        message="New personal best! 🎉" if is_high_score else "Stats recorded.",
    )
