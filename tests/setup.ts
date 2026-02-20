import { expect, afterEach, afterAll } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";
import fs from "fs";
import path from "path";

// Set DB_PATH to a temporary file for tests to avoid overwriting production data
process.env.DB_PATH = path.join(process.cwd(), `test-db-${process.pid}.json`);

// Runs a cleanup after each test case (e.g. clearing jsdom)
afterEach(() => {
  cleanup();
});

// Cleanup test database file after all tests finish
afterAll(() => {
  if (process.env.DB_PATH && fs.existsSync(process.env.DB_PATH)) {
    try {
      fs.unlinkSync(process.env.DB_PATH);
    } catch (e) {
      console.error("Failed to cleanup test DB:", e);
    }
  }
});
