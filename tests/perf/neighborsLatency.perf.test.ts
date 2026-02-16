import { describe, it, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import fs from "fs";
import path from "path";
import os from "os";
import { measureAsync, assertBudget } from "./perfUtils";

// Mock node-fetch
vi.mock("node-fetch", async () => ({
  default: vi.fn(),
}));

// Mock dotenv
vi.mock("dotenv", () => ({
  default: { config: vi.fn() },
  config: vi.fn(),
}));

// Mock @google-cloud/storage
const mockBucketFileObj = {
  save: vi.fn().mockResolvedValue(undefined),
  download: vi.fn().mockImplementation(async () => {
    const error: any = new Error("Not found");
    error.code = 404;
    throw error;
  }),
  delete: vi.fn(),
};

vi.mock("@google-cloud/storage", () => ({
  Storage: class {
    constructor() {
      return {
        bucket: vi.fn(() => ({
          file: vi.fn(() => mockBucketFileObj),
          getFiles: vi.fn().mockResolvedValue([[]]),
        })),
      };
    }
  },
}));

describe("Neighbors Latency Performance", () => {
  let app: any;
  let tmpDir: string;

  beforeAll(async () => {
    // Setup temp environment
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "perf-neighbors-test-"));
    process.env.DATA_DIR = path.join(tmpDir, "data");
    process.env.GCS_BUCKET = "test-bucket";
    process.env.ADMIN_PASSWORD = "admin";

    fs.mkdirSync(process.env.DATA_DIR, { recursive: true });

    // Override DB_PATH set by setup.ts
    process.env.DB_PATH = path.join(process.env.DATA_DIR, "db.json");

    // Generate db.json with 50,000 users
    console.log("Generating 50,000 users for performance test...");
    const dbData: Record<string, any> = {};
    for (let i = 0; i < 50000; i++) {
      const id = `user_${i}`;
      dbData[id] = {
        id,
        username: `User ${i}`,
        level: Math.floor(Math.random() * 10) + 1,
        coins: 100,
        gems: 0,
        xp: 0,
        inventory: {},
        placedItems: [],
        rooms: {
            interior: { type: "interior", items: [], unlocked: true },
            garden: { type: "garden", items: [], unlocked: false },
        },
        currentRoom: "interior",
        pets: [],
        equippedPetId: null,
        tutorialStep: 0,
        completedTutorial: true,
        quests: [],
        billboard: [],
      };
    }
    const dbPath = process.env.DB_PATH;
    console.log(`Writing DB to: ${dbPath}`);
    fs.writeFileSync(dbPath, JSON.stringify(dbData));

    // Dynamic import server
    const mod = await import("../../server.js");
    app = mod.app;

    vi.spyOn(app, "listen").mockImplementation(((port: any, cb: any) => {
      if (cb) cb();
      return { close: vi.fn() };
    }) as any);

    await mod.startServer();
  }, 60000); // increase timeout for db generation

  afterAll(() => {
    vi.restoreAllMocks();
    if (tmpDir) {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch (e) {}
    }
  });

  it("GET /api/neighbors (authenticated) — < 20ms p95 (Optimized)", async () => {
    // Mock Auth
    const fetchMod = await import("node-fetch");
    (fetchMod.default as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "user_0",
        username: "User 0",
      }),
    });

    // Make one initial request to populate the cache (which takes ~O(N))
    await request(app)
        .get("/api/neighbors")
        .set("Authorization", "Bearer mock-token");

    const result = await measureAsync(async () => {
      await request(app)
        .get("/api/neighbors")
        .set("Authorization", "Bearer mock-token")
        .expect(200)
        .expect((res) => {
             if (res.body.length !== 5) throw new Error("Expected 5 neighbors");
        });
    }, 50);

    // Optimized budget 20ms (20,000 us)
    assertBudget("GET /api/neighbors", result, 20_000);
  });
});
