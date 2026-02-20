/**
 * Unit tests for MemoryAdapter persistence
 */

import { describe, it, expect, beforeEach } from "vitest";
import { MemoryAdapter } from "../../core/src/persistence";
import type { BasePlayerState } from "../../core/src/types";

interface TestState extends BasePlayerState {
  coins: number;
}

describe("MemoryAdapter", () => {
  let adapter: MemoryAdapter<TestState>;

  beforeEach(async () => {
    adapter = new MemoryAdapter<TestState>();
    await adapter.init();
  });

  it("should return null for nonexistent player", async () => {
    const result = await adapter.load("nobody");
    expect(result).toBeNull();
  });

  it("should save and load state", async () => {
    const state: TestState = { id: "p1", username: "A", coins: 42 };
    await adapter.save("p1", state);
    const loaded = await adapter.load("p1");
    expect(loaded).toEqual(state);
  });

  it("should deep clone on save (no shared references)", async () => {
    const state: TestState = { id: "p1", username: "A", coins: 100 };
    await adapter.save("p1", state);
    state.coins = 999;
    const loaded = await adapter.load("p1");
    expect(loaded!.coins).toBe(100); // Should not have changed
  });

  it("should save and load all states", async () => {
    const states = new Map<string, TestState>([
      ["p1", { id: "p1", username: "A", coins: 10 }],
      ["p2", { id: "p2", username: "B", coins: 20 }],
    ]);
    await adapter.saveAll(states);
    const loaded = await adapter.loadAll();
    expect(loaded.size).toBe(2);
    expect(loaded.get("p1")!.coins).toBe(10);
    expect(loaded.get("p2")!.coins).toBe(20);
  });

  it("should list player IDs", async () => {
    await adapter.save("alice", { id: "alice", username: "Alice", coins: 0 });
    await adapter.save("bob", { id: "bob", username: "Bob", coins: 0 });
    const ids = await adapter.listPlayers();
    expect(ids.sort()).toEqual(["alice", "bob"]);
  });

  it("should delete a player", async () => {
    await adapter.save("p1", { id: "p1", username: "A", coins: 0 });
    await adapter.delete("p1");
    expect(await adapter.load("p1")).toBeNull();
  });

  it("should clear on close", async () => {
    await adapter.save("p1", { id: "p1", username: "A", coins: 0 });
    await adapter.close();
    expect(await adapter.load("p1")).toBeNull();
  });
});
