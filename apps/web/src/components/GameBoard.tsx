import type { GameState } from "@reflex/engine";

interface Props {
  state: GameState;
  onPick: (side: "A" | "B") => void;
}

/** Timer bar driven by rAF-updated `timeRemaining` (sub-ms smooth). */
export function TimerBar({ remaining }: { remaining: number }) {
  const pct = Math.max(0, Math.min(1, remaining)) * 100;
  const urgent = remaining < 0.3;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className={`h-full rounded-full transition-none ${
          urgent ? "bg-red-500" : "bg-gradient-to-r from-neon-green to-neon-blue"
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function NumberButton({
  value,
  label,
  hotkey,
  onClick,
  disabled,
}: {
  value: number;
  label: string;
  hotkey: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="group relative flex-1 select-none rounded-2xl border border-white/10 bg-white/5 px-4 py-10 text-center backdrop-blur transition-all duration-100 hover:scale-[1.03] hover:border-accent/60 hover:bg-accent/10 hover:shadow-[0_0_40px_rgba(139,92,246,0.35)] active:scale-95 disabled:cursor-default disabled:hover:scale-100 sm:py-16"
    >
      <div className="text-xs font-semibold uppercase tracking-widest text-white/40">
        {label}{" "}
        <kbd className="ml-1 rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-white/50">
          {hotkey}
        </kbd>
      </div>
      <div
        key={value}
        className="mt-2 animate-number-pop font-mono text-6xl font-bold tabular-nums text-white sm:text-8xl"
      >
        {value}
      </div>
    </button>
  );
}

export function GameBoard({ state, onPick }: Props) {
  const playing = state.status === "playing";

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between">
        <div className="font-mono text-sm text-white/60">
          SCORE{" "}
          <span
            key={state.score}
            className="ml-1 inline-block animate-score-bump text-2xl font-bold text-white"
          >
            {state.score}
          </span>
        </div>
        <div className="font-mono text-xs text-white/40">
          {playing ? "PICK THE HIGHER NUMBER" : "—"}
        </div>
      </div>

      <TimerBar remaining={state.timeRemaining} />

      <div className="mt-4 flex gap-3 sm:gap-4">
        <NumberButton
          value={state.numberA}
          label="Left"
          hotkey="←"
          disabled={!playing}
          onClick={() => onPick("A")}
        />
        <NumberButton
          value={state.numberB}
          label="Right"
          hotkey="→"
          disabled={!playing}
          onClick={() => onPick("B")}
        />
      </div>
    </div>
  );
}
