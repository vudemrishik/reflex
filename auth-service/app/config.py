"""Centralised settings loaded from environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── Database ───────────────────────────────────────────
    database_url: str = "postgresql://reflex:reflex_secret@localhost:5432/reflex"

    # ── JWT ────────────────────────────────────────────────
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_expiry_hours: int = 24

    # ── Google OAuth 2.0 ───────────────────────────────────
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost/api/auth/google/callback"

    # ── Frontend ───────────────────────────────────────────
    frontend_url: str = "http://localhost"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
