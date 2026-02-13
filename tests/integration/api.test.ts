import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

// Mock node-fetch BEFORE importing server
vi.mock("node-fetch", async () => {
  return {
    default: vi.fn(),
  };
});
import fetch from "node-fetch";
import request from "supertest";

// Now import app, which imports server.js, which imports node-fetch
import { app, startServer } from "../../server";

describe("API Integration", () => {
  const MOCK_TOKEN = "valid-token";
  const MOCK_USER_ID = "test-user-id";
  const TARGET_USER_ID = "target-user-id";
  let server: any;

  beforeAll(async () => {
    // Setup fetch mock for Discord Auth within the mocked node-fetch
    (fetch as any).mockImplementation((url: string) => {
      // Mock Discord Auth
      if (url === "https://discord.com/api/users/@me") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: MOCK_USER_ID,
            username: "Integration Tester",
          }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    // Start server to attach routes
    server = await startServer();
  });

  afterAll(() => {
    if (server) server.close();
  });

  describe("GET /api/health", () => {
    it("should return 200 OK", async () => {
      const res = await request(app).get("/api/health");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
    });
  });

  describe("GET /api/content", () => {
    it("should return game content", async () => {
      const res = await request(app).get("/api/content");
      expect(res.status).toBe(200);
    });
  });

  describe("POST /api/state", () => {
    it("should save user state", async () => {
      const state = {
        id: MOCK_USER_ID,
        username: "Integration Tester",
        coins: 100,
        gems: 10,
        level: 1,
        xp: 0,
        inventory: {},
        rooms: { interior: { items: [] } },
        currentRoom: "interior",
      };

      const res = await request(app)
        .post("/api/state")
        .set("Authorization", `Bearer ${MOCK_TOKEN}`)
        .send(state);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should fail without auth", async () => {
      const res = await request(app).post("/api/state").send({});
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/state/:id", () => {
    it("should retrieve saved state", async () => {
      const res = await request(app).get(`/api/state/${MOCK_USER_ID}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(MOCK_USER_ID);
    });
  });

  describe("POST /api/billboard/:userId", () => {
    // Setup: Create target user first
    beforeAll(async () => {
      const state = {
        id: TARGET_USER_ID,
        username: "Target User",
        coins: 100,
        inventory: {},
        rooms: { interior: { items: [] } },
        currentRoom: "interior",
        billboard: [],
      };
      // Use a backdoor or direct DB manipulation if possible, but for integration
      // we can cheat by mocking the auth for a second to save this user?
      // Or just let the main user post to themselves (forbidden)?
      // Wait, app logic says: "Can't sticker your own billboard".

      // We need to inject the target user into the DB.
      // Since `db` is not exported, we have to use the public API with a different mock token?
      // But our `fetch` mock is hardcoded to return MOCK_USER_ID.
      // We'll update the fetch mock to return dynamic ID based on token?
    });

    // Actually, let's keep it simple. The server app uses an in-memory Map `db`.
    // We can't easily access it from here to seed data without exporting it.
    // But we CAN use the `POST /api/state` endpoint to create a user, IF we can control the auth.

    it("should leave a sticker on a billboard", async () => {
      // 1. Hack: We need to put TARGET_USER_ID into the DB.
      // We can temporarily mock `fetch` to return TARGET_USER_ID when a specific token is used.
      const TARGET_TOKEN = "target-token";

      (fetch as any).mockImplementation((url: string, opts: any) => {
        const auth = opts?.headers?.Authorization;
        if (url === "https://discord.com/api/users/@me") {
          if (auth === `Bearer ${TARGET_TOKEN}`) {
            return Promise.resolve({
              ok: true,
              json: async () => ({ id: TARGET_USER_ID, username: "Target" }),
            });
          }
          return Promise.resolve({
            ok: true,
            json: async () => ({
              id: MOCK_USER_ID,
              username: "Integration Tester",
            }),
          });
        }
        return Promise.resolve({ ok: false });
      });

      // 2. Create Target User
      await request(app)
        .post("/api/state")
        .set("Authorization", `Bearer ${TARGET_TOKEN}`)
        .send({
          id: TARGET_USER_ID,
          username: "Target",
          billboard: [],
        });

      // 3. Main user leaves a sticker
      const res = await request(app)
        .post(`/api/billboard/${TARGET_USER_ID}`)
        .set("Authorization", `Bearer ${MOCK_TOKEN}`)
        .send({
          sticker: "heart",
          message: "Hello!",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.billboard).toHaveLength(1);
      expect(res.body.billboard[0].message).toBe("Hello!");
    });
  });
});
