/**
 * {{GAME_TITLE}} — Card Battle Types
 */

import type { BasePlayerState, ContentItem } from "@discord-activities/core";

export interface CardBattleState extends BasePlayerState {
  coins: number;
  deck: string[]; // Card IDs in player's deck
  collection: string[]; // All unlocked card IDs
  wins: number;
  losses: number;
  currentBattle: BattleState | null;
}

export interface BattleState {
  opponentId: string;
  opponentName: string;
  playerHand: CardInstance[];
  opponentHand: CardInstance[];
  playerHP: number;
  opponentHP: number;
  turn: "player" | "opponent";
  turnNumber: number;
  log: BattleLogEntry[];
}

export interface CardInstance {
  id: string;
  cardId: string;
  currentHP: number;
  currentATK: number;
  effects: string[];
}

export interface CardConfig extends ContentItem {
  rarity: "common" | "rare" | "epic" | "legendary";
  type: "creature" | "spell" | "trap";
  cost: number;
  attack: number;
  health: number;
  ability?: string;
  abilityDescription?: string;
  element: "fire" | "water" | "earth" | "air" | "dark" | "light";
}

export interface BattleLogEntry {
  turn: number;
  actor: "player" | "opponent";
  action: string;
  target?: string;
  damage?: number;
  message: string;
}
