/**
 * API Response Latency Performance Test
 *
 * Measures Express route handler response times using supertest
 * (in-process, no network overhead). GCS is mocked.
 *
 * Endpoints tested:
 *   1. GET  /api/health          — < 50ms p95
 *   2. GET  /api/content         — < 100ms p95
 *   3. GET  /api/content/version — < 20ms p95
 *   4. POST /api/state           — < 150ms p95
 */
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
  download: vi
    .fn()
    .mockImplementation(() => Promise.resolve([Buffer.from("[]")])),
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

describe("API Latency Performance", () => {
  let app: any;
  let tmpDir: string;

  beforeAll(async () => {
    // Setup temp environment
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "perf-api-test-"));
    process.env.DATA_DIR = path.join(tmpDir, "data");
    process.env.GCS_BUCKET = "test-bucket";
    process.env.ADMIN_PASSWORD = "admin";

    fs.mkdirSync(process.env.DATA_DIR, { recursive: true });

    // Dynamic import
    const mod = await import("../../server.js");
    app = mod.app;

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

  // ─── GET /api/health ─────────────────────────────────────
  it("GET /api/health — < 50ms p95", async () => {
    const result = await measureAsync(async () => {
      await request(app).get("/api/health").expect(200);
    }, 100);

    // Convert μs budget to ms → 50ms = 50,000μs
    assertBudget("GET /api/health", result, 50_000);
  });

  // ─── GET /api/content ────────────────────────────────────
  it("GET /api/content — < 100ms p95", async () => {
    const result = await measureAsync(async () => {
      await request(app).get("/api/content").expect(200);
    }, 100);

    assertBudget("GET /api/content", result, 100_000);
  });

  // ─── GET /api/content/version ────────────────────────────
  it("GET /api/content/version — < 20ms p95", async () => {
    const result = await measureAsync(async () => {
      await request(app).get("/api/content/version").expect(200);
    }, 100);

    assertBudget("GET /api/content/version", result, 20_000);
  });

  // ─── POST /api/state ─────────────────────────────────────
  it("POST /api/state (authenticated) — < 150ms p95", async () => {
    // Mock Discord token validation
    const fetchMod = await import("node-fetch");
    (fetchMod.default as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        user: { id: "perf-test-user", username: "PerfTester" },
      }),
    });

    const testState = {
      id: "perf-test-user",
      username: "PerfTester",
      discordId: "perf-test-user",
      coins: 1000,
      gems: 50,
      xp: 0,
      level: 1,
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
      completedTutorial: false,
      quests: [],
    };

    const result = await measureAsync(async () => {
      await request(app)
        .post("/api/state")
        .set("Authorization", "Bearer mock-token")
        .send(testState);
    }, 50);

    assertBudget("POST /api/state", result, 150_000);
  });
});
