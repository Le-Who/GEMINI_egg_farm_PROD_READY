export enum ItemType {
  FURNITURE = "FURNITURE",
  PLANT = "PLANT", // Legacy direct plant
  DECORATION = "DECORATION",
  PLANTER = "PLANTER", // New container type
  INCUBATOR = "INCUBATOR", // New for Sprint 3
  EGG = "EGG", // New for Sprint 3
  CONSUMABLE = "CONSUMABLE", // New for Fertilizer
  DYE = "DYE", // Tint items — apply color to placed furniture/decoration
}

export type RoomType = "interior" | "garden";

export interface LevelConfig {
  level: number;
  xpRequired: number;
  unlockItems: string[];
}

export interface NeighborProfile {
  id: string;
  username: string;
  level: number;
  avatarUrl?: string;
}

export interface PlacedItem {
  id: string;
  itemId: string;
  gridX: number;
  gridY: number;
  rotation: number;
  placedAt: number;
  meta?: {
    eggId?: string;
    hatchStart?: number;
    [key: string]: any;
  };
  cropData?: {
    cropId: string;
    plantedAt: number;
    isReady: boolean;
  } | null;
  tint?: number | null; // For Dye system
}

export interface Room {
  type: RoomType;
  items: PlacedItem[];
  unlocked: boolean;
}

export interface ItemConfig {
  id: string;
  name: string;
  name_ru?: string;
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
  description_ru?: string;
  sprite?: string | null;
  dyeColor?: string; // For DYE items: hex tint color (e.g. "0xff4444")
}

export interface CropConfig {
  id: string;
  name: string;
  name_ru?: string;
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
  name_ru?: string;
  rarity: "common" | "rare" | "legendary";
  color: number;
  bonusDescription: string;
  bonusDescription_ru?: string;
  bonus?: { type: "growth_speed" | "coin_reward" | "xp_reward"; value: number }; // Legacy single bonus
  bonuses?: { type: string; value: number }[]; // Multi-ability (preferred)
  sprite?: string | null;
}

export interface EggConfig {
  id: string;
  hatchTime: number; // seconds
  pool: { petId: string; weight: number }[];
  sprite?: string; // New: Custom egg sprite
  name_ru?: string; // Optional name override
  description_ru?: string; // Optional desc override
}

export interface QuestConfig {
  id: string;
  title: string;
  title_ru?: string;
  description: string;
  description_ru?: string;
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

export interface SkuConfig {
  id: string;
  name: string;
  name_ru?: string;
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
  text_ru?: string;
  trigger: string; // Event name
  targetId?: string; // Item ID or UI Element ID
}

export type StickerType =
  | "heart"
  | "star"
  | "thumbsup"
  | "sparkle"
  | "flower"
  | "wave";

export interface BillboardEntry {
  fromId: string;
  fromName: string;
  sticker: StickerType;
  message?: string;
  timestamp: number;
}

export interface PetData {
  id: string;
  configId: string;
  name: string;
  level: number;
  xp: number;
  happiness: number;
  acquiredAt: number;
}

export interface QuestProgress {
  questId: string;
  progress: number;
  completed: boolean;
  completedAt?: number;
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
  placedItems: PlacedItem[]; // Global/Legacy or not used?
  rooms: Record<RoomType, Room>;
  currentRoom: RoomType;
  pets: PetData[];
  equippedPetId: string | null;
  tutorialStep: number;
  completedTutorial: boolean;
  quests: QuestProgress[];
  billboard?: BillboardEntry[];
  lastAction?: {
    type: string;
    gridX: number;
    gridY: number;
    timestamp: number;
  };
}
