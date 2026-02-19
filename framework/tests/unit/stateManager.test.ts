/**
 * Unit tests for StateManager
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { StateManager } from "../../core/src/stateManager";
import { MemoryAdapter } from "../../core/src/persistence";
import { EventBus } from "../../core/src/eventBus";
import type { BasePlayerState } from "../../core/src/types";

interface TestState extends BasePlayerState {
  coins: number;
  level: number;
}

const defaultState = { coins: 100, level: 1 };

describe("StateManager", () => {
  let sm: StateManager<TestState>;
  let bus: EventBus;

  beforeEach(async () => {
    bus = new EventBus();
    sm = new StateManager<TestState>(
      new MemoryAdapter<TestState>(),
      defaultState,
      bus,
      { saveDebounceMs: 50 },
    );
    await sm.init();
  });

  it("should create default state for new player", () => {
    const state = sm.get("p1", "Player One");
    expect(state.id).toBe("p1");
    expect(state.username).toBe("Player One");
    expect(state.coins).toBe(100);
    expect(state.level).toBe(1);
  });

  it("should return same state for existing player", () => {
    sm.get("p1", "Player One");
    const state = sm.get("p1");
    expect(state.username).toBe("Player One");
  });

  it("should update state immutably", () => {
    sm.get("p1", "Player");
    const updated = sm.update("p1", (s) => ({ ...s, coins: s.coins + 50 }));
    expect(updated.coins).toBe(150);
    expect(sm.get("p1").coins).toBe(150);
  });

  it("should track player count", () => {
    expect(sm.playerCount).toBe(0);
    sm.get("p1", "A");
    sm.get("p2", "B");
    expect(sm.playerCount).toBe(2);
  });

  it("should delete player", async () => {
    sm.get("p1", "A");
    expect(sm.has("p1")).toBe(true);
    await sm.delete("p1");
    expect(sm.has("p1")).toBe(false);
  });

  it("should notify subscribers on update", () => {
    const subscriber = vi.fn();
    sm.subscribe(subscriber);
    sm.get("p1", "A");
    sm.update("p1", (s) => ({ ...s, coins: 999 }));
    expect(subscriber).toHaveBeenCalled();
    const [state] = subscriber.mock.calls[0];
    expect(state.coins).toBe(999);
  });

  it("should unsubscribe", () => {
    const subscriber = vi.fn();
    const unsub = sm.subscribe(subscriber);
    unsub();
    sm.update("p1", (s) => ({ ...s, coins: 0 }));
    expect(subscriber).not.toHaveBeenCalled();
  });

  it("should emit state:updated on event bus", () => {
    const handler = vi.fn();
    bus.on("state:updated", handler);
    sm.update("p1", (s) => ({ ...s, level: 5 }));
    expect(handler).toHaveBeenCalled();
  });

  it("should list player IDs", () => {
    sm.get("alice", "Alice");
    sm.get("bob", "Bob");
    const ids = sm.getPlayerIds();
    expect(ids).toContain("alice");
    expect(ids).toContain("bob");
  });
});
