import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface Props {
  /** Raw per-click reaction times (ms) from the GameEngine. */
  reactionTimes: number[];
  /** Mean line overlay (avg_response_time_ms). */
  averageMs?: number;
}

interface Point {
  click: number;
  timeMs: number;
}

/**
 * ReactionGraph — visualizes speed progression over a match.
 * Lower is faster. Rendered on the Game Over screen.
 */
export function ReactionGraph({ reactionTimes, averageMs }: Props) {
  if (reactionTimes.length === 0) return null;

  const data: Point[] = reactionTimes.map((t, i) => ({
    click: i + 1,
    timeMs: Math.round(t),
  }));

  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-white/40">
        Reaction history · lower is faster
      </div>
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
            <XAxis
              dataKey="click"
              tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "rgba(255,255,255,0.15)" }}
              label={{ value: "click #", fill: "rgba(255,255,255,0.3)", fontSize: 10, position: "insideBottomRight", offset: -2 }}
            />
            <YAxis
              tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              domain={[0, 1000]}
              tickFormatter={(v: number) => `${v}ms`}
            />
            <Tooltip
              contentStyle={{
                background: "#1a1a2e",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelFormatter={(label) => `Click #${label}`}
              formatter={(value) => [`${value} ms`, "reaction"]}
            />
            {averageMs !== undefined && averageMs > 0 && (
              <ReferenceLine
                y={Math.round(averageMs)}
                stroke="#38bdf8"
                strokeDasharray="5 4"
                label={{ value: "avg", fill: "#38bdf8", fontSize: 10, position: "insideTopRight" }}
              />
            )}
            <Line
              type="monotone"
              dataKey="timeMs"
              stroke="#34d399"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, fill: "#34d399" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
