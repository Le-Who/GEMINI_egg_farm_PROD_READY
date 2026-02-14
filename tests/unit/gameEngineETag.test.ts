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

// Mock Content Loader (minimal)
vi.mock("../../services/contentLoader", () => ({
  getItems: () => ({}),
  getCrops: () => ({}),
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
  inventory: {},
  rooms: {
    interior: { type: "interior", items: [], unlocked: true },
    garden: { type: "garden", items: [], unlocked: false },
  },
  currentRoom: "interior",
  pets: [],
  tutorialStep: 0,
  completedTutorial: false,
  placedItems: [],
  quests: [],
  equippedPetId: null,
};

describe("GameEngine ETag Optimization", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset GameEngine internal state if possible?
    // Since GameEngine is a singleton with module-level variables, we might need to reload it or rely on getUser behavior.
    // Ideally we would reset the cache, but it's private.
    // However, vitest isolation might help if we could re-import.
    // For now, we assume tests run in isolation or we adapt.
  });

  it("should use ETag caching to avoid parsing JSON and object comparison", async () => {
    // 1. First Request: Returns 200 + ETag
    const firstResponse = {
      ok: true,
      status: 200,
      headers: new Map([["ETag", '"v1"']]),
      json: vi.fn().mockResolvedValue(JSON.parse(JSON.stringify(MOCK_USER))),
    };

    (global.fetch as any).mockResolvedValueOnce(firstResponse);

    const user1 = await GameEngine.getUser();
    expect(user1.id).toBe("test-user");
    expect(firstResponse.json).toHaveBeenCalled(); // Parsed JSON

    // 2. Second Request: Should send If-None-Match and receive 304
    const secondResponse = {
      ok: true, // 304 is considered "ok" by some implementations? No, fetch.ok is false for 304?
      // Wait, native fetch returns ok=false for 304? No, status 200-299 is ok. 304 is redirection/not modified.
      // Actually, fetch.ok is true for 200-299. 304 is not ok.
      // But we will handle 304 specifically.
      status: 304,
      headers: new Map([["ETag", '"v1"']]),
      json: vi.fn(), // Should NOT be called
    };

    (global.fetch as any).mockResolvedValueOnce(secondResponse);

    const user2 = await GameEngine.getUser();

    // Verify fetch headers
    expect(global.fetch).toHaveBeenLastCalledWith(
      "/api/state",
      expect.objectContaining({
        headers: expect.objectContaining({
          "If-None-Match": '"v1"',
        }),
      }),
    );

    // Verify JSON was not parsed
    expect(secondResponse.json).not.toHaveBeenCalled();

    // Verify referential equality (Optimization)
    // user1 came from first request (parsed)
    // user2 came from cache (same object reference as user1 if correctly cached)
    expect(user2).toBe(user1);
  });

  it("should update cache when ETag changes", async () => {
    // 1. Setup initial state
    const response1 = {
      ok: true,
      status: 200,
      headers: new Map([["ETag", '"v1"']]),
      json: vi.fn().mockResolvedValue({ ...MOCK_USER, coins: 100 }),
    };
    (global.fetch as any).mockResolvedValueOnce(response1);
    const user1 = await GameEngine.getUser();
    expect(user1.coins).toBe(100);

    // 2. Change on server (different ETag)
    const response2 = {
      ok: true,
      status: 200,
      headers: new Map([["ETag", '"v2"']]),
      json: vi.fn().mockResolvedValue({ ...MOCK_USER, coins: 200 }),
    };
    (global.fetch as any).mockResolvedValueOnce(response2);

    const user2 = await GameEngine.getUser();

    // Verify header was sent (v1)
    expect(global.fetch).toHaveBeenCalledWith(
        "/api/state",
        expect.objectContaining({
            headers: expect.objectContaining({
                "If-None-Match": '"v1"',
            }),
        }),
    );

    expect(user2.coins).toBe(200);
    expect(user2).not.toBe(user1);
  });
});
