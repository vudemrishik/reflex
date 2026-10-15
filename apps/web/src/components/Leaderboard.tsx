import { useEffect, useState } from "react";
import { fetchLeaderboard, type LeaderboardEntry } from "../api/client";

const GAME_SLUG = "onesec-higher";

export function Leaderboard({ refreshKey }: { refreshKey: number }) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchLeaderboard(GAME_SLUG)
      .then((rows) => {
        if (!cancelled) setEntries(rows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return (
    <div className="w-full rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-widest text-white/70">
          🏆 Global Top 100
        </h2>
        <span className="font-mono text-xs text-white/40">
          {entries.length} players
        </span>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-white/5" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <p className="py-6 text-center text-sm text-white/40">
          No scores yet. Be the first! ⚡
        </p>
      ) : (
        <ol className="max-h-96 space-y-1.5 overflow-y-auto pr-1">
          {entries.slice(0, 10).map((e) => (
            <li
              key={e.user_id}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                e.rank <= 3
                  ? "bg-accent/15 font-semibold"
                  : "bg-white/[0.03]"
              }`}
            >
              <span className="w-7 shrink-0 font-mono text-white/50">
                #{e.rank}
              </span>
              {e.avatar_url ? (
                <img
                  src={e.avatar_url}
                  alt=""
                  className="h-6 w-6 shrink-0 rounded-full"
                />
              ) : (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/30 text-xs">
                  {(e.display_name || "?")[0]?.toUpperCase()}
                </span>
              )}
              <span className="flex-1 truncate text-white/90">
                {e.display_name}
              </span>
              <span className="font-mono font-bold text-neon-green">
                {e.score}
              </span>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-3 text-center font-mono text-[11px] text-white/30">
        showing top 10 · API serves top 100
      </p>
    </div>
  );
}
