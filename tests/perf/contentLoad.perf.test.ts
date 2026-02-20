/**
 * Content Load Performance Test
 *
 * Measures loadContent() and saveContent() performance using
 * real filesystem I/O in a temporary directory.
 *
 * Scenarios:
 *   1. Cold load (local files) — < 200ms p95
 *   2. Warm load (cached FS)  — < 100ms p95
 *   3. Save single type       — < 50ms p95
 *   4. Full save cycle        — < 200ms p95
 */
import {
  describe,
  it,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
  expect,
} from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { measureAsync, assertBudget } from "./perfUtils";

// Mock GCS — return null (force local fallback)
vi.mock("../../server/storage.js", () => ({
  gcsRead: vi.fn().mockResolvedValue(null),
  gcsWrite: vi.fn().mockResolvedValue(undefined),
}));

// Import after mocking
import {
  initContentManager,
  loadContent,
  saveContent,
  getContentCache,
  CONTENT_TYPES,
} from "../../server/contentManager.js";

describe("Content Load Performance", () => {
  let tmpDir: string;
  let contentDir: string;

  // Generate realistic content data for each type
  function seedContentFiles() {
    const items: Record<string, any> = {};
    for (let i = 0; i < 20; i++) {
      items[`item_${i}`] = {
        id: `item_${i}`,
        name: `Test Item ${i}`,
        type: i % 3 === 0 ? "PLANTER" : "FURNITURE",
        price: 50 + i * 10,
        color: 0x996633,
        width: 1,
        height: 1,
        description: `Test item description ${i} with some length`,
      };
    }

    const crops: Record<string, any> = {};
    for (let i = 0; i < 5; i++) {
      crops[`crop_${i}`] = {
        id: `crop_${i}`,
        name: `Crop ${i}`,
        seedPrice: 10 + i * 5,
        sellPrice: 30 + i * 15,
        growthTime: 30 + i * 30,
        xpReward: 5 + i * 3,
        levelReq: i + 1,
        color: 0x00ff00,
      };
    }

    const pets: Record<string, any> = {};
    for (let i = 0; i < 5; i++) {
      pets[`pet_${i}`] = {
        id: `pet_${i}`,
        name: `Pet ${i}`,
        rarity: i < 3 ? "common" : i < 4 ? "rare" : "legendary",
        color: 0xff9900,
        bonusDescription: `Bonus for pet ${i}`,
        bonuses: [{ type: "growth_speed", value: 0.05 * (i + 1) }],
      };
    }

    const eggs: Record<string, any> = {
      egg_common: {
        id: "egg_common",
        hatchTime: 60,
        pool: [
          { petId: "pet_0", weight: 60 },
          { petId: "pet_1", weight: 30 },
          { petId: "pet_2", weight: 10 },
        ],
      },
    };

    const levels = [
      { level: 1, xpRequired: 0, unlockItems: [] },
      { level: 2, xpRequired: 100, unlockItems: ["garden"] },
      { level: 3, xpRequired: 300, unlockItems: [] },
      { level: 4, xpRequired: 600, unlockItems: [] },
      { level: 5, xpRequired: 1000, unlockItems: [] },
    ];

    const tutorial = [
      { id: 0, text: "Welcome!", trigger: "SHOWN" },
      {
        id: 1,
        text: "Buy a planter",
        trigger: "BUY_ITEM",
        targetId: "planter_basic",
      },
    ];

    const skus = [
      {
        id: "sku_100",
        name: "100 Gems",
        price: "$0.99",
        amount: 100,
        icon: "gem.png",
      },
      {
        id: "sku_500",
        name: "500 Gems",
        price: "$3.99",
        amount: 500,
        icon: "gem.png",
      },
    ];

    const quests = [
      {
        id: "q1",
        title: "First Planting",
        description: "Plant your first seed",
        condition: { type: "PLANT_SEED", count: 1 },
        requirements: {},
        rewards: { coins: 100, xp: 50 },
        repeatable: false,
      },
    ];

    const contentMap: Record<string, any> = {
      items,
      crops,
      pets,
      eggs,
      levels,
      tutorial,
      skus,
      quests,
    };

    fs.mkdirSync(contentDir, { recursive: true });
    for (const [type, data] of Object.entries(contentMap)) {
      fs.writeFileSync(
        path.join(contentDir, `${type}.json`),
        JSON.stringify(data, null, 2),
      );
    }
  }

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "perf-content-test-"));
    contentDir = path.join(tmpDir, "content");
  });

  afterAll(() => {
    if (tmpDir) {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch (e) {}
    }
  });

  beforeEach(() => {
    // Re-seed content files for each test
    seedContentFiles();
    initContentManager(contentDir);
  });

  // ─── Scenario 1: Cold Load (local files) ─────────────────
  it("loadContent() cold load — < 200ms p95", async () => {
    const result = await measureAsync(async () => {
      await loadContent();
    }, 20);

    assertBudget("loadContent — cold (local)", result, 200_000);

    // Verify content was actually loaded
    const cache = getContentCache();
    expect(Object.keys(cache)).toHaveLength(CONTENT_TYPES.length);
  });

  // ─── Scenario 2: Warm Load ───────────────────────────────
  it("loadContent() warm load — < 100ms p95", async () => {
    // First load to warm FS cache
    await loadContent();

    const result = await measureAsync(async () => {
      await loadContent();
    }, 50);

    assertBudget("loadContent — warm (cached FS)", result, 100_000);
  });

  // ─── Scenario 3: Save Single Type ────────────────────────
  it("saveContent() single type — < 50ms p95", async () => {
    // Load first so cache is populated
    await loadContent();

    const result = await measureAsync(async () => {
      await saveContent("items");
    }, 50);

    assertBudget("saveContent — single type", result, 50_000);

    // Verify file was written
    const filePath = path.join(contentDir, "items.json");
    expect(fs.existsSync(filePath)).toBe(true);
  });

  // ─── Scenario 4: Full Save Cycle ─────────────────────────
  it("saveContent() all types — < 200ms p95", async () => {
    await loadContent();

    const result = await measureAsync(async () => {
      for (const type of CONTENT_TYPES) {
        await saveContent(type);
      }
    }, 20);

    assertBudget("saveContent — all 8 types", result, 200_000);
  });

  // ─── Scenario 5: Load with Missing Files ─────────────────
  it("loadContent() with missing files — < 150ms p95", async () => {
    // Delete some content files to test fallback-to-defaults path
    try {
      fs.unlinkSync(path.join(contentDir, "quests.json"));
      fs.unlinkSync(path.join(contentDir, "tutorial.json"));
      fs.unlinkSync(path.join(contentDir, "skus.json"));
    } catch (e) {}

    const result = await measureAsync(async () => {
      await loadContent();
    }, 20);

    assertBudget("loadContent — partial files", result, 150_000);

    // Verify defaults were applied
    const cache = getContentCache();
    expect(Array.isArray(cache.tutorial)).toBe(true);
  });
});
