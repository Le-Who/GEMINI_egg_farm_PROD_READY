import {
  UserState,
  PlacedItem,
  ItemType,
  PetData,
  NeighborProfile,
  RoomType,
  QuestConfig,
  QuestProgress,
} from "../types";
import {
  ITEMS,
  CROPS,
  LEVELS,
  EGGS,
  PETS,
  SKUS,
  TUTORIAL_STEPS,
  QUESTS,
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
  quests: [],
};

// --- Pet Bonus Helper (supports multi-ability) ---
function getEquippedPetBonus(state: UserState, bonusType: string): number {
  if (!state.equippedPetId) return 0;
  const pet = state.pets.find((p) => p.id === state.equippedPetId);
  if (!pet) return 0;
  const config = PETS[pet.configId];
  if (!config) return 0;

  // Prefer new multi-bonus array
  if (config.bonuses && config.bonuses.length > 0) {
    return config.bonuses
      .filter((b: any) => b.type === bonusType)
      .reduce((sum: number, b: any) => sum + b.value, 0);
  }
  // Fallback to legacy single bonus
  if (config.bonus && config.bonus.type === bonusType)
    return config.bonus.value;
  return 0;
}

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

export const GameEngine = {
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

    // OPTIMIZATION: If identical to current cached state, return cache to prevent re-renders
    if (
      currentUserState &&
      JSON.stringify(state) === JSON.stringify(currentUserState)
    ) {
      return currentUserState;
    }

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

    checkQuests(state, "BUY_ITEM", itemId);
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
    if (state.inventory[itemId] <= 0) delete state.inventory[itemId];
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
    // Apply pet growth_speed bonus: reduce effective growth time
    const growthBonus = getEquippedPetBonus(state, "growth_speed");
    const effectiveGrowthTime = crop.growthTime * (1 - growthBonus);
    planter.cropData = { cropId, plantedAt: Date.now(), isReady: false };
    // Store effective growth time as offset if pet bonus applies
    if (growthBonus > 0) {
      planter.cropData.plantedAt =
        Date.now() - (crop.growthTime - effectiveGrowthTime) * 1000;
    }

    checkTutorial(state, "PLANT_SEED");
    checkQuests(state, "PLANT_SEED", cropId);
    currentUserState = state;
    debouncedSave(state);
    return {
      success: true,
      newState: state,
      message:
        growthBonus > 0
          ? `Planted! (${Math.round(growthBonus * 100)}% faster)`
          : "Planted!",
    };
  },

  hatchEgg: async (x: number, y: number): Promise<any> => {
    if (!currentUserState) return { success: false };
    const state = cloneState(currentUserState);
    const items = state.rooms[state.currentRoom].items;
    const index = items.findIndex((i) => i.gridX === x && i.gridY === y);
    if (index === -1) return { success: false };

    const item = items[index];
    const config = ITEMS[item.itemId];

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
    return { success: false, message: "Not an incubator or egg" };
  },

  harvestCrop: async (x: number, y: number): Promise<any> => {
    if (!currentUserState) return { success: false };
    const state = cloneState(currentUserState);
    const items = state.rooms[state.currentRoom].items;
    const index = items.findIndex((i) => i.gridX === x && i.gridY === y);
    if (index === -1) return { success: false };

    const item = items[index];

    if (item.cropData) {
      const crop = CROPS[item.cropData.cropId];
      const harvestedCropId = item.cropData.cropId;
      const elapsed = Date.now() - item.cropData.plantedAt;
      if (elapsed >= crop.growthTime * 1000) {
        // Apply pet coin_reward and xp_reward bonuses
        const coinBonus = getEquippedPetBonus(state, "coin_reward");
        const xpBonus = getEquippedPetBonus(state, "xp_reward");
        const coinReward = Math.round(crop.sellPrice * (1 + coinBonus));
        const xpReward = Math.round(crop.xpReward * (1 + xpBonus));
        state.coins += coinReward;
        state.xp += xpReward;
        item.cropData = null;
        checkLevelUp(state);
        checkTutorial(state, "HARVEST");
        checkQuests(state, "HARVEST", harvestedCropId);
        currentUserState = state;
        debouncedSave(state);
        return {
          success: true,
          newState: state,
          action: "harvest",
          reward: coinReward,
        };
      }
      return { success: false, message: "Not ready" };
    }
    return { success: false, message: "No crop to harvest" };
  },

  pickupItem: async (x: number, y: number): Promise<any> => {
    if (!currentUserState) return { success: false };
    const state = cloneState(currentUserState);
    const items = state.rooms[state.currentRoom].items;
    const index = items.findIndex((i) => i.gridX === x && i.gridY === y);
    if (index === -1) return { success: false };

    const item = items[index];
    state.inventory[item.itemId] = (state.inventory[item.itemId] || 0) + 1;
    items.splice(index, 1);
    currentUserState = state;
    debouncedSave(state);
    return { success: true, newState: state, action: "pickup" };
  },

  harvestOrPickup: async (x: number, y: number): Promise<any> => {
    if (!currentUserState) return { success: false };
    const items = currentUserState.rooms[currentUserState.currentRoom].items;
    const item = items.find((i) => i.gridX === x && i.gridY === y);
    if (!item) return { success: false };

    const config = ITEMS[item.itemId];

    // Hatch
    if (config.type === ItemType.INCUBATOR && item.meta?.eggId) {
      return GameEngine.hatchEgg(x, y);
    }

    // Harvest
    if (item.cropData) {
      return GameEngine.harvestCrop(x, y);
    }

    // Pickup
    return GameEngine.pickupItem(x, y);
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

  // Social features
  waterNeighborPlant: async (neighborId: string, plantId: string) => {
    try {
      const token = discordService.accessToken;
      const res = await fetch(`/api/interact/${neighborId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "WATER", targetItemId: plantId }),
      });
      const data = await res.json();
      if (res.ok) return { success: true, message: data.message };
      return { success: false, message: data.error || "Could not water" };
    } catch (e) {
      return { success: false, message: "Network error" };
    }
  },

  acknowledgeEchoMarks: async (): Promise<{
    acknowledged_count: number;
    summary?: Record<string, Record<string, number>>;
    details?: any[];
  }> => {
    try {
      const token = discordService.accessToken;
      const res = await fetch("/api/echo/acknowledge", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (res.ok) return await res.json();
      return { acknowledged_count: 0 };
    } catch (e) {
      return { acknowledged_count: 0 };
    }
  },

  buyPremiumCurrency: async (skuId: string) => {
    if (!currentUserState) return { success: false };
    const state = cloneState(currentUserState);
    const sku = SKUS.find((s) => s.id === skuId);
    if (!sku) return { success: false, message: "SKU not found" };

    // New rewards system (preferred)
    if (sku.rewards) {
      if (sku.rewards.coins) state.coins += sku.rewards.coins;
      if (sku.rewards.gems) state.gems += sku.rewards.gems;
      if (sku.rewards.items) {
        for (const [itemId, count] of Object.entries(sku.rewards.items)) {
          state.inventory[itemId] =
            (state.inventory[itemId] || 0) + (count as number);
        }
      }
    } else {
      // Legacy: amount = gems only
      state.gems += sku.amount;
    }

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
      // Check if crop is already fully grown
      const crop = CROPS[item.cropData.cropId];
      const elapsed = Date.now() - item.cropData.plantedAt;
      if (elapsed >= crop.growthTime * 1000) {
        return { success: false, message: "Already fully grown!" };
      }
      state.inventory[itemId]--;
      if (state.inventory[itemId] <= 0) delete state.inventory[itemId];
      item.cropData.plantedAt = Date.now() - crop.growthTime * 1000 - 100;
    } else {
      state.inventory[itemId]--;
      if (state.inventory[itemId] <= 0) delete state.inventory[itemId];
    }

    currentUserState = state;
    debouncedSave(state);
    return { success: true, newState: state, message: "Item Used" };
  },

  applyDye: async (
    placedItemId: string,
    dyeItemId: string | null,
  ): Promise<{ success: boolean; message?: string; newState?: UserState }> => {
    if (!currentUserState) return { success: false, message: "Not loaded" };
    const state = cloneState(currentUserState);

    const placedItem = state.rooms[state.currentRoom].items.find(
      (i) => i.id === placedItemId,
    );
    if (!placedItem) return { success: false, message: "Item not found" };

    const itemConfig = ITEMS[placedItem.itemId];
    if (
      !itemConfig ||
      (itemConfig.type !== ItemType.FURNITURE &&
        itemConfig.type !== ItemType.DECORATION)
    ) {
      return { success: false, message: "Can only dye furniture/decorations" };
    }

    if (dyeItemId === null) {
      // Clear tint (free)
      placedItem.tint = null;
    } else {
      const dyeConfig = ITEMS[dyeItemId];
      if (!dyeConfig || dyeConfig.type !== ItemType.DYE) {
        return { success: false, message: "Invalid dye" };
      }
      if ((state.inventory[dyeItemId] || 0) <= 0) {
        return { success: false, message: "No dye in inventory" };
      }
      state.inventory[dyeItemId]--;
      if (state.inventory[dyeItemId] <= 0) delete state.inventory[dyeItemId];
      // Parse hex string to number
      const tintColor =
        typeof dyeConfig.dyeColor === "string"
          ? parseInt(dyeConfig.dyeColor.replace("0x", ""), 16)
          : dyeConfig.dyeColor;
      placedItem.tint = tintColor;
    }

    currentUserState = state;
    debouncedSave(state);
    return { success: true, newState: state, message: "Dye applied!" };
  },

  placeEgg: async (id: string, eggId: string) => {
    if (!currentUserState) return { success: false, message: "Not loaded" };
    const state = cloneState(currentUserState);
    const item = state.rooms[state.currentRoom].items.find((i) => i.id === id);
    const itemConfig = item ? ITEMS[item.itemId] : null;
    if (
      item &&
      itemConfig?.type === ItemType.INCUBATOR &&
      state.inventory[eggId] > 0
    ) {
      state.inventory[eggId]--;
      if (state.inventory[eggId] <= 0) delete state.inventory[eggId];
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

// --- Quest System ---
const checkQuests = (state: UserState, action: string, targetId?: string) => {
  if (!state.quests) state.quests = [];
  const allQuests = QUESTS;
  if (!allQuests || typeof allQuests !== "object") return;

  for (const quest of Object.values(allQuests) as any[]) {
    if (!quest?.id || !quest?.condition) continue;

    // Skip completed non-repeatable quests
    const existing = state.quests.find((q) => q.questId === quest.id);
    if (existing?.completed && !quest.repeatable) continue;

    // Check requirements (level >= minLevel, level <= maxLevel if set)
    if (quest.requirements) {
      if (
        quest.requirements.minLevel &&
        state.level < quest.requirements.minLevel
      )
        continue;
      if (
        quest.requirements.maxLevel &&
        state.level > quest.requirements.maxLevel
      )
        continue;
    }

    // Check if action matches condition
    if (quest.condition.type !== action) continue;
    if (quest.condition.targetId && quest.condition.targetId !== targetId)
      continue;

    // Update progress
    let progress: QuestProgress = existing || {
      questId: quest.id,
      progress: 0,
      completed: false,
    };
    if (!existing) state.quests.push(progress);

    progress.progress++;

    // Check completion
    if (progress.progress >= quest.condition.count && !progress.completed) {
      progress.completed = true;
      progress.completedAt = Date.now();

      // Grant rewards
      if (quest.rewards) {
        if (quest.rewards.coins) state.coins += quest.rewards.coins;
        if (quest.rewards.gems) state.gems += quest.rewards.gems;
        if (quest.rewards.xp) {
          state.xp += quest.rewards.xp;
          checkLevelUp(state);
        }
        if (quest.rewards.items) {
          for (const [itemId, count] of Object.entries(quest.rewards.items)) {
            state.inventory[itemId] =
              (state.inventory[itemId] || 0) + (count as number);
          }
        }
      }
    }
  }
};
