/**
 * {{GAME_TITLE}} — Farm Game Types
 *
 * Extends BasePlayerState with farm-specific data.
 */

import type { BasePlayerState, ContentItem } from "@discord-activities/core";

export interface FarmPlayerState extends BasePlayerState {
  coins: number;
  gems: number;
  xp: number;
  level: number;
  inventory: Record<string, number>;
  rooms: Record<string, FarmRoom>;
  currentRoom: string;
  pets: PetInstance[];
  equippedPetId: string | null;
  tutorialStep: number;
  completedTutorial: boolean;
}

export interface FarmRoom {
  type: string;
  items: PlacedItem[];
  unlocked: boolean;
}

export interface PlacedItem {
  id: string;
  itemId: string;
  gridX: number;
  gridY: number;
  rotation: number;
  placedAt: number;
  cropData?: {
    cropId: string;
    plantedAt: number;
    isReady: boolean;
  } | null;
  tint?: number | null;
}

export interface PetInstance {
  id: string;
  configId: string;
  name: string;
  level: number;
  xp: number;
  happiness: number;
  acquiredAt: number;
}

export interface FarmItem extends ContentItem {
  type: "FURNITURE" | "PLANT" | "DECORATION" | "PLANTER" | "CONSUMABLE";
  price: number;
  currency: "coins" | "gems";
  color: number;
  width: number;
  height: number;
}

export interface CropConfig extends ContentItem {
  seedPrice: number;
  sellPrice: number;
  growthTime: number;
  xpReward: number;
  levelReq: number;
  color: number;
}
