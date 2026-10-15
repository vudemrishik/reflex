/**
 * useGame — React bridge over the platform-agnostic GameEngine.
 * Keeps engine logic (math, timers, score) isolated for RN/Expo porting.
 *
 * Single-player focus: tracks per-click reaction times and derives
 * { time_saved_ms, total_successes, avg_response_time_ms } locally.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  GameEngine,
  computeMetrics,
  type GameMetrics,
  type GameState,
} from "@reflex/engine";
import { startSession, submitScore } from "../api/client";
import { useAuth } from "../context/AuthContext";

const GAME_SLUG = "onesec-higher";

interface UseGameResult {
  state: GameState;
  metrics: GameMetrics;
  sessionToken: string | null;
  submitting: boolean;
  submitMessage: string | null;
  isHighScore: boolean | null;
  start: () => Promise<void>;
  pick: (side: "A" | "B") => void;
  resetSubmit: () => void;
}

export function useGame(): UseGameResult {
  const { user } = useAuth();
  const [state, setState] = useState<GameState>(GameEngine.initialState());
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [isHighScore, setIsHighScore] = useState<boolean | null>(null);
  const submittedRef = useRef(false);

  const engine = useMemo(() => new GameEngine(setState), []);
  useEffect(() => () => engine.destroy(), [engine]);

  // Metrics derived locally from successful-click reaction times.
  const metrics: GameMetrics = useMemo(
    () => computeMetrics(state.reactionTimes),
    [state.reactionTimes]
  );

  // Auto-submit when the engine reaches gameover (once per run).
  useEffect(() => {
    if (state.status !== "gameover" || submittedRef.current) return;
    submittedRef.current = true;
    if (!user || !sessionToken || metrics.total_successes === 0) return;
    setSubmitting(true);
    submitScore(
      GAME_SLUG,
      {
        ...metrics,
        reaction_history: state.reactionTimes.map((t) => Math.round(t)),
      },
      sessionToken
    )
      .then((res) => {
        setSubmitMessage(res.message);
        setIsHighScore(res.is_high_score);
      })
      .catch(() => setSubmitMessage("Could not save score. Try again."))
      .finally(() => setSubmitting(false));
  }, [state.status, user, sessionToken, metrics]);

  const start = useCallback(async () => {
    submittedRef.current = false;
    setSubmitMessage(null);
    setIsHighScore(null);
    setSubmitting(false);

    // Ranked session only for logged-in users; guests play unranked.
    if (user) {
      try {
        const s = await startSession(GAME_SLUG);
        setSessionToken(s.session_token);
      } catch {
        setSessionToken(null);
        setSubmitMessage("Server unreachable — playing unranked.");
      }
    } else {
      setSessionToken(null);
    }
    engine.start();
  }, [engine, user]);

  const pick = useCallback(
    (side: "A" | "B") => engine.pick(side),
    [engine]
  );

  const resetSubmit = useCallback(() => {
    setSubmitMessage(null);
    setIsHighScore(null);
  }, []);

  return {
    state,
    metrics,
    sessionToken,
    submitting,
    submitMessage,
    isHighScore,
    start,
    pick,
    resetSubmit,
  };
}
