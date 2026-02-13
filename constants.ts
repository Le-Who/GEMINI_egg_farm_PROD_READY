import {
  ItemConfig,
  ItemType,
  CropConfig,
  LevelConfig,
  PetConfig,
  EggConfig,
  SkuConfig,
  TutorialStepConfig,
} from "./types";
import {
  getItems,
  getCrops,
  getPets,
  getEggs,
  getLevels,
  getTutorial,
  getSkus,
} from "./services/contentLoader";

// Re-export content loader for direct usage
export {
  loadContent,
  isContentLoaded,
  startContentPolling,
} from "./services/contentLoader";

// --- Static Constants (not data-driven) ---
export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;
export const GRID_SIZE = 16;
export const CANVAS_BG_COLOR = 0x2f3136;
export const GARDEN_BG_COLOR = 0x5a7d5a;

// --- Dynamic Content Accessors ---
// These are getter-based so they always return the latest loaded content.
// Game code continues to use ITEMS, CROPS, etc. as before — no refactoring needed.

export const ITEMS: Record<string, ItemConfig> = new Proxy(
  {} as Record<string, ItemConfig>,
  {
    get(_, prop: string) {
      if (prop === (Symbol.toPrimitive as any) || prop === "toJSON")
        return undefined;
      const items = getItems();
      if (prop in items) return items[prop];
      // Proxy trap for Object.keys, for..in, etc.
      return undefined;
    },
    ownKeys() {
      return Object.keys(getItems());
    },
    has(_, prop: string) {
      return prop in getItems();
    },
    getOwnPropertyDescriptor(_, prop: string) {
      const items = getItems();
      if (prop in items)
        return { configurable: true, enumerable: true, value: items[prop] };
      return undefined;
    },
  },
);

export const CROPS: Record<string, CropConfig> = new Proxy(
  {} as Record<string, CropConfig>,
  {
    get(_, prop: string) {
      const data = getCrops();
      if (prop in data) return data[prop];
      return undefined;
    },
    ownKeys() {
      return Object.keys(getCrops());
    },
    has(_, prop: string) {
      return prop in getCrops();
    },
    getOwnPropertyDescriptor(_, prop: string) {
      const data = getCrops();
      if (prop in data)
        return { configurable: true, enumerable: true, value: data[prop] };
      return undefined;
    },
  },
);

export const PETS: Record<string, PetConfig> = new Proxy(
  {} as Record<string, PetConfig>,
  {
    get(_, prop: string) {
      const data = getPets();
      if (prop in data) return data[prop];
      return undefined;
    },
    ownKeys() {
      return Object.keys(getPets());
    },
    has(_, prop: string) {
      return prop in getPets();
    },
    getOwnPropertyDescriptor(_, prop: string) {
      const data = getPets();
      if (prop in data)
        return { configurable: true, enumerable: true, value: data[prop] };
      return undefined;
    },
  },
);

export const EGGS: Record<string, EggConfig> = new Proxy(
  {} as Record<string, EggConfig>,
  {
    get(_, prop: string) {
      const data = getEggs();
      if (prop in data) return data[prop];
      return undefined;
    },
    ownKeys() {
      return Object.keys(getEggs());
    },
    has(_, prop: string) {
      return prop in getEggs();
    },
    getOwnPropertyDescriptor(_, prop: string) {
      const data = getEggs();
      if (prop in data)
        return { configurable: true, enumerable: true, value: data[prop] };
      return undefined;
    },
  },
);

// Arrays use getter functions directly
export function get_LEVELS(): LevelConfig[] {
  return getLevels();
}
export function get_TUTORIAL(): TutorialStepConfig[] {
  return getTutorial();
}
export function get_SKUS(): SkuConfig[] {
  return getSkus();
}

// Backward-compatible exports — these work at import time if content is already loaded
// For arrays that are referenced as constants, we provide mutable references
export let LEVELS: LevelConfig[] = [];
export let TUTORIAL_STEPS: TutorialStepConfig[] = [];
export let SKUS: SkuConfig[] = [];

// Called after loadContent() to update array references
export function refreshArrayRefs() {
  LEVELS = getLevels();
  TUTORIAL_STEPS = getTutorial();
  SKUS = getSkus();
}
