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
  getPets: () => ({}),
  getEggs: () => ({}),
  getLevels: () => [],
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
  });
});
