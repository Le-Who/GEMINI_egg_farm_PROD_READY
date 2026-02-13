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
    planter_basic: { id: "planter_basic", type: "PLANTER", price: 50 },
    chair_wood: { id: "chair_wood", type: "FURNITURE", price: 100 },
    seed_strawberry: { id: "seed_strawberry", type: "PLANTER", price: 10 },
    incubator_basic: { id: "incubator_basic", type: "INCUBATOR", price: 200 },
    egg_common: { id: "egg_common", type: "EGG", price: 100 },
    water_can: { id: "water_can", type: "CONSUMABLE", price: 0 },
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
      pool: [{ petId: "cat_orange", weight: 100 }],
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

  describe("hatchEgg", () => {
    it("should hatch an egg when ready", async () => {
      // Place incubator
      const placeRes = await GameEngine.placeItem("incubator_basic", 7, 7, 0);
      const incubatorId = placeRes.newState?.rooms.interior.items.find(
        (i) => i.gridX === 7 && i.gridY === 7,
      )?.id;

      // Place egg
      await GameEngine.placeEgg(incubatorId!, "egg_common");

      // Fast forward time
      const realDateNow = Date.now.bind(global.Date);
      const futureTime = realDateNow() + 70000; // +70s (hatch time 60s)
      vi.spyOn(global.Date, "now").mockReturnValue(futureTime);

      const res = await GameEngine.hatchEgg(7, 7);
      expect(res.success).toBe(true);
      expect(res.action).toBe("hatch");
      expect(res.newState?.pets.length).toBeGreaterThan(0);

      vi.restoreAllMocks();
    });

    it("should not hatch if not ready", async () => {
      // Place incubator
      const placeRes = await GameEngine.placeItem("incubator_basic", 8, 8, 0);
      const incubatorId = placeRes.newState?.rooms.interior.items.find(
        (i) => i.gridX === 8 && i.gridY === 8,
      )?.id;

      // Place egg
      await GameEngine.placeEgg(incubatorId!, "egg_common");

      const res = await GameEngine.hatchEgg(8, 8);
      expect(res.success).toBe(false);
      expect(res.message).toBe("Incubating...");
    });
  });

  describe("harvestCrop", () => {
    it("should harvest a ready crop", async () => {
      // Place planter
      const placeRes = await GameEngine.placeItem("planter_basic", 1, 1, 0);
      const planterId = placeRes.newState?.rooms.interior.items.find(
        (i) => i.gridX === 1 && i.gridY === 1,
      )?.id;

      // Plant seed
      await GameEngine.plantSeed(planterId!, "strawberry");

      // Fast forward
      const realDateNow = Date.now.bind(global.Date);
      const futureTime = realDateNow() + 20000;
      vi.spyOn(global.Date, "now").mockReturnValue(futureTime);

      const res = await GameEngine.harvestCrop(1, 1);
      expect(res.success).toBe(true);
      expect(res.action).toBe("harvest");
      expect(res.reward).toBeGreaterThan(0);

      vi.restoreAllMocks();
    });

    it("should not harvest if not ready", async () => {
      // Place planter
      const placeRes = await GameEngine.placeItem("planter_basic", 2, 2, 0);
      const planterId = placeRes.newState?.rooms.interior.items.find(
        (i) => i.gridX === 2 && i.gridY === 2,
      )?.id;

      // Plant seed
      await GameEngine.plantSeed(planterId!, "strawberry");

      const res = await GameEngine.harvestCrop(2, 2);
      expect(res.success).toBe(false);
      expect(res.message).toBe("Not ready");
    });
  });

  describe("pickupItem", () => {
    it("should pickup an item", async () => {
      // Ensure user has the item
      const user = await GameEngine.getUser();
      user.inventory["chair_wood"] = 1;

      await GameEngine.placeItem("chair_wood", 3, 3, 0);

      const res = await GameEngine.pickupItem(3, 3);
      expect(res.success).toBe(true);
      expect(res.action).toBe("pickup");
      expect(res.newState?.rooms.interior.items.find((i) => i.gridX === 3 && i.gridY === 3)).toBeUndefined();
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
});
