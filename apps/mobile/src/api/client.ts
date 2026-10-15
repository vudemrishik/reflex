/**
 * Mobile API client (Expo / React Native).
 *
 * Base URL comes from EXPO_PUBLIC_API_URL (see apps/mobile/.env).
 * The phone cannot reach `localhost` — set it to your computer's LAN IP,
 * e.g. EXPO_PUBLIC_API_URL=http://192.168.1.12  (gateway port 80).
 *
 * Auth interceptor: every game request attaches the JWT stored by the
 * auth flow (SecureStore) as `Authorization: Bearer <token>`, which the
 * backend accepts via its hybrid Bearer-first extraction.
 */

import * as SecureStore from "expo-secure-store";

export const JWT_KEY = "reflex_jwt";
const GAME_SLUG = "onesec-higher";

export interface ScorePayload {
  time_saved_ms: number;
  total_successes: number;
  avg_response_time_ms: number;
  reaction_history: number[];
}

export interface ScoreSubmitResponse extends ScorePayload {
  is_high_score: boolean;
  message: string;
}

export interface SessionStartResponse {
  session_token: string;
  message: string;
}

export function getApiUrl(): string | null {
  const url = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!url) {
    console.warn(
      "[api] EXPO_PUBLIC_API_URL is missing — set it in apps/mobile/.env " +
        "to your computer's LAN IP (e.g. http://192.168.1.12)"
    );
    return null;
  }
  return url.replace(/\/+$/, ""); // strip trailing slashes
}

async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const jwt = await SecureStore.getItemAsync(JWT_KEY);
  if (jwt) headers.Authorization = `Bearer ${jwt}`;
  return headers;
}

async function parseOrThrow(res: Response, what: string) {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.log(`[api] ${what} → ${res.status} ${res.statusText} ${body}`);
    throw new ApiError(res.status, `${what} failed: ${res.status}`, body);
  }
  return res.json();
}

export class ApiError extends Error {
  status: number;
  body: string;
  constructor(status: number, message: string, body = "") {
    super(message);
    this.status = status;
    this.body = body;
  }
}

/** Exchange a Google token for our JWT (POST /api/auth/google/mobile). */
export async function mobileLogin(opts: {
  accessToken?: string;
  idToken?: string;
}): Promise<string> {
  const base = getApiUrl();
  if (!base) throw new ApiError(0, "API URL not configured");
  const res = await fetch(`${base}/api/auth/google/mobile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      access_token: opts.accessToken ?? null,
      id_token: opts.idToken ?? null,
    }),
  });
  const data = await parseOrThrow(res, "mobileLogin");
  await SecureStore.setItemAsync(JWT_KEY, data.access_token);
  return data.access_token as string;
}

/** Start a ranked server session (needs Bearer JWT). */
export async function startSession(): Promise<SessionStartResponse> {
  const base = getApiUrl();
  if (!base) throw new ApiError(0, "API URL not configured");
  const res = await fetch(`${base}/api/v1/games/${GAME_SLUG}/sessions/start`, {
    method: "POST",
    headers: await authHeaders(),
  });
  return parseOrThrow(res, "startSession");
}

/** Submit final metrics (needs Bearer JWT + session token from startSession). */
export async function submitScore(
  payload: ScorePayload,
  sessionToken: string
): Promise<ScoreSubmitResponse> {
  const base = getApiUrl();
  if (!base) throw new ApiError(0, "API URL not configured");
  const res = await fetch(`${base}/api/v1/games/${GAME_SLUG}/scores`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ ...payload, session_token: sessionToken }),
  });
  return parseOrThrow(res, "submitScore");
}
