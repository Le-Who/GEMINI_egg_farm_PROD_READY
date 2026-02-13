import {
  UserState,
  PlacedItem,
  ItemType,
  PetData,
  NeighborProfile,
  RoomType,
} from "../types";
import {
  ITEMS,
  CROPS,
  LEVELS,
  EGGS,
  PETS,
  SKUS,
  TUTORIAL_STEPS,
} from "../constants";
import { discordService } from "./discord";

// --- Utility: Weighted Random Selection ---
function weightedRandom(pool: { petId: string; weight: number }[]): string {
  const totalWeight = pool.reduce((sum, p) => sum + p.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const entry of pool) {
    roll -= entry.weight;
    if (roll <= 0) return entry.petId;
  }
  return pool[pool.length - 1].petId;
}

// --- Deep Clone Helper ---
function cloneState(state: UserState): UserState {
  return structuredClone(state);
}

const INITIAL_STATE_TEMPLATE: UserState = {
  id: "guest",
  username: "Guest",
  coins: 500,
  gems: 10,
  xp: 0,
  level: 1,
  inventory: { planter_basic: 2, incubator_basic: 1, egg_common: 1 },
  placedItems: [],
  rooms: {
    interior: { type: "interior", items: [], unlocked: true },
    garden: { type: "garden", items: [], unlocked: false },
  },
  currentRoom: "interior",
  pets: [],
  equippedPetId: null,
  tutorialStep: 0,
  completedTutorial: false,
};

// --- API Helpers ---
const api = {
  get: async (endpoint: string) => {
    const token = discordService.accessToken;
    if (!token) return null;
    const res = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return res.json();
  },
  post: async (endpoint: string, body: any) => {
    const token = discordService.accessToken;
    if (!token) return null;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    return res.ok ? res.json() : null;
  },
};

// Debounce save to prevent spamming server
let saveTimeout: any = null;
const debouncedSave = (state: UserState) => {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    api.post("/api/state", state);
  }, 2000);
};

// Local cache to keep UI responsive
let currentUserState: UserState | null = null;

export const MockBackend = {
  getUser: async (): Promise<UserState> => {
    if (!discordService.isReady) {
      try {
        await discordService.init();
      } catch (e) {
        console.error("Discord Init Error", e);
      }
    }

    const discordUser = discordService.user;
    const userId = discordUser?.id || "guest";
    const username = discordUser?.username || "Guest";

    // 1. Try fetch from server
    const serverState = await api.get("/api/state");

    let state: UserState;

    if (serverState) {
      state = serverState;
      // Merge missing fields if schema updated
      if (!state.rooms) state.rooms = INITIAL_STATE_TEMPLATE.rooms;
    } else {
      // New user
      state = { ...INITIAL_STATE_TEMPLATE, id: userId, username: username };
    }

    // Sync username from Discord
    if (state.username !== username) state.username = username;

    currentUserState = state;
    debouncedSave(state);
    return state;
  },

  // Game Logic Layer - Modifies local state immediately, then triggers save
  buyItem: async (
    itemId: string,
  ): Promise<{ success: boolean; message?: string; newState?: UserState }> => {
    if (!currentUserState) return { success: false, message: "Not loaded" };

    const state = cloneState(currentUserState);
    const item = ITEMS[itemId];
    if (!item) return { success: false, message: "Item not found" };

    if (item.currency === "gems") {
      if (state.gems >= item.price) {
        state.gems -= item.price;
        state.inventory[itemId] = (state.inventory[itemId] || 0) + 1;
      } else return { success: false, message: "Not enough Gems" };
    } else {
      if (state.coins >= item.price) {
        state.coins -= item.price;
        state.inventory[itemId] = (state.inventory[itemId] || 0) + 1;
        checkTutorial(state, "BUY_ITEM", itemId);
      } else return { success: false, message: "Not enough Coins" };
    }

    currentUserState = state;
    debouncedSave(state);
    return { success: true, newState: state };
  },

  placeItem: async (
    itemId: string,
    x: number,
    y: number,
    rotation: number,
  ): Promise<{ success: boolean; message?: string; newState?: UserState }> => {
    if (!currentUserState) return { success: false };
    const state = cloneState(currentUserState);

    if (!state.inventory[itemId])
      return { success: false, message: "No stock" };
    const items = state.rooms[state.currentRoom].items;
    if (items.some((i) => i.gridX === x && i.gridY === y))
      return { success: false, message: "Occupied" };

    state.inventory[itemId]--;
    items.push({
      id: crypto.randomUUID(),
      itemId,
      gridX: x,
      gridY: y,
      rotation,
      placedAt: Date.now(),
      meta: {},
      cropData: null,
    });

    checkTutorial(state, "PLACE_ITEM", itemId);
    currentUserState = state;
    debouncedSave(state);
    return { success: true, newState: state };
  },

  plantSeed: async (
    planterId: string,
    cropId: string,
  ): Promise<{ success: boolean; message?: string; newState?: UserState }> => {
    if (!currentUserState) return { success: false };
    const state = cloneState(currentUserState);

    const planter = state.rooms[state.currentRoom].items.find(
      (i) => i.id === planterId,
    );
    const crop = CROPS[cropId];
    if (!planter || !crop || state.coins < crop.seedPrice)
      return { success: false, message: "Error" };

    state.coins -= crop.seedPrice;
    planter.cropData = { cropId, plantedAt: Date.now(), isReady: false };

    checkTutorial(state, "PLANT_SEED");
    currentUserState = state;
    debouncedSave(state);
    return { success: true, newState: state, message: "Planted!" };
  },

  harvestOrPickup: async (x: number, y: number): Promise<any> => {
    if (!currentUserState) return { success: false };
    const state = cloneState(currentUserState);
    const items = state.rooms[state.currentRoom].items;
    const index = items.findIndex((i) => i.gridX === x && i.gridY === y);
    if (index === -1) return { success: false };

    const item = items[index];
    const config = ITEMS[item.itemId];

    // Hatch
    if (config.type === ItemType.INCUBATOR && item.meta?.eggId) {
      const egg = EGGS[item.meta.eggId];
      const elapsed = (Date.now() - (item.meta.hatchStart || 0)) / 1000;
      if (elapsed >= egg.hatchTime) {
        const selectedPetId = weightedRandom(egg.pool);
        const petConfig = PETS[selectedPetId];
        const newPet = {
          id: crypto.randomUUID(),
          configId: selectedPetId,
          name: petConfig?.name || "Pet",
          level: 1,
          xp: 0,
          happiness: 100,
          acquiredAt: Date.now(),
        };
        state.pets.push(newPet);
        if (!state.equippedPetId) state.equippedPetId = newPet.id;
        item.meta = {};
        currentUserState = state;
        debouncedSave(state);
        return {
          success: true,
          newState: state,
          action: "hatch",
          message: "Hatched!",
        };
      }
      return { success: false, message: "Incubating..." };
    }

    // Harvest
    if (item.cropData) {
      const crop = CROPS[item.cropData.cropId];
      const elapsed = Date.now() - item.cropData.plantedAt;
      if (elapsed >= crop.growthTime * 1000) {
        state.coins += crop.sellPrice;
        state.xp += crop.xpReward;
        item.cropData = null;
        checkLevelUp(state);
        checkTutorial(state, "HARVEST");
        currentUserState = state;
        debouncedSave(state);
        return {
          success: true,
          newState: state,
          action: "harvest",
          reward: crop.sellPrice,
        };
      }
      return { success: false, message: "Not ready" };
    }

    // Pickup
    state.inventory[item.itemId] = (state.inventory[item.itemId] || 0) + 1;
    items.splice(index, 1);
    currentUserState = state;
    debouncedSave(state);
    return { success: true, newState: state, action: "pickup" };
  },

  // Helpers
  triggerTutorial: async (action: string) => {
    if (!currentUserState) return currentUserState;
    const state = cloneState(currentUserState);
    checkTutorial(state, action);
    currentUserState = state;
    debouncedSave(state);
    return state;
  },

  visitNeighbor: async (id: string): Promise<UserState> => {
    // Fetch real state from server
    try {
      const data = await api.get(`/api/state/${id}`);
      if (data) return data;
    } catch (e) {
      console.error("Failed to fetch neighbor state:", e);
    }
    // Fallback: empty state with the ID
    return { ...INITIAL_STATE_TEMPLATE, id: id, username: "Neighbor" };
  },

  getNeighbors: async () => {
    const neighbors = await api.get("/api/neighbors");
    return neighbors || [];
  },

  // Stub methods for missing ops in this partial refactor
  waterNeighborPlant: async (neighborId: string, plantId: string) => ({
    success: true,
    message: "Watered!",
  }),

  buyPremiumCurrency: async (skuId: string) => {
    if (!currentUserState) return { success: false };
    const state = cloneState(currentUserState);
    const sku = SKUS.find((s) => s.id === skuId);
    if (sku) state.gems += sku.amount;
    currentUserState = state;
    debouncedSave(state);
    return { success: true, newState: state, message: "Bought!" };
  },

  equipPet: async (id: string) => {
    if (!currentUserState) return { success: false };
    const state = cloneState(currentUserState);
    state.equippedPetId = id;
    currentUserState = state;
    debouncedSave(state);
    return { success: true, newState: state };
  },

  switchRoom: async (type: RoomType) => {
    if (!currentUserState) return { success: false, message: "Not loaded" };
    if (type === "garden" && !currentUserState.rooms.garden.unlocked) {
      return { success: false, message: "Garden locked! Reach level 5." };
    }
    const state = cloneState(currentUserState);
    state.currentRoom = type;
    currentUserState = state;
    debouncedSave(state);
    return { success: true, newState: state };
  },

  useConsumable: async (itemId: string, x: number, y: number) => {
    if (!currentUserState) return { success: false, message: "Not loaded" };
    const state = cloneState(currentUserState);

    if ((state.inventory[itemId] || 0) <= 0) {
      return { success: false, message: "No stock" };
    }

    if (itemId === "fertilizer") {
      const item = state.rooms[state.currentRoom].items.find(
        (i) => i.gridX === x && i.gridY === y,
      );
      if (!item?.cropData) {
        return { success: false, message: "No plant here to fertilize!" };
      }
      state.inventory[itemId]--;
      const crop = CROPS[item.cropData.cropId];
      item.cropData.plantedAt = Date.now() - crop.growthTime * 1000 - 100;
    } else {
      state.inventory[itemId]--;
    }

    currentUserState = state;
    debouncedSave(state);
    return { success: true, newState: state, message: "Item Used" };
  },

  placeEgg: async (id: string, eggId: string) => {
    if (!currentUserState) return { success: false, message: "Not loaded" };
    const state = cloneState(currentUserState);
    const item = state.rooms[state.currentRoom].items.find((i) => i.id === id);
    if (item && state.inventory[eggId] > 0) {
      state.inventory[eggId]--;
      item.meta = { eggId, hatchStart: Date.now() };
      currentUserState = state;
      debouncedSave(state);
      return { success: true, newState: state };
    }
    return { success: false, message: "Cannot place egg" };
  },
};

const checkLevelUp = (state: UserState) => {
  let nextLevel = LEVELS.find((l) => l.level === state.level + 1);
  while (nextLevel && state.xp >= nextLevel.xpRequired) {
    state.level++;
    if (state.level >= 5) state.rooms.garden.unlocked = true;
    nextLevel = LEVELS.find((l) => l.level === state.level + 1);
  }
};

const checkTutorial = (state: UserState, action: string, targetId?: string) => {
  if (state.completedTutorial) return;
  const currentStepConfig = TUTORIAL_STEPS[state.tutorialStep];
  if (currentStepConfig && currentStepConfig.trigger === action) {
    if (currentStepConfig.targetId && currentStepConfig.targetId !== targetId)
      return;
    state.tutorialStep++;
    if (state.tutorialStep >= TUTORIAL_STEPS.length)
      state.completedTutorial = true;
  }
};
