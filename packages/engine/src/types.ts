/**
 * Platform-agnostic game types.
 * These types intentionally have ZERO coupling to React or any DOM API
 * so the engine can be shared unchanged by web (Vite) and mobile (Expo).
 */

export type GameStatus = "idle" | "countdown" | "playing" | "gameover";

export interface GameState {
  /** Current phase of the game loop */
  status: GameStatus;
  /** Current score (number of correct picks) — equals reactionTimes.length */
  score: number;
  /** Left number card */
  numberA: number;
  /** Right number card */
  numberB: number;
  /** High-res timestamp when the current round began (via performance.now()) */
  roundStartedAt: number;
  /** Fraction of time remaining in the current round [0..1] */
  timeRemaining: number;
  /** Seconds remaining in the pre-game countdown (only when status === "countdown") */
  countdownRemaining: number;
  /** High-res timestamp when the countdown began (via performance.now()) */
  countdownStartedAt: number;
  /** Reaction time (ms) of every successful click in this session */
  reactionTimes: number[];
}

export interface GameMetrics {
  total_successes: number;
  time_saved_ms: number;
  avg_response_time_ms: number;
}

/** Pure helper — portable to React Native / Expo. */
export function computeMetrics(reactionTimes: number[]): GameMetrics {
  const total_successes = reactionTimes.length;
  if (total_successes === 0) {
    return { total_successes: 0, time_saved_ms: 0, avg_response_time_ms: 0 };
  }
  const totalResponse = reactionTimes.reduce((a, b) => a + b, 0);
  const avg_response_time_ms = totalResponse / total_successes;
  const time_saved_ms = Math.max(
    0,
    Math.round(total_successes * 1000 - totalResponse)
  );
  return { total_successes, time_saved_ms, avg_response_time_ms };
}

export type GameStateCallback = (state: GameState) => void;
