import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import request from "supertest";

// Mock node-fetch BEFORE importing server
vi.mock("node-fetch", async () => {
  return {
    default: vi.fn(),
  };
});
import fetch from "node-fetch";

// Now import app, which imports server.js
import { app, startServer } from "../../server";

describe("Billboard Validation", () => {
  const VISITOR_TOKEN = "visitor-token";
  const VISITOR_ID = "visitor-id";
  const TARGET_TOKEN = "target-token";
  const TARGET_ID = "target-id";
  let server: any;

  beforeAll(async () => {
    // Setup fetch mock for Discord Auth within the mocked node-fetch
    (fetch as any).mockImplementation((url: string, options: any) => {
      // Mock Discord Auth
      if (url === "https://discord.com/api/users/@me") {
        const authHeader = options?.headers?.Authorization || "";
        const token = authHeader.split(" ")[1];

        if (token === TARGET_TOKEN) {
            return Promise.resolve({
                ok: true,
                json: async () => ({ id: TARGET_ID, username: "Target User" }),
            });
        }

        // Default to visitor
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: VISITOR_ID,
            username: "Visitor User",
          }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    // Start server to attach routes
    server = await startServer(0);

    // Create a target user state so the billboard endpoint works
    // Use supertest to seed the target user
    await request(app)
      .post("/api/state")
      .set("Authorization", `Bearer ${TARGET_TOKEN}`)
      .send({
        id: TARGET_ID,
        username: "Target User",
        coins: 100,
        gems: 10,
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
        billboard: []
      });
  });

  afterAll(() => {
    if (server) server.close();
  });

  it("should fail when message contains invalid characters", async () => {
    // Attempt to post a message with <script> tag
    const res = await request(app)
      .post(`/api/billboard/${TARGET_ID}`)
      .set("Authorization", `Bearer ${VISITOR_TOKEN}`)
      .send({
        sticker: "heart",
        message: "Hello <script>alert(1)</script> world!"
      });

    // Expect 400 Bad Request due to invalid characters
    expect(res.status).toBe(400);
  });

  it("should succeed with valid characters", async () => {
    const res = await request(app)
      .post(`/api/billboard/${TARGET_ID}`)
      .set("Authorization", `Bearer ${VISITOR_TOKEN}`)
      .send({
        sticker: "heart",
        message: "Hello world! I'm happy."
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
