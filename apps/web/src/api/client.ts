/**
 * Thin API client for communicating with the backend through the Nginx gateway.
 * All endpoints are same-origin so cookies are sent automatically.
 */

const BASE =
  import.meta.env.BACKEND_API_URL?.replace(/\/+$/, "") ??
  ""; // empty = same origin (Docker gateway proxies everything)

export interface User {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
}

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  score: number;
}

export interface SessionStartResponse {
  session_token: string;
  message: string;
}

export interface ScoreMetrics {
  time_saved_ms: number;
  total_successes: number;
  avg_response_time_ms: number;
  /** Per-click reaction times in ms (rounded ints), parallel to total_successes. */
  reaction_history: number[];
}

export interface ScoreSubmitResponse extends ScoreMetrics {
  is_high_score: boolean;
  message: string;
}

// ── Auth ──────────────────────────────────────────────────

export async function fetchCurrentUser(): Promise<User | null> {
  try {
    const res = await fetch(`${BASE}/api/auth/me`, { credentials: "include" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export function getGoogleLoginUrl(): string {
  return `${BASE}/api/auth/google/login`;
}

export async function logout(): Promise<void> {
  await fetch(`${BASE}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
}

// ── Game Sessions ─────────────────────────────────────────

export async function startSession(
  gameSlug: string
): Promise<SessionStartResponse> {
  const res = await fetch(
    `${BASE}/api/v1/games/${gameSlug}/sessions/start`,
    { method: "POST", credentials: "include" }
  );
  if (!res.ok) throw new Error("Failed to start session");
  return res.json();
}

export async function submitScore(
  gameSlug: string,
  metrics: ScoreMetrics,
  sessionToken: string
): Promise<ScoreSubmitResponse> {
  const res = await fetch(`${BASE}/api/v1/games/${gameSlug}/scores`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...metrics, session_token: sessionToken }),
  });
  if (!res.ok) throw new Error("Failed to submit score");
  return res.json();
}

// ── Leaderboard (DISABLED — single-player focus; route unregistered) ──

export async function fetchLeaderboard(
  gameSlug: string
): Promise<LeaderboardEntry[]> {
  try {
    const res = await fetch(
      `${BASE}/api/v1/games/${gameSlug}/leaderboard`,
      { credentials: "include" }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.entries ?? [];
  } catch {
    return [];
  }
}
