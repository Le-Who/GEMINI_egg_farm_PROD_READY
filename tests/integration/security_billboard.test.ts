import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import request from "supertest";

// Mock node-fetch
vi.mock("node-fetch", async () => {
  return {
    default: vi.fn(),
  };
});
import fetch from "node-fetch";

// Import app after mocking
import { app, startServer } from "../../server";

describe("Security Vulnerability Reproduction", () => {
  const MOCK_TOKEN = "valid-token";
  const TARGET_USER_ID = "target-user-id";
  const ATTACKER_USER_ID = "attacker-user-id";
  let server: any;

  beforeAll(async () => {
    // Setup fetch mock for Discord Auth
    (fetch as any).mockImplementation((url: string, opts: any) => {
      const auth = opts?.headers?.Authorization;
      if (url === "https://discord.com/api/users/@me") {
        if (auth === `Bearer ${MOCK_TOKEN}`) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: ATTACKER_USER_ID, username: "Attacker" }),
          });
        }
        // Mock target user auth for seeding
        if (auth === `Bearer target-token`) {
             return Promise.resolve({
            ok: true,
            json: async () => ({ id: TARGET_USER_ID, username: "Target" }),
          });
        }
      }
      return Promise.resolve({ ok: false });
    });

    server = await startServer(0);

    // Seed Target User
    await request(app)
        .post("/api/state")
        .set("Authorization", `Bearer target-token`)
        .send({
          id: TARGET_USER_ID,
          username: "Target",
          coins: 100,
          gems: 0,
          xp: 0,
          level: 1,
          inventory: {},
          rooms: {
            interior: { type: "interior", items: [], unlocked: true },
            garden: { type: "garden", items: [], unlocked: true },
          },
          currentRoom: "interior",
          pets: [],
          quests: [],
          tutorialStep: 0,
          completedTutorial: false,
          billboard: [],
        });
  });

  afterAll(() => {
    if (server) server.close();
  });

  it("should NOT crash or expose stack trace when sending non-string message", async () => {
    const res = await request(app)
      .post(`/api/billboard/${TARGET_USER_ID}`)
      .set("Authorization", `Bearer ${MOCK_TOKEN}`)
      .send({
        sticker: "heart",
        message: { malicious: "object" }, // Not a string!
      });

    // If vulnerable, this returns 500 and likely html stack trace
    // If fixed, it should return 400 or at least handle it gracefully

    if (res.status === 500) {
        console.log("Vulnerability confirmed: Server returned 500 on invalid input type");
        // We expect this to fail initially if we are asserting it handles it
        // But for repro, we just want to see it fail.
    }

    // We want to assert that it handles it GRACEFULLY (e.g. 400 Bad Request)
    expect(res.status).not.toBe(500);
    expect(res.status).toBe(400);
  });

  it("should sanitize input to prevent storage of control characters or pollution", async () => {
     const res = await request(app)
      .post(`/api/billboard/${TARGET_USER_ID}`)
      .set("Authorization", `Bearer ${MOCK_TOKEN}`)
      .send({
        sticker: "heart",
        message: "Bad <script>alert(1)</script>",
      });

      // Check if it was stored with tags stripped
      const userRes = await request(app).get(`/api/state/${TARGET_USER_ID}`);
      const billboard = userRes.body.billboard;
      const entry = billboard[billboard.length - 1];

      // If we implement sanitization, this should be cleaned
      // The current frontend regex keeps alphanumeric and punctuation only
      // So <script>... should be stripped or modified?
      // Actually frontend: .replace(/[^a-zA-Z0-9\s.,!?]/g, "")
      // So "<" and ">" are removed.
      // Expected: "Bad scriptalert1script"

      expect(entry.message).not.toContain("<script>");
      expect(entry.message).toBe("Bad scriptalert1script");
  });
});
