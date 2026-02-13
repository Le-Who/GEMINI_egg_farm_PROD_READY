import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import request from "supertest";
import fs from "fs";
import path from "path";
import os from "os";

// Mock node-fetch
vi.mock("node-fetch", async () => {
  return {
    default: vi.fn(),
  };
});
import fetch from "node-fetch";

// Mock dotenv
vi.mock("dotenv", () => ({
  default: { config: vi.fn() },
  config: vi.fn(),
}));

// Mock @google-cloud/storage
const mockBucketSave = vi.fn();
const mockBucketFileObj = {
  save: mockBucketSave,
  download: vi.fn().mockImplementation((path) => {
    // Return empty array for content/items.json or sprites or db.json
    return Promise.resolve([Buffer.from("[]")]);
  }),
  delete: vi.fn(),
};
const mockBucketFile = vi.fn(() => mockBucketFileObj);
const mockBucketGetFiles = vi.fn().mockResolvedValue([[]]);

const mockStorageInstance = {
  bucket: vi.fn(() => ({
    file: mockBucketFile,
    getFiles: mockBucketGetFiles,
  })),
};

vi.mock("@google-cloud/storage", () => {
  return {
    Storage: class {
      constructor() {
        return mockStorageInstance;
      }
    },
  };
});

describe("GCS Refactor Verification", () => {
  let app;
  let startServer;
  let tmpDir;

  beforeAll(async () => {
    // Setup temp environment
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "discord-garden-test-"));
    process.env.DATA_DIR = path.join(tmpDir, "data");
    process.env.SPRITES_DIR = path.join(tmpDir, "sprites");
    process.env.GCS_BUCKET = "test-bucket";
    process.env.ADMIN_PASSWORD = "admin";

    // Create dirs
    fs.mkdirSync(process.env.DATA_DIR, { recursive: true });
    fs.mkdirSync(process.env.SPRITES_DIR, { recursive: true });

    // Dynamic import to ensure mocks and env vars are respected
    const mod = await import("../../server.js");
    app = mod.app;
    startServer = mod.startServer;

    // Mock app.listen to prevent actual binding
    vi.spyOn(app, "listen").mockImplementation(((port: any, cb: any) => {
      if (cb) cb();
      return { close: vi.fn() };
    }) as any);

    await startServer();
  });

  afterAll(() => {
    vi.restoreAllMocks();
    if (tmpDir) {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch (e) {}
    }
  });

  it("should use gcsWriteBuffer for sprites upload", async () => {
    const spriteData = Buffer.from("fake-image-data").toString("base64");
    const res = await request(app)
      .post("/admin/api/sprites")
      .set("Authorization", "Bearer admin")
      .send({
        filename: "test.png",
        data: spriteData,
      });

    expect(res.status).toBe(200);
    expect(mockBucketFile).toHaveBeenCalledWith("sprites/test.png");

    // Verify save was called with buffer and correct options
    expect(mockBucketSave).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({
        contentType: "image/png",
        resumable: false,
      }),
    );
  });

  it("should use gcsWrite for content update", async () => {
    // This triggers saveContent -> gcsWrite
    const res = await request(app)
      .put("/admin/api/content/items")
      .set("Authorization", "Bearer admin")
      .send({ item1: { name: "Test Item" } });

    expect(res.status).toBe(200);
    expect(mockBucketFile).toHaveBeenCalledWith("content/items.json");

    // Verify save was called with content string and correct options (default json)
    expect(mockBucketSave).toHaveBeenCalledWith(
      expect.stringContaining('"item1": {'),
      expect.objectContaining({
        contentType: "application/json",
        resumable: false,
      }),
    );
  });
});
