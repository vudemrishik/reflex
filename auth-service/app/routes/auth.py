"""Google OAuth 2.0 authentication routes.

Flow (web):
  1. GET  /api/auth/google/login    → redirect to Google consent screen
  2. GET  /api/auth/google/callback → exchange code, upsert user, set JWT cookie
  3. GET  /api/auth/me              → return current user (Bearer header OR cookie)
  4. POST /api/auth/logout          → clear JWT cookie

Flow (mobile):
  5. POST /api/auth/google/mobile   → verify Google token, return JWT as JSON

Hybrid auth: protected endpoints accept `Authorization: Bearer <jwt>` first
(mobile), falling back to the `HttpOnly` cookie (web).
"""

from __future__ import annotations

import uuid
import urllib.parse

import httpx
from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import RedirectResponse

from app.config import settings
from app.database import Database
from app.jwt_utils import create_access_token, decode_access_token
from app.schemas import (
    UserResponse,
    MessageResponse,
    MobileLoginRequest,
    TokenResponse,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

# ── Google endpoints ────────────────────────────────────────
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"
GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"

COOKIE_KEY = "access_token"


def extract_token(request: Request) -> str | None:
    """Hybrid token extraction: Bearer header first, HttpOnly cookie fallback."""
    auth = request.headers.get("Authorization", "")
    if auth.lower().startswith("bearer "):
        token = auth[7:].strip()
        if token:
            return token
    return request.cookies.get(COOKIE_KEY)


async def _upsert_user(google_id: str, email: str, name: str, picture: str | None):
    """Insert or update a user by google_id; return the DB row."""
    pool = Database.get_pool()
    return await pool.fetchrow(
        """
        INSERT INTO users (google_id, email, display_name, avatar_url)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (google_id) DO UPDATE SET
            email        = EXCLUDED.email,
            display_name = EXCLUDED.display_name,
            avatar_url   = EXCLUDED.avatar_url
        RETURNING id, google_id, email, display_name, avatar_url
        """,
        google_id,
        email,
        name or email,
        picture,
    )


def _issue_jwt(row) -> str:
    """Sign our custom JWT for an upserted user row."""
    return create_access_token(
        {
            "sub": str(row["id"]),
            "email": row["email"],
            "display_name": row["display_name"],
        }
    )


# ── Routes ──────────────────────────────────────────────────
@router.get("/google/login")
async def google_login():
    """Redirect the user to Google's OAuth consent screen."""
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "consent",
    }
    return RedirectResponse(
        url=f"{GOOGLE_AUTH_URL}?{urllib.parse.urlencode(params)}"
    )


@router.get("/google/callback")
async def google_callback(code: str):
    """Handle the OAuth callback: exchange code → get profile → upsert user → issue JWT."""

    async with httpx.AsyncClient(timeout=15) as client:
        # 1. Exchange authorisation code for tokens
        token_resp = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": settings.google_redirect_uri,
            },
        )
        if token_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Token exchange failed")
        tokens = token_resp.json()

        # 2. Fetch user profile
        profile_resp = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
        if profile_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="User info fetch failed")
        profile = profile_resp.json()

    # 3. Upsert into PostgreSQL
    row = await _upsert_user(
        profile["id"],
        profile["email"],
        profile.get("name", profile["email"]),
        profile.get("picture"),
    )

    # 4. Issue JWT
    jwt_token = _issue_jwt(row)

    # 5. Set HttpOnly cookie and redirect to frontend.
    # Local http dev keeps lax+insecure; production (Vercel → gateway,
    # cross-site) needs samesite=none + secure via env.
    redirect = RedirectResponse(url=settings.frontend_url, status_code=302)
    redirect.set_cookie(
        key=COOKIE_KEY,
        value=jwt_token,
        httponly=True,
        samesite=settings.cookie_samesite,  # type: ignore[arg-type]
        secure=settings.cookie_secure,
        max_age=settings.jwt_expiry_hours * 3600,
        path="/",
    )
    return redirect


@router.get("/me", response_model=UserResponse)
async def get_current_user(request: Request):
    """Return the authenticated user (Bearer header first, cookie fallback)."""
    token = extract_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        payload = decode_access_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    pool = Database.get_pool()
    row = await pool.fetchrow(
        "SELECT id, email, display_name, avatar_url FROM users WHERE id = $1",
        uuid.UUID(payload["sub"]),
    )
    if not row:
        raise HTTPException(status_code=404, detail="User not found")

    return UserResponse(
        id=str(row["id"]),
        email=row["email"],
        display_name=row["display_name"],
        avatar_url=row["avatar_url"],
    )


@router.post("/logout", response_model=MessageResponse)
async def logout():
    """Clear the JWT cookie."""
    resp = Response(
        content='{"message":"Logged out"}',
        media_type="application/json",
    )
    resp.delete_cookie(COOKIE_KEY, path="/")
    return resp


@router.post("/google/mobile", response_model=TokenResponse)
async def google_mobile_login(body: MobileLoginRequest):
    """Mobile login: verify a Google token, return our JWT as JSON (no cookie).

    Accepts either an `id_token` (verified via Google tokeninfo, audience
    checked against our client ID) or an `access_token` (verified by fetching
    the Google userinfo profile).
    """
    if not body.access_token and not body.id_token:
        raise HTTPException(
            status_code=400, detail="Provide access_token or id_token"
        )

    async with httpx.AsyncClient(timeout=15) as client:
        if body.id_token:
            info_resp = await client.get(
                GOOGLE_TOKENINFO_URL, params={"id_token": body.id_token}
            )
            if info_resp.status_code != 200:
                raise HTTPException(
                    status_code=401, detail="Invalid Google id_token"
                )
            info = info_resp.json()
            # Audience check: token must be minted for OUR client (when configured).
            if (
                settings.google_client_id
                and info.get("aud") != settings.google_client_id
            ):
                raise HTTPException(
                    status_code=401, detail="Google token audience mismatch"
                )
            if "email" not in info or "sub" not in info:
                raise HTTPException(
                    status_code=401, detail="Google token missing identity"
                )
            google_id = info["sub"]
            email = info["email"]
            name = info.get("name", email)
            picture = info.get("picture")
        else:
            assert body.access_token is not None
            profile_resp = await client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {body.access_token}"},
            )
            if profile_resp.status_code != 200:
                raise HTTPException(
                    status_code=401, detail="Invalid Google access_token"
                )
            profile = profile_resp.json()
            google_id = profile["id"]
            email = profile["email"]
            name = profile.get("name", email)
            picture = profile.get("picture")

    row = await _upsert_user(google_id, email, name, picture)
    return TokenResponse(access_token=_issue_jwt(row))
