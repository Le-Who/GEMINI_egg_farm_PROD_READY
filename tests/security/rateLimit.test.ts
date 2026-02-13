import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import request from "supertest";

// Mock node-fetch just in case, though not needed for /api/health
vi.mock("node-fetch", async () => {
  return {
    default: vi.fn(),
  };
});

import { app, startServer } from "../../server";

describe("Security: Rate Limiting", () => {
  let server: any;

  beforeAll(async () => {
    // Start server to attach routes
    server = await startServer(0);
  });

  afterAll(() => {
    if (server) server.close();
  });

  it("should enforce rate limits on API endpoints", async () => {
    // Send 130 requests to /api/health
    // The limit we plan to implement is 120 per minute.
    const REQUEST_COUNT = 130;
    const LIMIT = 120;

    let successCount = 0;
    let blockedCount = 0;

    for (let i = 0; i < REQUEST_COUNT; i++) {
      const res = await request(app).get("/api/health");
      if (res.status === 200) {
        successCount++;
      } else if (res.status === 429) {
        blockedCount++;
      }
    }

    console.log(`Requests: ${REQUEST_COUNT}, Success: ${successCount}, Blocked: ${blockedCount}`);

    // Since we haven't implemented it yet, we expect 130 successes and 0 blocks.
    // AFTER implementation, we expect ~120 successes and ~10 blocks.
    // So for this test to "fail initially", we assert that blockedCount > 0.

    expect(blockedCount).toBeGreaterThan(0);
    expect(successCount).toBeLessThanOrEqual(LIMIT + 5); // Allow small margin
  });
});
