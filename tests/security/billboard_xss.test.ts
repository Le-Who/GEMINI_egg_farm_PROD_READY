import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import request from "supertest";

// Mock node-fetch BEFORE importing server
vi.mock("node-fetch", async () => {
  return {
    default: vi.fn(),
  };
});
import fetch from "node-fetch";

// Import app after mock
import { app, startServer } from "../../server";

describe("Security: Billboard XSS", () => {
  const ATTACKER_TOKEN = "attacker-token";
  const ATTACKER_ID = "attacker-id";
  const TARGET_TOKEN = "target-token";
  const TARGET_ID = "target-id";
  let server: any;

  beforeAll(async () => {
    // Setup fetch mock for Discord Auth
    (fetch as any).mockImplementation((url: string, opts: any) => {
      const auth = opts?.headers?.Authorization;
      if (url === "https://discord.com/api/users/@me") {
        if (auth === `Bearer ${ATTACKER_TOKEN}`) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: ATTACKER_ID, username: "Attacker" }),
          });
        }
        if (auth === `Bearer ${TARGET_TOKEN}`) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: TARGET_ID, username: "Target" }),
          });
        }
      }
      return Promise.resolve({ ok: false });
    });

    server = await startServer(0);

    // Create Target User
    await request(app)
      .post("/api/state")
      .set("Authorization", `Bearer ${TARGET_TOKEN}`)
      .send({
        id: TARGET_ID,
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
        billboard: [],
      });
  });

  afterAll(() => {
    if (server) server.close();
  });

  it("should sanitize malicious input in billboard messages", async () => {
    const maliciousMessage = "Hello <script>alert(1)</script>";
    // Expected sanitization: remove non-alphanumeric/punctuation
    // < > / ( ) are removed.
    // "Hello scriptalert1script"

    const res = await request(app)
      .post(`/api/billboard/${TARGET_ID}`)
      .set("Authorization", `Bearer ${ATTACKER_TOKEN}`)
      .send({
        sticker: "heart",
        message: maliciousMessage,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Since the API returns the updated billboard array, we can check directly
    const billboard = res.body.billboard;
    const entry = billboard.find((e: any) => e.fromId === ATTACKER_ID);

    expect(entry).toBeDefined();

    // This assertion should FAIL if sanitization is missing
    expect(entry.message).not.toContain("<script>");
    expect(entry.message).toBe("Hello scriptalert1script");
  });

  it("should accept valid alphanumeric messages", async () => {
    const validMessage = "Hello World! 123.";
    const res = await request(app)
      .post(`/api/billboard/${TARGET_ID}`)
      .set("Authorization", `Bearer ${ATTACKER_TOKEN}`)
      .send({
        sticker: "star",
        message: validMessage,
      });

    expect(res.status).toBe(200);
    const billboard = res.body.billboard;
    // We might have multiple entries now, so find the one we just added
    // The billboard is LIFO or FIFO? server.js says push, so FIFO. reverse() in UI.
    // The api returns the array.
    const entry = billboard.find((e: any) => e.message === validMessage);
    expect(entry).toBeDefined();
  });
});
