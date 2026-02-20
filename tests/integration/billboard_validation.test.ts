import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import request from "supertest";

// Mock node-fetch BEFORE importing server
vi.mock("node-fetch", async () => {
  return {
    default: vi.fn(),
  };
});
import fetch from "node-fetch";

// Import app after mocking
import { app, startServer } from "../../server";

describe("Billboard Validation", () => {
  const TARGET_USER_ID = "target-user";
  const TARGET_TOKEN = "target-token";
  const ACTOR_USER_ID = "actor-user";
  const ACTOR_TOKEN = "actor-token";

  let server: any;

  beforeAll(async () => {
    // Setup fetch mock for Discord Auth
    (fetch as any).mockImplementation((url: string, options: any) => {
      const authHeader = options?.headers?.Authorization;

      if (url === "https://discord.com/api/users/@me") {
        if (authHeader === `Bearer ${TARGET_TOKEN}`) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: TARGET_USER_ID, username: "Target User" }),
          });
        }
        if (authHeader === `Bearer ${ACTOR_TOKEN}`) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: ACTOR_USER_ID, username: "Actor User" }),
          });
        }
        return Promise.resolve({ ok: false });
      }
      return Promise.resolve({ ok: false });
    });

    // Start server (port 0 = random free port)
    server = await startServer(0);

    // Initialize Target User state via API
    await request(app)
      .post("/api/state")
      .set("Authorization", `Bearer ${TARGET_TOKEN}`)
      .send({
        id: TARGET_USER_ID,
        username: "Target User",
        coins: 100,
        gems: 10,
        xp: 0,
        level: 1,
        inventory: {},
        rooms: {
          interior: { type: "interior", items: [], unlocked: true },
          garden: { type: "garden", items: [], unlocked: false },
        },
        currentRoom: "interior",
      });
  });

  afterAll(() => {
    if (server) server.close();
  });

  it("should accept valid billboard messages", async () => {
    const res = await request(app)
      .post(`/api/billboard/${TARGET_USER_ID}`)
      .set("Authorization", `Bearer ${ACTOR_TOKEN}`)
      .send({
        sticker: "heart",
        message: "Hello world! Nice garden. I'm - top-tier!",
      });

    expect(res.status).toBe(200);
    expect(res.body.billboard).toBeDefined();
    const entry = res.body.billboard.find((b: any) => b.message === "Hello world! Nice garden. I'm - top-tier!");
    expect(entry).toBeDefined();
  });

  it("should reject invalid characters in message", async () => {
    const res = await request(app)
      .post(`/api/billboard/${TARGET_USER_ID}`)
      .set("Authorization", `Bearer ${ACTOR_TOKEN}`)
      .send({
        sticker: "heart",
        message: "Hello <script>alert(1)</script>", // XSS attempt
      });

    expect(res.status).toBe(400); // Should fail validation
    // The error message depends on implementation, but checking status is key
  });

  it("should reject messages with disallowed symbols", async () => {
    const res = await request(app)
      .post(`/api/billboard/${TARGET_USER_ID}`)
      .set("Authorization", `Bearer ${ACTOR_TOKEN}`)
      .send({
        sticker: "heart",
        message: "Price: $100", // $ is not in allowlist [a-zA-Z0-9\s.,!?]
      });

    expect(res.status).toBe(400);
  });
});
