import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import request from "supertest";

// Mock node-fetch
vi.mock("node-fetch", async () => {
  return {
    default: vi.fn(),
  };
});
import fetch from "node-fetch";

// Import app
import { app, startServer } from "../../server";

describe("Security Integration: Path Traversal", () => {
  let server: any;

  beforeAll(async () => {
    // Start server to attach routes
    server = await startServer();
  });

  afterAll(() => {
    if (server) server.close();
  });

  describe("GET /sprites/:filename", () => {
    it("should prevent accessing files outside the sprites directory", async () => {
      // Attempt to access package.json via path traversal
      const res = await request(app).get("/sprites/..%2F..%2Fpackage.json");

      // Should result in Forbidden or Bad Request, NOT 200 OK
      expect(res.status).not.toBe(200);
      expect([400, 403, 404]).toContain(res.status);
    });

    it("should allow accessing valid sprite files (if they exist)", async () => {
      // We don't have a guaranteed file, but we can try a non-traversal path
      // which should 404 if not found, but NOT 403.
      const res = await request(app).get("/sprites/valid_looking_file.png");

      // It will likely be 404 because the file doesn't exist, but that's fine.
      // The security check shouldn't block it unless we implement a whitelist.
      // If we implemented the fix correctly, this should pass through the security check
      // and hit the file system check.
      expect(res.status).toBe(404);
    });
  });
});
