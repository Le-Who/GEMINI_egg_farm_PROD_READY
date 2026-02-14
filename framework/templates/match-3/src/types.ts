/**
 * {{GAME_TITLE}} — Match-3 Types
 */

import type { BasePlayerState, ContentItem } from "@discord-activities/core";

export interface Match3PlayerState extends BasePlayerState {
  highScore: number;
  totalGamesPlayed: number;
  totalMatches: number;
  currentGame: Match3GameState | null;
}

export interface Match3GameState {
  board: (GemType | null)[][];
  score: number;
  movesLeft: number;
  level: number;
  combo: number;
  maxCombo: number;
  startedAt: number;
  isGameOver: boolean;
}

export type GemType = "fire" | "water" | "earth" | "air" | "light" | "dark";

export interface GemConfig extends ContentItem {
  type: GemType;
  color: number;
  points: number;
}

export interface Match3Move {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

export interface MatchGroup {
  gems: { x: number; y: number }[];
  type: GemType;
  points: number;
}
