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

describe("Vulnerability Reproduction", () => {
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
    server = await startServer(0);
  });

  afterAll(() => {
    if (server) server.close();
  });

  it("should currently accept arbitrary state structure (vulnerable)", async () => {
    // Malicious state with unexpected fields and types
    const maliciousState = {
        id: MOCK_USER_ID,
        username: "Hacker",
        coins: "NOT_A_NUMBER", // Type mismatch
        isAdmin: true, // Injected field
        inventory: "INVALID_INVENTORY", // Type mismatch
        rooms: {
            interior: {
                items: [{
                    id: "item_1",
                    itemId: "malicious_item",
                    gridX: -100, // Invalid coordinate
                    gridY: 1000,
                    rotation: 0,
                    placedAt: Date.now()
                }]
            }
        },
        unexpectedField: "This should not be here"
    };

    const res = await request(app)
      .post("/api/state")
      .set("Authorization", `Bearer ${MOCK_TOKEN}`)
      .send(maliciousState);

    // New behavior: It rejects it.
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid state");
  });
});
