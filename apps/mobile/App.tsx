/**
 * REFLEX mobile — 1-Sec Higher Number (Expo).
 *
 * Consumes the shared @reflex/engine (same GameEngine + computeMetrics
 * as apps/web). The engine's rAF loop runs on React Native's global
 * requestAnimationFrame; a defensive performance.now polyfill is applied
 * for older runtimes. No recharts here (web-only) — raw text stats.
 *
 * Networking: game-over metrics POST to EXPO_PUBLIC_API_URL (see .env)
 * with the SecureStore JWT as `Authorization: Bearer` (hybrid auth).
 */

import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  GameEngine,
  computeMetrics,
  type GameState,
} from "@reflex/engine";
import { AuthProvider, useAuth } from "./src/auth/AuthContext";
import { ApiError, startSession, submitScore } from "./src/api/client";

// ── Defensive clock polyfill (Hermes/modern RN already provide these) ──
if (
  typeof globalThis.performance === "undefined" ||
  typeof (globalThis.performance as Performance | undefined)?.now !==
    "function"
) {
  (globalThis as { performance?: { now: () => number } }).performance = {
    now: () => Date.now(),
  };
}

function StatRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, accent ? { color: accent } : null]}>
        {value}
      </Text>
    </View>
  );
}

function GameScreen() {
  const { jwt, authLoading, signIn, signOut } = useAuth();
  const [state, setState] = useState<GameState>(GameEngine.initialState());
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [netStatus, setNetStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittedRef = useRef(false);

  const engine = useMemo(() => new GameEngine(setState), []);
  useEffect(() => () => engine.destroy(), [engine]);

  const metrics = useMemo(
    () => computeMetrics(state.reactionTimes),
    [state.reactionTimes]
  );

  const start = useCallback(async () => {
    submittedRef.current = false;
    setNetStatus(null);
    setSubmitting(false);
    if (jwt) {
      try {
        const s = await startSession();
        setSessionToken(s.session_token);
      } catch (e) {
        setSessionToken(null);
        const code = e instanceof ApiError ? e.status : "?";
        setNetStatus(`Session failed (${code}) — playing unranked.`);
        console.log("[game] startSession failed:", e);
      }
    } else {
      setSessionToken(null);
    }
    engine.start();
  }, [engine, jwt]);

  // Submit on game over (once per run). Pre-auth this 401s — the status
  // label below doubles as the network connectivity test.
  useEffect(() => {
    if (state.status !== "gameover" || submittedRef.current) return;
    submittedRef.current = true;
    if (!jwt || !sessionToken || metrics.total_successes === 0) {
      if (!jwt) setNetStatus("Guest run — sign in to save stats.");
      return;
    }
    setSubmitting(true);
    submitScore(
      {
        ...metrics,
        reaction_history: state.reactionTimes.map((t) => Math.round(t)),
      },
      sessionToken
    )
      .then((res) => {
        console.log("[game] submitScore:", res);
        setNetStatus(
          res.is_high_score ? "Saved — new personal best! 🎉" : "Saved. ✅"
        );
      })
      .catch((e) => {
        const code = e instanceof ApiError ? e.status : "?";
        console.log("[game] submitScore failed:", code, e?.body ?? e);
        setNetStatus(
          `Network Test: ${code} — ${
            code === 401 || code === 403
              ? "reached server, needs login."
              : "could not save."
          }`
        );
      })
      .finally(() => setSubmitting(false));
  }, [state.status, jwt, sessionToken, metrics, state.reactionTimes]);

  const playing = state.status === "playing";
  const gameover = state.status === "gameover";

  return (
    <View style={styles.container}>
      <Text style={styles.title}>⚡ REFLEX</Text>
      <Text style={styles.subtitle}>tap the HIGHER number · 1 second</Text>

      {/* ── Auth row ── */}
      {jwt ? (
        <Pressable onPress={() => void signOut()} style={styles.authBtn}>
          <Text style={styles.authBtnText}>Sign out</Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={signIn}
          disabled={authLoading}
          style={styles.authBtn}
        >
          <Text style={styles.authBtnText}>
            {authLoading ? "Signing in…" : "G  Sign in with Google"}
          </Text>
        </Pressable>
      )}

      <Text style={styles.score}>
        SCORE <Text style={styles.scoreNum}>{state.score}</Text>
      </Text>

      {/* ── Timer bar (rAF-driven timeRemaining, same as web TimerBar) ── */}
      <View style={styles.timerTrack}>
        <View
          style={[
            styles.timerFill,
            {
              width: `${Math.max(0, Math.min(1, state.timeRemaining)) * 100}%`,
              backgroundColor:
                state.timeRemaining < 0.3 ? "#ef4444" : "#34d399",
            },
          ]}
        />
      </View>

      {/* ── Number cards ── */}
      <View style={styles.cards}>
        <Pressable
          disabled={!playing}
          onPress={() => engine.pick("A")}
          style={({ pressed }) => [
            styles.card,
            pressed && playing ? styles.cardPressed : null,
            !playing ? styles.cardDisabled : null,
          ]}
        >
          <Text style={styles.cardLabel}>LEFT</Text>
          <Text style={styles.cardNum}>{state.numberA}</Text>
        </Pressable>
        <Pressable
          disabled={!playing}
          onPress={() => engine.pick("B")}
          style={({ pressed }) => [
            styles.card,
            pressed && playing ? styles.cardPressed : null,
            !playing ? styles.cardDisabled : null,
          ]}
        >
          <Text style={styles.cardLabel}>RIGHT</Text>
          <Text style={styles.cardNum}>{state.numberB}</Text>
        </Pressable>
      </View>

      {/* ── Idle / Game Over ── */}
      {state.status === "idle" && (
        <Pressable onPress={() => void start()} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>▶ Start Game</Text>
        </Pressable>
      )}

      {gameover && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>GAME OVER</Text>
          <StatRow
            label="TIME SAVED"
            value={`${metrics.time_saved_ms} ms`}
            accent="#34d399"
          />
          <StatRow
            label="SUCCESSES"
            value={String(metrics.total_successes)}
            accent="#ffffff"
          />
          <StatRow
            label="AVG RESPONSE"
            value={
              metrics.total_successes === 0
                ? "—"
                : `${metrics.avg_response_time_ms.toFixed(1)} ms`
            }
            accent="#38bdf8"
          />
          {submitting && (
            <Text style={styles.netStatus}>Saving stats…</Text>
          )}
          {!submitting && netStatus && (
            <Text style={styles.netStatus}>{netStatus}</Text>
          )}
          <Pressable
            onPress={() => void start()}
            style={styles.primaryBtn}
          >
            <Text style={styles.primaryBtnText}>↻ Play again</Text>
          </Pressable>
        </View>
      )}

      <StatusBar style="light" />
    </View>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <GameScreen />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#09090f",
    alignItems: "center",
    paddingTop: 72,
    paddingHorizontal: 20,
  },
  title: {
    color: "#fff",
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 2,
  },
  subtitle: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    marginTop: 4,
  },
  authBtn: {
    marginTop: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  authBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  score: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    marginTop: 20,
    fontVariant: ["tabular-nums"],
  },
  scoreNum: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "800",
  },
  timerTrack: {
    width: "100%",
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginTop: 12,
    overflow: "hidden",
  },
  timerFill: {
    height: "100%",
    borderRadius: 4,
  },
  cards: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
    width: "100%",
  },
  card: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    paddingVertical: 36,
  },
  cardPressed: {
    borderColor: "#8b5cf6",
    backgroundColor: "rgba(139,92,246,0.15)",
    transform: [{ scale: 0.96 }],
  },
  cardDisabled: {
    opacity: 0.85,
  },
  cardLabel: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
  },
  cardNum: {
    color: "#fff",
    fontSize: 64,
    fontWeight: "800",
    marginTop: 4,
    fontVariant: ["tabular-nums"],
  },
  primaryBtn: {
    marginTop: 24,
    backgroundColor: "#8b5cf6",
    borderRadius: 999,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
  },
  panel: {
    marginTop: 24,
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(0,0,0,0.4)",
    padding: 20,
    alignItems: "stretch",
  },
  panelTitle: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    letterSpacing: 3,
    textAlign: "center",
    marginBottom: 12,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  statLabel: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  netStatus: {
    color: "#a78bfa",
    fontSize: 12,
    textAlign: "center",
    marginTop: 12,
  },
});
