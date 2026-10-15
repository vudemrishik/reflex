-- ============================================================
--  REFLEX — Multi-Game Arcade Platform · Database Bootstrap
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ──────────────────────────────────────────────────────────
--  Users
-- ──────────────────────────────────────────────────────────
CREATE TABLE users (
    id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    google_id     VARCHAR(255) NOT NULL UNIQUE,
    email         VARCHAR(255) NOT NULL UNIQUE,
    display_name  VARCHAR(255) NOT NULL,
    avatar_url    VARCHAR(512),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_google_id ON users (google_id);

-- ──────────────────────────────────────────────────────────
--  Games Registry (multi-game extensibility)
-- ──────────────────────────────────────────────────────────
CREATE TABLE games (
    id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug        VARCHAR(100) NOT NULL UNIQUE,
    title       VARCHAR(255) NOT NULL,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_games_slug ON games (slug);

-- ──────────────────────────────────────────────────────────
--  Scores (single-player reaction metrics; leaderboard disabled)
--  Local dev: drop & recreate to pick up the new schema, then
--  run `docker compose down -v` for a clean bootstrap.
-- ──────────────────────────────────────────────────────────
DROP TABLE IF EXISTS scores;

CREATE TABLE scores (
    id                   UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id              UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game_id              UUID        NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    time_saved_ms        INTEGER     NOT NULL CHECK (time_saved_ms >= 0),
    total_successes      INTEGER     NOT NULL CHECK (total_successes >= 0),
    avg_response_time_ms DOUBLE PRECISION NOT NULL CHECK (avg_response_time_ms >= 0),
    reaction_history     JSONB       NOT NULL DEFAULT '[]'::jsonb,
    played_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Per-user history & per-game best-time lookups
CREATE INDEX idx_scores_game_saved  ON scores (game_id, time_saved_ms DESC);
CREATE INDEX idx_scores_user_game   ON scores (user_id, game_id);

-- ──────────────────────────────────────────────────────────
--  Seed — Register the first game
-- ──────────────────────────────────────────────────────────
INSERT INTO games (slug, title, is_active)
VALUES ('onesec-higher', '1-Sec Higher Number', TRUE);
