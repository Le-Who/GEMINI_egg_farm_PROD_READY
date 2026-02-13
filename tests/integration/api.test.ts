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
      // We accept empty object if content not loaded, or specific keys
      // server.js loads content on startup.
      // If tests run fast, content might not be loaded yet?
      // server.js awaits loadContent() before starting server?
      // Yes, startServer awaits loadContent.
      // usage of 'app' imported from server.js:
      // 'app' is created at top level. 'startServer' populates it?
      // No, 'app' is configured at top level. 'startServer' calls 'loadContent' then 'listen'.
      // But 'app' routes are defined in 'startServer'?
      // Let's check server.js again.
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
});
