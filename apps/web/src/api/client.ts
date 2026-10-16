/**
 * Thin API client for communicating with the backend through the Nginx gateway.
 * All endpoints are same-origin so cookies are sent automatically.
 */

const BASE =
  import.meta.env.BACKEND_API_URL?.replace(/\/+$/, "") ??
  ""; // empty = same origin (Docker gateway proxies everything)

const TOKEN_KEY = "reflex_jwt";

/** Read the persisted Bearer token (null when signed out). */
export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* private mode etc. — session-only then */
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * One-time pickup of the login token: the OAuth callback redirects to
 * `{FRONTEND_URL}#access_token=<jwt>` (fragment never hits the network).
 * Call on app start; stores the token and scrubs the URL.
 * Returns true when a token was found.
 */
export function takeTokenFromUrl(): boolean {
  if (!window.location.hash.startsWith("#access_token=")) return false;
  const token = window.location.hash.slice("#access_token=".length);
  if (token) setToken(token);
  window.history.replaceState(null, "", window.location.pathname);
  return Boolean(token);
}

/** Headers for authenticated calls: Bearer token (primary) + cookies (fallback). */
function authHeaders(json = true): Record<string, string> {
  const headers: Record<string, string> = {};
  if (json) headers["Content-Type"] = "application/json";
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

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
    const res = await fetch(`${BASE}/api/auth/me`, {
      credentials: "include",
      headers: authHeaders(false),
    });
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
  clearToken();
  await fetch(`${BASE}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
    headers: authHeaders(false),
  });
}

// ── Game Sessions ─────────────────────────────────────────

export async function startSession(
  gameSlug: string
): Promise<SessionStartResponse> {
  const res = await fetch(
    `${BASE}/api/v1/games/${gameSlug}/sessions/start`,
    { method: "POST", credentials: "include", headers: authHeaders(false) }
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
    headers: authHeaders(),
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
      { credentials: "include", headers: authHeaders(false) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.entries ?? [];
  } catch {
    return [];
  }
}
