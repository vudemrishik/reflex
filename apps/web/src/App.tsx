import { Suspense, lazy, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { useGame } from "./hooks/useGame";
import { Navbar } from "./components/Navbar";
import { GameBoard } from "./components/GameBoard";
import { getGoogleLoginUrl } from "./api/client";

// Code-split: recharts (~350kB) loads only when the game ends,
// keeping the initial interactive bundle lean.
const ReactionGraph = lazy(() =>
  import("./components/ReactionGraph").then((m) => ({
    default: m.ReactionGraph,
  }))
);

function GraphFallback() {
  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-white/40">
        Reaction history
      </div>
      <div className="h-48 w-full animate-pulse rounded-lg bg-white/5" />
    </div>
  );
}

// NOTE: Global leaderboard is temporarily disabled (single-player focus).
// import { Leaderboard } from "./components/Leaderboard";

function StatCard({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: string;
  unit?: string;
  accent?: string;
}) {
  return (
    <div className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-4">
      <div className="text-[11px] font-bold uppercase tracking-widest text-white/40">
        {label}
      </div>
      <div className={`mt-1 font-mono text-3xl font-black ${accent ?? "text-white"}`}>
        {value}
        {unit && (
          <span className="ml-1 text-sm font-normal text-white/40">{unit}</span>
        )}
      </div>
    </div>
  );
}

function GameScreen() {
  const { user } = useAuth();
  const game = useGame();
  const { status } = game.state;
  const { time_saved_ms, total_successes, avg_response_time_ms } =
    game.metrics;

  // Keyboard controls: ← / → (also A / D).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (game.state.status !== "playing") {
        if (e.key === "Enter" || e.key === " ") void game.start();
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A")
        game.pick("A");
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D")
        game.pick("B");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [game]);

  return (
    <div className="mx-auto min-h-full w-full max-w-3xl px-4 pb-16">
      <Navbar />

      <div className="mt-4">
        {/* ── Game column (single-player, no leaderboard) ── */}
        <div className="rounded-2xl border border-white/10 bg-surface-900/60 p-5 backdrop-blur sm:p-8">
          {status === "idle" && (
            <div className="animate-fade-in py-8 text-center">
              <div className="text-5xl">⚡</div>
              <h1 className="mt-4 text-3xl font-black sm:text-4xl">
                Click the HIGHER number.
                <br />
                <span className="text-accent-light">
                  You have 1 second.
                </span>
              </h1>
              <p className="mx-auto mt-3 max-w-md text-sm text-white/50">
                Every millisecond you save counts. Correct pick = timer
                resets with new numbers. Wrong pick or timeout = game
                over. All timing runs client-side — zero network latency.
              </p>
              {!user && (
                <p className="mx-auto mt-3 max-w-md rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-200">
                  Playing as guest (unranked).{" "}
                  <a
                    href={getGoogleLoginUrl()}
                    className="underline hover:text-yellow-100"
                  >
                    Sign in with Google
                  </a>{" "}
                  to save your stats.
                </p>
              )}
              <button
                onClick={() => void game.start()}
                className="mt-6 rounded-full bg-accent px-8 py-3 text-lg font-bold shadow-[0_0_30px_rgba(139,92,246,0.5)] transition hover:scale-105 hover:bg-accent-light active:scale-95"
              >
                ▶ Start Game
              </button>
              <p className="mt-3 font-mono text-[11px] text-white/30">
                tip: use ← → arrow keys · Enter to restart
              </p>
            </div>
          )}

          {(status === "playing" || status === "gameover") && (
            <div
              className={
                status === "gameover" ? "animate-shake" : undefined
              }
            >
              <GameBoard state={game.state} onPick={game.pick} />
            </div>
          )}

          {status === "gameover" && (
            <div className="mt-6 animate-slide-up rounded-xl border border-white/10 bg-black/40 p-5 text-center">
              <div className="text-sm uppercase tracking-widest text-white/40">
                Game over
              </div>

              {/* ── New reaction-time metrics ── */}
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <StatCard
                  label="Time saved"
                  value={String(time_saved_ms)}
                  unit="ms"
                  accent="text-neon-green"
                />
                <StatCard
                  label="Successes"
                  value={String(total_successes)}
                  accent="text-white"
                />
                <StatCard
                  label="Avg response"
                  value={
                    total_successes === 0
                      ? "—"
                      : avg_response_time_ms.toFixed(1)
                  }
                  unit={total_successes === 0 ? undefined : "ms"}
                  accent="text-neon-blue"
                />
              </div>

              <Suspense fallback={<GraphFallback />}>
                <ReactionGraph
                  reactionTimes={game.state.reactionTimes}
                  averageMs={avg_response_time_ms}
                />
              </Suspense>

              {game.submitting && (
                <p className="mt-3 animate-pulse text-sm text-white/50">
                  Saving stats…
                </p>
              )}
              {game.submitMessage && !game.submitting && (
                <p className="mt-3 text-sm text-neon-green">
                  {game.isHighScore ? "🎉 " : ""}
                  {game.submitMessage}
                </p>
              )}
              {!user && (
                <p className="mt-3 text-xs text-white/40">
                  <a
                    href={getGoogleLoginUrl()}
                    className="text-accent-light underline"
                  >
                    Sign in
                  </a>{" "}
                  to save your stats.
                </p>
              )}
              <button
                onClick={() => void game.start()}
                className="mt-4 rounded-full bg-white px-6 py-2.5 font-bold text-gray-900 transition hover:scale-105 active:scale-95"
              >
                ↻ Play again (Enter)
              </button>
            </div>
          )}
        </div>
      </div>

      <footer className="mt-8 text-center font-mono text-[11px] text-white/30">
        REFLEX arcade · game #1 “onesec-higher” · single-player mode
        (leaderboard disabled) · engine isolated for React Native port
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <GameScreen />
    </AuthProvider>
  );
}
