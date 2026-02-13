import { expect, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom"; // Side-effect import usually works for newer versions

// Runs a cleanup after each test case (e.g. clearing jsdom)
afterEach(() => {
  cleanup();
});
