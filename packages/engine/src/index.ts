/**
 * @reflex/engine — public entry-point shared by apps/web and apps/mobile.
 * Keep this module dependency-free (no React, no DOM) so it stays
 * importable from React Native / Expo.
 */

export type {
  GameStatus,
  GameState,
  GameMetrics,
  GameStateCallback,
} from "./types";
export { computeMetrics } from "./types";
export { GameEngine } from "./GameEngine";
