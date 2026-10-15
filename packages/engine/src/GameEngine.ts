/**
 * GameEngine — The core reaction-game loop.
 *
 * Design constraints:
 *  • ZERO imports from React, DOM, or any UI framework.
 *  • Uses only `performance.now()` and `requestAnimationFrame` (both
 *    available in browsers AND via polyfills in React Native).
 *  • All state mutations are pushed to the consumer through a callback,
 *    making this trivially renderable by any UI layer.
 */

import type { GameState, GameStateCallback } from "./types";

export class GameEngine {
  // ── Config ─────────────────────────────────────────────
  private readonly ROUND_MS = 1000; // 1-second rounds
  private readonly COUNTDOWN_MS = 3000; // 3-second pre-game countdown
  private readonly MIN_NUM = 1;
  private readonly MAX_NUM = 99;

  // ── Internal state ─────────────────────────────────────
  private state: GameState;
  private rafId: number | null = null;
  private readonly onStateChange: GameStateCallback;

  constructor(onStateChange: GameStateCallback) {
    this.onStateChange = onStateChange;
    this.state = GameEngine.initialState();
  }

  // ── Static helpers ─────────────────────────────────────
  static initialState(): GameState {
    return {
      status: "idle",
      score: 0,
      numberA: 0,
      numberB: 0,
      roundStartedAt: 0,
      timeRemaining: 1,
      reactionTimes: [],
      countdownRemaining: 0,
      countdownStartedAt: 0,
    };
  }

  // ── Public API ─────────────────────────────────────────

  /** Kick off a new game: 3-sec countdown, then the first round. */
  start(): void {
    this.cancelRaf();
    this.state = {
      status: "countdown",
      score: 0,
      numberA: 0,
      numberB: 0,
      roundStartedAt: 0,
      timeRemaining: 1,
      reactionTimes: [],
      countdownRemaining: this.COUNTDOWN_MS / 1000,
      countdownStartedAt: performance.now(),
    };
    this.emit();
    this.scheduleRaf();
  }

  /** Transition from countdown into the first live round. */
  private beginRound(): void {
    const [a, b] = this.generatePair();
    this.state.status = "playing";
    this.state.numberA = a;
    this.state.numberB = b;
    this.state.roundStartedAt = performance.now();
    this.state.timeRemaining = 1;
    this.state.countdownRemaining = 0;
    this.emit();
  }

  /** The player clicked a number card. */
  pick(side: "A" | "B"): void {
    if (this.state.status !== "playing") return;

    const picked = side === "A" ? this.state.numberA : this.state.numberB;
    const other = side === "A" ? this.state.numberB : this.state.numberA;

    if (picked > other) {
      // ✅ Correct — record reaction time, then advance round
      const reactionMs = performance.now() - this.state.roundStartedAt;
      this.state.reactionTimes = [...this.state.reactionTimes, reactionMs];
      this.state.score += 1;
      const [a, b] = this.generatePair();
      this.state.numberA = a;
      this.state.numberB = b;
      this.state.roundStartedAt = performance.now();
      this.state.timeRemaining = 1;
      this.emit();
    } else {
      // ❌ Wrong — game over
      this.endGame();
    }
  }

  /** Tear down the animation loop. */
  destroy(): void {
    this.cancelRaf();
  }

  /** Snapshot of current state (safe copy). */
  getState(): GameState {
    return { ...this.state, reactionTimes: [...this.state.reactionTimes] };
  }

  // ── Private ────────────────────────────────────────────

  private generatePair(): [number, number] {
    const range = this.MAX_NUM - this.MIN_NUM + 1;
    let a: number, b: number;
    do {
      a = Math.floor(Math.random() * range) + this.MIN_NUM;
      b = Math.floor(Math.random() * range) + this.MIN_NUM;
    } while (a === b);
    return [a, b];
  }

  private tick = (): void => {
    if (this.state.status === "countdown") {
      const elapsed = performance.now() - this.state.countdownStartedAt;
      const remaining = (this.COUNTDOWN_MS - elapsed) / 1000;

      if (remaining <= 0) {
        this.beginRound();
        this.scheduleRaf();
        return;
      }

      this.state.countdownRemaining = remaining;
      this.emit();
      this.scheduleRaf();
      return;
    }

    if (this.state.status !== "playing") return;

    const elapsed = performance.now() - this.state.roundStartedAt;
    const remaining = 1 - elapsed / this.ROUND_MS;

    if (remaining <= 0) {
      this.endGame();
      return;
    }

    this.state.timeRemaining = remaining;
    this.emit();
    this.scheduleRaf();
  };

  private endGame(): void {
    this.cancelRaf();
    this.state.status = "gameover";
    this.state.timeRemaining = 0;
    this.emit();
  }

  private emit(): void {
    // Push a shallow copy (plus fresh array) so React can detect changes
    this.onStateChange({
      ...this.state,
      reactionTimes: [...this.state.reactionTimes],
    });
  }

  private scheduleRaf(): void {
    this.rafId = requestAnimationFrame(this.tick);
  }

  private cancelRaf(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}
