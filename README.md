# REFLEX ⚡ — 1-Sec Higher Number Arcade

Fast-paced single-player reaction game on a multi-game microservices platform.

- **Game:** two random numbers, click the higher one within **1 second**.
  Correct → timer resets, new pair, reaction time recorded. Wrong pick or
  timeout → game over with **time saved / successes / avg response** stats.
  Core loop runs **entirely client-side** (`GameEngine` + `requestAnimationFrame`).
- **Stack:** React (Vite, TS, Tailwind, Recharts) · FastAPI (asyncpg) ·
  PostgreSQL · Redis (retained, currently unused — leaderboard disabled) ·
  Nginx gateway · Google OAuth 2.0 (JWT in HttpOnly cookie).
- **Monorepo (npm workspaces):** `apps/web` (this Vite app), `apps/mobile`
  (Expo placeholder shell), `packages/engine` (`@reflex/engine` — shared game
  loop imported by both apps).

## Folder structure

```
reflex/
├── package.json            # workspaces: apps/*, packages/*
├── docker-compose.yml      # postgres, redis, auth, game, frontend, gateway
├── .env.example            # copy to .env and fill in
├── db/init.sql             # users / games / scores (+reaction_history) + seed
├── auth-service/           # Google OAuth, JWT issue, GET /api/auth/me
├── game-service/           # session start, reaction-metrics submit (anti-cheat)
├── gateway/nginx.conf      # routing, rate-limiting, CORS preflight
├── packages/engine/src/    # @reflex/engine: types, GameEngine, computeMetrics
├── apps/web/src/           # @reflex/web: api, context, hooks, components
│   ├── api/client.ts       # same-origin fetch client
│   ├── context/AuthContext.tsx
│   ├── hooks/useGame.ts    # engine ↔ React bridge + metrics + session lifecycle
│   ├── components/         # Navbar, GameBoard, ReactionGraph
│   ├── App.tsx / main.tsx / index.css
└── apps/mobile/            # @reflex/mobile: blank Expo TS shell (engine linked)
```

## Quickstart

1. Create a Google OAuth client (https://console.cloud.google.com/apis/credentials):
   - Authorized redirect URI: `http://localhost/api/auth/google/callback`
2. Configure env:
   ```bash
   cp .env.example .env
   # fill GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET, JWT_SECRET, SESSION_SECRET
   ```
3. Run:
   ```bash
   docker compose up --build
   ```
   Fresh `scores` schema? `db/init.sql` drops/recreates the table on first
   init — run `docker compose down -v` for a clean bootstrap.
4. Open **http://localhost** → Sign in with Google → Start Game.

## API (via gateway :80)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/auth/google/login` | — | Redirect to Google consent |
| GET | `/api/auth/google/callback?code=…` | — | Upsert user, set JWT cookie, redirect to frontend |
| GET | `/api/auth/me` | cookie | Current user |
| POST | `/api/auth/logout` | cookie | Clear cookie |
| POST | `/api/v1/games/{slug}/sessions/start` | cookie | Signed session token w/ server timestamp |
| POST | `/api/v1/games/{slug}/scores` | cookie | Submit reaction metrics (see payload below), save to PG |

(Global leaderboard removed — single-player mode. The old
`GET /api/v1/games/{slug}/leaderboard` route is unregistered and returns 404.)

### `POST /scores` payload

```json
{
  "time_saved_ms": 300,
  "total_successes": 2,
  "avg_response_time_ms": 850.0,
  "reaction_history": [900, 800],
  "session_token": "<jwt-from-session-start>"
}
```

Response echoes the metrics plus `is_high_score` (personal best by
`time_saved_ms`) and a message. `reaction_history` (per-click ms, rounded
ints) is stored as `JSONB` for future profile-history pages.

## Key design notes

- **Metrics:** per successful click the engine records
  `reaction_ms = now − roundStartedAt`. At game over:
  - `total_successes = len(reactionTimes)`
  - `avg_response_time_ms = sum(reactionTimes) / total_successes` (`0` if none)
  - `time_saved_ms = round(total_successes × 1000 − sum(reactionTimes))`
- **Anti-cheat:** session tokens are server-signed (separate `SESSION_SECRET`;
  client timestamps never trusted). On submit the server rejects payloads unless:
  1. `avg_response_time_ms ∈ [0, 1000]` and
     `time_saved_ms ∈ [0, total_successes × 1000]`
     (zero successes must report `0` / `0`);
  2. `|time_saved_ms − (total × 1000 − total × avg)| ≤ max(250, total × 10)ms`
     — tolerance absorbs float rounding + rAF/server-clock jitter;
  3. server-observed `elapsed ≥ total × avg − tolerance` (claimed play time
     can't exceed the session's real duration) and
     `elapsed ≥ total × min_round_ms` (default 100ms per success);
  4. `reaction_history` cross-check: `len(history) == total_successes`,
     every entry `∈ [0, 1000]`, and `|mean(history) − avg| ≤ 5ms`
     (int-rounding only) — the summary metrics must agree with the raw data.
- **Scores table:** `(user_id, game_id, time_saved_ms, total_successes,
  avg_response_time_ms, reaction_history JSONB, played_at)` with
  `(game_id, time_saved_ms DESC)` + `(user_id, game_id)` indexes.
- **Connection pooling:** asyncpg `min_size=5, max_size=20` in both services;
  Redis single pooled async client (kept for future use).
- **Gateway:** Nginx rate-limits (`5r/s` auth, `30r/s` api), forwards cookies,
  handles CORS preflight. JWT verification is authoritative in the
  services (`decode_*_token`); add `auth_request` at edge if required.
- **Frontend:** `@reflex/engine` has zero React/DOM imports — shared by web
  and mobile; `TimerBar` renders `timeRemaining` from rAF. Game Over shows a
  Recharts `<ReactionGraph />` (per-click line chart + avg reference line).
  Guests play unranked; login required for stat submission.
- **Mobile:** `apps/mobile` is an Expo TS app importing
  `@reflex/engine` (full game UI + Recharts-free stats). Install its toolchain:
  `npm install --workspace @reflex/mobile` (network-heavy). Networking via
  `EXPO_PUBLIC_API_URL` (see `apps/mobile/.env` — use your LAN IP, phones
  can't reach `localhost`). Google sign-in via `expo-auth-session` →
  `POST /api/auth/google/mobile` → JWT in SecureStore → `Bearer` header.
- **Auth (hybrid):** web uses the `HttpOnly` cookie; mobile sends
  `Authorization: Bearer <jwt>`. Both services check the Bearer header
  first, cookie second. Mobile login: `POST /api/auth/google/mobile`
  `{access_token?, id_token?}` → `{access_token, token_type: "bearer"}`
  (id_tokens are audience-checked against `GOOGLE_CLIENT_ID`).
