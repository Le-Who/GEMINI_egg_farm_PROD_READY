import { describe, it, expect, vi, beforeEach } from "vitest";
import { GameEngine } from "../../services/gameEngine";
import { UserState } from "../../types";

// Mock Discord Service
vi.mock("../../services/discord", () => ({
  discordService: {
    accessToken: "mock-token",
    init: vi.fn(),
    isReady: true,
    user: { id: "123", username: "Tester" },
  },
}));

// Mock Content Loader
vi.mock("../../services/contentLoader", () => ({
  getItems: () => ({
    planter_basic: {
      id: "planter_basic",
      type: "PLANTER",
      price: 50,
      width: 1,
      height: 1,
      color: 0x996633,
      description: "Basic Planter",
    },
    chair_wood: {
      id: "chair_wood",
      type: "FURNITURE",
      price: 100,
      width: 1,
      height: 1,
      color: 0x664422,
      description: "Wooden Chair",
    },
    seed_strawberry: {
      id: "seed_strawberry",
      type: "PLANTER",
      price: 10,
      width: 1,
      height: 1,
      color: 0xff0000,
      description: "Strawberry Seed",
    },
    incubator_basic: {
      id: "incubator_basic",
      type: "INCUBATOR",
      price: 200,
      width: 1,
      height: 1,
      color: 0xffffff,
      description: "Incubator",
    },
    egg_common: {
      id: "egg_common",
      type: "EGG",
      price: 100,
      width: 1,
      height: 1,
      color: 0xffccaa,
      description: "Common Egg",
    },
    water_can: {
      id: "water_can",
      type: "CONSUMABLE",
      price: 0,
      width: 1,
      height: 1,
      color: 0x0000ff,
      description: "Water Can",
    },
    dye_red: {
      id: "dye_red",
      type: "DYE",
      price: 50,
      dyeColor: "0xFF0000",
      width: 1,
      height: 1,
      color: 0xff0000,
      description: "Red Dye",
    },
  }),
  getCrops: () => ({
    strawberry: {
      id: "strawberry",
      seedPrice: 20,
      growthTime: 10,
      sellPrice: 50,
      xpReward: 5,
    },
  }),
  getPets: () => ({
    cat_orange: {
      id: "cat_orange",
      name: "Orange Cat",
      bonuses: [{ type: "growth_speed", value: 0.1 }],
    },
  }),
  getEggs: () => ({
    egg_common: {
      id: "egg_common",
      hatchTime: 60,
      pool: { cat_orange: 100 },
    },
  }),
  getLevels: () => [
    { level: 1, xpRequired: 0, unlockItems: [] },
    { level: 2, xpRequired: 100, unlockItems: [] },
  ],
  getTutorial: () => [],
  getSkus: () => [],
  getQuests: () => [],
}));

// Mock API calls
global.fetch = vi.fn();

const MOCK_USER: UserState = {
  id: "test-user",
  username: "Tester",
  discordId: "123",
  coins: 1000,
  gems: 100,
  xp: 0,
  level: 1,
  inventory: {
    planter_basic: 5,
    seed_strawberry: 5,
    incubator_basic: 1,
    egg_common: 1,
    chair_wood: 1,
  },
  rooms: {
    interior: { type: "interior", items: [], unlocked: true },
    garden: { type: "garden", items: [], unlocked: false },
  },
  currentRoom: "interior",
  pets: [],
  tutorialStep: 10,
  completedTutorial: true,
  placedItems: [],
  quests: [],
  equippedPetId: null,
};

describe("GameEngine", () => {
  let user: UserState;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock Fetch for getUser
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => JSON.parse(JSON.stringify(MOCK_USER)),
    });

    // Initialize module-level currentUserState
    user = await GameEngine.getUser();
  });

  describe("buyItem", () => {
    it("should allow buying an item if sufficient funds", async () => {
      const res = await GameEngine.buyItem("planter_basic");

      if (!res.success) {
        console.error("Buy failed:", res.message);
      }
      expect(res.success).toBe(true);
      expect(res.newState?.coins).toBeLessThan(1000);
      expect(res.newState?.inventory["planter_basic"]).toBe(6); // Started with 5
    });

    it("should reject if insufficient funds", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ ...MOCK_USER, coins: 0 }),
      });
      await GameEngine.getUser(); // Re-init with 0 coins

      const res = await GameEngine.buyItem("planter_basic");
      expect(res.success).toBe(false);
      expect(res.message).toMatch(/not enough coins/i);
    });
  });

  describe("placeItem", () => {
    it("should place an item from inventory", async () => {
      const res = await GameEngine.placeItem("planter_basic", 5, 5, 0);
      expect(res.success).toBe(true);
      expect(res.newState?.inventory["planter_basic"]).toBe(4);
      expect(res.newState?.rooms.interior.items.length).toBe(1);
      expect(res.newState?.rooms.interior.items[0]).toMatchObject({
        itemId: "planter_basic",
        gridX: 5,
        gridY: 5,
      });
    });

    it("should fail if grid is occupied", async () => {
      await GameEngine.placeItem("planter_basic", 5, 5, 0);
      const res = await GameEngine.placeItem("planter_basic", 5, 5, 0);
      expect(res.success).toBe(false); // Occupied
    });
  });

  describe("plantSeed", () => {
    it("should plant a seed in a planter", async () => {
      // 1. Place a planter
      const placeRes = await GameEngine.placeItem("planter_basic", 2, 2, 0);
      const planterId = placeRes.newState?.rooms.interior.items[0].id;

      if (!planterId) throw new Error("Planter not placed");

      // 2. Plant seed - Using 'strawberry' as cropId
      const res = await GameEngine.plantSeed(planterId, "strawberry");

      if (!res.success) console.error("Plant failed:", res.message);

      expect(res.success).toBe(true);

      const planter = res.newState?.rooms.interior.items.find(
        (i) => i.id === planterId,
      );
      expect(planter?.cropData).toBeDefined();
      expect(planter?.cropData?.cropId).toBe("strawberry");
    });
  });

  describe("harvestOrPickup", () => {
    it("should pickup a non-crop item (Furniture)", async () => {
      await GameEngine.placeItem("planter_basic", 3, 3, 0);

      const res = await GameEngine.harvestOrPickup(3, 3);
      expect(res.success).toBe(true);
      expect(res.action).toBe("pickup");
      expect(res.newState?.inventory["planter_basic"]).toBe(5); // 5 (start) - 1 (place) + 1 (pickup) = 5
      expect(res.newState?.rooms.interior.items).toHaveLength(0);
    });

    it("should harvest a grown crop", async () => {
      // Place planter
      const placeRes = await GameEngine.placeItem("planter_basic", 4, 4, 0);
      const planterId = placeRes.newState?.rooms.interior.items.find(
        (i) => i.gridX === 4 && i.gridY === 4,
      )?.id;

      // Plant seed
      await GameEngine.plantSeed(planterId!, "strawberry");

      // Spy on Date.now to fast-forward
      const realDateNow = Date.now.bind(global.Date);
      const futureTime = realDateNow() + 20000; // +20s (strawberry takes 10s)
      vi.spyOn(global.Date, "now").mockReturnValue(futureTime);

      const res = await GameEngine.harvestOrPickup(4, 4);

      expect(res.success).toBe(true);
      expect(res.action).toBe("harvest");
      expect(res.newState?.coins).toBeGreaterThan(1000); // 1000 - cost + sellPrice

      // Restore Date
      vi.restoreAllMocks();
    });
  });

  describe("Pet System", () => {
    it("should incubate an egg", async () => {
      // Place incubator
      const placeRes = await GameEngine.placeItem("incubator_basic", 6, 6, 0);
      const incubatorId = placeRes.newState?.rooms.interior.items.find(
        (i) => i.gridX === 6 && i.gridY === 6,
      )?.id;

      // Place egg
      const res = await GameEngine.placeEgg(incubatorId!, "egg_common");
      expect(res.success).toBe(true);

      const incubator = res.newState?.rooms.interior.items.find(
        (i) => i.id === incubatorId,
      );
      expect(incubator?.meta).toBeDefined();
      expect(incubator?.meta?.eggId).toBe("egg_common");
    });

    it("should equip a pet", async () => {
      // Mock user having a pet
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          ...MOCK_USER,
          pets: [
            {
              instanceId: "pet_1",
              petId: "cat_orange",
              name: "Kitty",
              acquiredAt: Date.now(),
            },
          ],
        }),
      });
      await GameEngine.getUser();

      const res = await GameEngine.equipPet("pet_1");
      expect(res.success).toBe(true);
      expect(res.newState?.equippedPetId).toBe("pet_1");
    });
  });

  describe("applyDye", () => {
    it("should apply dye to furniture", async () => {
      // 1. Place a chair
      const placeRes = await GameEngine.placeItem("chair_wood", 2, 2, 0);
      const chairId = placeRes.newState?.rooms.interior.items.find(
        (i) => i.gridX === 2 && i.gridY === 2,
      )?.id;

      if (!chairId) throw new Error("Chair not placed");

      // 2. Add dye to inventory
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          ...MOCK_USER,
          inventory: { ...MOCK_USER.inventory, dye_red: 1, chair_wood: 0 },
          rooms: placeRes.newState?.rooms, // Keep placed item
        }),
      });
      // Re-fetch user to update inventory
      await GameEngine.getUser();

      // 3. Apply Dye
      const res = await GameEngine.applyDye(chairId, "dye_red");

      expect(res.success).toBe(true);
      expect(res.message).toBe("Dye applied!");

      const chair = res.newState?.rooms.interior.items.find(
        (i) => i.id === chairId,
      );
      expect(chair?.tint).toBe(0xff0000);
      expect(res.newState?.inventory["dye_red"]).toBeUndefined(); // Should be consumed
    });

    it("should remove tint if dyeItemId is null", async () => {
      // 1. Place a chair
      const placeRes = await GameEngine.placeItem("chair_wood", 3, 3, 0);
      const chairId = placeRes.newState?.rooms.interior.items.find(
        (i) => i.gridX === 3 && i.gridY === 3,
      )?.id;

      // 2. Manually set tint on the item in state
      if (placeRes.newState?.rooms.interior.items[0]) {
        placeRes.newState.rooms.interior.items[0].tint = 0xff0000;
      }

      // Mock user state with tinted chair
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          ...MOCK_USER,
          rooms: placeRes.newState?.rooms,
        }),
      });
      await GameEngine.getUser();

      // 3. Remove Tint
      const res = await GameEngine.applyDye(chairId!, null);

      expect(res.success).toBe(true);
      const chair = res.newState?.rooms.interior.items.find(
        (i) => i.id === chairId,
      );
      expect(chair?.tint).toBeNull();
    });

    it("should fail if item not found", async () => {
      const res = await GameEngine.applyDye("non_existent_id", "dye_red");
      expect(res.success).toBe(false);
      expect(res.message).toBe("Item not found");
    });

    it("should fail if item is not furniture/decoration", async () => {
      // 1. Place a planter
      const placeRes = await GameEngine.placeItem("planter_basic", 4, 4, 0);
      const planterId = placeRes.newState?.rooms.interior.items.find(
        (i) => i.gridX === 4 && i.gridY === 4,
      )?.id;

      // 2. Try to dye it
      const res = await GameEngine.applyDye(planterId!, "dye_red");
      expect(res.success).toBe(false);
      expect(res.message).toBe("Can only dye furniture/decorations");
    });

    it("should fail if no dye in inventory", async () => {
      // 1. Place a chair
      const placeRes = await GameEngine.placeItem("chair_wood", 5, 5, 0);
      const chairId = placeRes.newState?.rooms.interior.items.find(
        (i) => i.gridX === 5 && i.gridY === 5,
      )?.id;

      // Ensure no dye
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          ...MOCK_USER,
          inventory: { ...MOCK_USER.inventory, dye_red: 0 },
          rooms: placeRes.newState?.rooms,
        }),
      });
      await GameEngine.getUser();

      const res = await GameEngine.applyDye(chairId!, "dye_red");
      expect(res.success).toBe(false);
      expect(res.message).toBe("No dye in inventory");
    });

    it("should fail if dyeItemId is invalid", async () => {
      // 1. Place a chair
      const placeRes = await GameEngine.placeItem("chair_wood", 6, 6, 0);
      const chairId = placeRes.newState?.rooms.interior.items.find(
        (i) => i.gridX === 6 && i.gridY === 6,
      )?.id;

      // Try to use a seed as dye
      const res = await GameEngine.applyDye(chairId!, "seed_strawberry");
      expect(res.success).toBe(false);
      expect(res.message).toBe("Invalid dye");
    });
  });
});
