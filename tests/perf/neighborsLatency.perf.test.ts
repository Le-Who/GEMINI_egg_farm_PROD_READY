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
  download: vi.fn().mockRejectedValue(new Error("File not found")),
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
  const NUM_USERS = 50000;

  beforeAll(async () => {
    // Setup temp environment
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "perf-neighbor-test-"));
    process.env.DATA_DIR = path.join(tmpDir, "data");
    process.env.GCS_BUCKET = "test-bucket";
    process.env.ADMIN_PASSWORD = "admin";

    // Create DATA_DIR
    fs.mkdirSync(process.env.DATA_DIR, { recursive: true });

    // Explicitly set DB_PATH to ensure server picks it up
    process.env.DB_PATH = path.join(process.env.DATA_DIR, "db.json");

    // Generate large db.json
    const db: Record<string, any> = {};
    for (let i = 0; i < NUM_USERS; i++) {
      const id = `user_${i}`;
      db[id] = {
        id,
        username: `User ${i}`,
        level: Math.floor(Math.random() * 10) + 1,
      };
    }
    // Also add the requester
    db["perf-test-user"] = {
      id: "perf-test-user",
      username: "PerfTester",
      level: 5,
    };

    fs.writeFileSync(process.env.DB_PATH, JSON.stringify(db));
    console.log(`Wrote ${Object.keys(db).length} users to ${process.env.DB_PATH}`);

    // Dynamic import server
    const mod = await import("../../server.js");
    app = mod.app;

    // Spy on listen to prevent actual port binding issues in parallel tests
    vi.spyOn(app, "listen").mockImplementation(((port: any, cb: any) => {
      if (cb) cb();
      return { close: vi.fn() };
    }) as any);

    await mod.startServer();
  });

  afterAll(() => {
    vi.restoreAllMocks();
    if (tmpDir) {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch (e) {}
    }
  });

  it("GET /api/neighbors (authenticated) — < 10ms p95 with 50k users", async () => {
    // Mock Discord token validation
    const fetchMod = await import("node-fetch");
    (fetchMod.default as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "perf-test-user",
        username: "PerfTester",
        discriminator: "0000",
      }),
    });

    // Warmup requests to populate neighborCache
    await request(app)
        .get("/api/neighbors")
        .set("Authorization", "Bearer mock-token");

    const result = await measureAsync(async () => {
      await request(app)
        .get("/api/neighbors")
        .set("Authorization", "Bearer mock-token")
        .expect(200);
    }, 50);

    // Assert budget. Optimized: ~4ms. Budget: 10ms.
    assertBudget("GET /api/neighbors", result, 10_000);
  });
});
