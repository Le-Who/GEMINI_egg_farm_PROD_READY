import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import request from "supertest";

// Mock node-fetch
vi.mock("node-fetch", async () => {
  return {
    default: vi.fn(),
  };
});
import fetch from "node-fetch";

// Import server AFTER mock
import { app, startServer } from "../../server";

describe("Billboard Security", () => {
  const MOCK_TOKEN = "valid-token";
  const MOCK_USER_ID = "attacker-id";
  const TARGET_USER_ID = "target-id";
  let server: any;

  beforeAll(async () => {
    server = await startServer(0);
  });

  afterAll(() => {
    if (server) server.close();
  });

  it("should sanitize billboard messages (remove special characters)", async () => {
    // Mock Auth for both users
    const TARGET_TOKEN = "target-token";

    (fetch as any).mockImplementation((url: string, opts: any) => {
        const auth = opts?.headers?.Authorization;
        if (url === "https://discord.com/api/users/@me") {
            if (auth === `Bearer ${TARGET_TOKEN}`) {
                return Promise.resolve({ ok: true, json: async () => ({ id: TARGET_USER_ID, username: "Target" }) });
            }
            if (auth === `Bearer ${MOCK_TOKEN}`) {
                return Promise.resolve({ ok: true, json: async () => ({ id: MOCK_USER_ID, username: "Attacker" }) });
            }
        }
        return Promise.resolve({ ok: false });
    });

    // 1. Create Target User
    await request(app)
      .post("/api/state")
      .set("Authorization", `Bearer ${TARGET_TOKEN}`)
      .send({
        id: TARGET_USER_ID,
        username: "Target",
        coins: 100, gems: 0, xp: 0, level: 1,
        inventory: {},
        rooms: { interior: { type: "interior", items: [], unlocked: true }, garden: { type: "garden", items: [], unlocked: true } },
        currentRoom: "interior",
        pets: [], quests: [], tutorialStep: 0, completedTutorial: false, billboard: []
      });

    // 2. Attacker sends malicious message
    // Input: "Hello <script>alert('XSS')</script>! It's a co-op game."
    // Expected Regex: /[^a-zA-Z0-9\s.,!?'"-]/g
    // Result: "Hello scriptalert'XSS'script! It's a co-op game."
    const maliciousMessage = "Hello <script>alert('XSS')</script>! It's a co-op game.";
    const expectedSanitized = "Hello scriptalert'XSS'script! It's a co-op game.";

    const res = await request(app)
      .post(`/api/billboard/${TARGET_USER_ID}`)
      .set("Authorization", `Bearer ${MOCK_TOKEN}`)
      .send({
        sticker: "heart",
        message: maliciousMessage,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // 3. Verify sanitization in response
    const entry = res.body.billboard.find((e: any) => e.fromId === MOCK_USER_ID);
    expect(entry).toBeDefined();
    expect(entry.message).toBe(expectedSanitized);
  });
});
