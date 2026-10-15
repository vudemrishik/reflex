"""Pydantic v2 schemas for game service requests and responses."""

from __future__ import annotations

from pydantic import BaseModel, Field


# ── Session ─────────────────────────────────────────────────
class SessionStartResponse(BaseModel):
    session_token: str
    message: str = "Session started"


# ── Score submission (reaction-time metrics) ────────────────
class ScoreSubmitRequest(BaseModel):
    time_saved_ms: int = Field(..., ge=0)
    total_successes: int = Field(..., ge=0)
    avg_response_time_ms: float = Field(..., ge=0)
    reaction_history: list[int] = Field(default_factory=list, max_length=10000)
    session_token: str


class ScoreSubmitResponse(BaseModel):
    time_saved_ms: int
    total_successes: int
    avg_response_time_ms: float
    is_high_score: bool
    message: str


# ── Leaderboard (DISABLED — single-player focus) ────────────
# class LeaderboardEntry(BaseModel):
#     rank: int
#     user_id: str
#     display_name: str
#     avatar_url: str | None = None
#     score: int
#
#
# class LeaderboardResponse(BaseModel):
#     game_slug: str
#     entries: list[LeaderboardEntry]
