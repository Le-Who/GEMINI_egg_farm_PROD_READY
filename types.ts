export enum ItemType {
  FURNITURE = "FURNITURE",
  PLANT = "PLANT", // Legacy direct plant
  DECORATION = "DECORATION",
  PLANTER = "PLANTER", // New container type
  INCUBATOR = "INCUBATOR", // New for Sprint 3
  EGG = "EGG", // New for Sprint 3
  CONSUMABLE = "CONSUMABLE", // New for Fertilizer
}

export type RoomType = "interior" | "garden";

export interface Room {
  type: RoomType;
  items: PlacedItem[];
  unlocked: boolean;
}

export interface ItemConfig {
  id: string;
  name: string;
  type: ItemType;
  price: number;
  currency?: "coins" | "gems"; // Default coins
  premiumPrice?: number;
  color: number;
  width: number; // Grid width
  height: number; // Grid height
  growthTime?: number; // Legacy
  sellPrice?: number; // Legacy
  description: string;
  sprite?: string | null;
}

export interface CropConfig {
  id: string;
  name: string;
  seedPrice: number;
  sellPrice: number;
  growthTime: number; // in seconds
  xpReward: number;
  levelReq: number;
  color: number; // For procedural drawing fallback
  sprite?: string | null; // Fully-grown sprite (legacy single-sprite)
  growthSprites?: { stage: number; sprite: string }[]; // Multi-stage growth (stage = 0-100 %)
}

export interface PetConfig {
  id: string;
  name: string;
  rarity: "common" | "rare" | "legendary";
  color: number;
  bonusDescription: string;
  bonus?: { type: "growth_speed" | "coin_reward" | "xp_reward"; value: number }; // Legacy single bonus
  bonuses?: { type: string; value: number }[]; // Multi-ability (preferred)
  sprite?: string | null;
}

export interface EggConfig {
  id: string;
  hatchTime: number; // seconds
  pool: { petId: string; weight: number }[];
}

export interface LevelConfig {
  level: number;
  xpRequired: number;
  unlocks: string[];
}

export interface CropData {
  cropId: string;
  plantedAt: number;
  isReady: boolean;
}

export interface PlacedItem {
  id: string;
  itemId: string;
  gridX: number;
  gridY: number;
  rotation: number; // 0, 1, 2, 3 (90 degrees steps)
  placedAt: number;
  meta: Record<string, any>; // JSONB equivalent (e.g. { eggId: 'egg_common', hatchStart: 123456 })
  cropData?: CropData | null;
}

export interface PetData {
  id: string; // instance id
  configId: string; // e.g. 'slime_green'
  name: string;
  level: number;
  xp: number;
  happiness: number;
  acquiredAt: number;
}

export interface UserState {
  id: string;
  username: string;
  discordId?: string;
  coins: number;
  gems: number;
  xp: number;
  level: number;
  inventory: Record<string, number>;

  // Room System
  currentRoom: RoomType;
  rooms: Record<RoomType, Room>;
  placedItems: PlacedItem[]; // Deprecated, kept for interface compat during migration logic but unused in logic

  pets: PetData[];
  equippedPetId?: string | null;

  // Tutorial
  tutorialStep: number;
  completedTutorial: boolean;

  // Quest System
  quests?: QuestProgress[];
}

export interface QuestConfig {
  id: string;
  title: string;
  description: string;
  condition: { type: string; count: number; targetId?: string };
  requirements: { minLevel?: number; maxLevel?: number };
  rewards: {
    coins?: number;
    gems?: number;
    xp?: number;
    items?: Record<string, number>;
  };
  repeatable: boolean;
}

export interface QuestProgress {
  questId: string;
  progress: number;
  completed: boolean;
  completedAt?: number;
}

export interface NeighborProfile {
  id: string;
  username: string;
  level: number;
  discordId?: string;
  avatarUrl?: string; // Optional for UI
}

export interface SkuConfig {
  id: string;
  name: string;
  price: string; // Display price e.g. "$1.99"
  amount: number; // Legacy: gems amount
  icon: string;
  rewards?: {
    coins?: number;
    gems?: number;
    items?: Record<string, number>;
  };
}

export interface TutorialStepConfig {
  id: number;
  text: string;
  trigger: string; // Event name
  targetId?: string; // Item ID or UI Element ID
}
