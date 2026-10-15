"""Leaderboard endpoint — DISABLED (single-player focus).

Original implementation (Redis ZSET + PG fallback) is preserved below as
comments for easy re-enablement. This module currently exposes NO routes
and is NOT registered in main.py.
"""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/games", tags=["leaderboard"])

# ── DISABLED: GET /{game_slug}/leaderboard ──────────────────
# from app.database import Database
# from app.redis_client import RedisClient
# from app.schemas import LeaderboardEntry, LeaderboardResponse
#
# @router.get("/{game_slug}/leaderboard", response_model=LeaderboardResponse)
# async def get_leaderboard(game_slug: str, top: int = 100):
#     top = min(top, 100)
#     entries = await RedisClient.get_leaderboard(game_slug, top)
#     ...
