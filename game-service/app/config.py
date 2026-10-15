"""Centralised settings loaded from environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── Database ───────────────────────────────────────────
    database_url: str = "postgresql://reflex:reflex_secret@localhost:5432/reflex"

    # ── Redis ──────────────────────────────────────────────
    redis_url: str = "redis://localhost:6379/0"

    # ── JWT (must match auth-service) ──────────────────────
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"

    # ── Game session signing (separate from JWT) ───────────
    session_secret: str = "change-me-session"

    # ── Anti-cheat ─────────────────────────────────────────
    min_round_ms: int = 100  # minimum ms per correct answer

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
