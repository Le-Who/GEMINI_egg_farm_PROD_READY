/**
 * Unit tests for PluginManager
 */

import { describe, it, expect, vi } from "vitest";
import { PluginManager, definePlugin } from "../../core/src/plugin";
import type {
  BasePlayerState,
  GameConfig,
  GameAction,
  ActionResult,
} from "../../core/src/types";

interface TestState extends BasePlayerState {
  coins: number;
}

describe("PluginManager", () => {
  it("should register and retrieve plugins", () => {
    const pm = new PluginManager<TestState>();
    const plugin = definePlugin<TestState>({
      id: "test",
      name: "Test Plugin",
      version: "1.0.0",
      hooks: {},
    });
    pm.register(plugin);
    expect(pm.get("test")).toBe(plugin);
    expect(pm.getAll()).toHaveLength(1);
  });

  it("should unregister plugins", () => {
    const pm = new PluginManager();
    pm.register(
      definePlugin({ id: "test", name: "Test", version: "1.0", hooks: {} }),
    );
    pm.unregister("test");
    expect(pm.getAll()).toHaveLength(0);
  });

  it("should call onInit hooks", async () => {
    const pm = new PluginManager();
    const onInit = vi.fn();
    pm.register(
      definePlugin({ id: "a", name: "A", version: "1.0", hooks: { onInit } }),
    );
    await pm.initAll({ id: "test" } as GameConfig);
    expect(onInit).toHaveBeenCalledWith({ id: "test" });
  });

  it("should run beforeAction — allow modification", () => {
    const pm = new PluginManager<TestState>();
    pm.register(
      definePlugin<TestState>({
        id: "doubler",
        name: "Doubler",
        version: "1.0",
        hooks: {
          beforeAction: (action) => ({
            ...action,
            payload: { doubled: true },
          }),
        },
      }),
    );

    const action: GameAction = {
      type: "buy",
      payload: { doubled: false },
      playerId: "p1",
      timestamp: 0,
    };
    const state: TestState = { id: "p1", username: "A", coins: 100 };
    const result = pm.runBeforeAction(action, state);
    expect(result).not.toBeNull();
    expect((result as any).payload.doubled).toBe(true);
  });

  it("should run beforeAction — allow cancellation", () => {
    const pm = new PluginManager<TestState>();
    pm.register(
      definePlugin<TestState>({
        id: "blocker",
        name: "Blocker",
        version: "1.0",
        hooks: {
          beforeAction: () => null,
        },
      }),
    );

    const action: GameAction = {
      type: "buy",
      payload: {},
      playerId: "p1",
      timestamp: 0,
    };
    const state: TestState = { id: "p1", username: "A", coins: 100 };
    expect(pm.runBeforeAction(action, state)).toBeNull();
  });

  it("should call afterAction hooks", () => {
    const pm = new PluginManager<TestState>();
    const afterAction = vi.fn();
    pm.register(
      definePlugin<TestState>({
        id: "a",
        name: "A",
        version: "1.0",
        hooks: { afterAction },
      }),
    );

    const action: GameAction = {
      type: "buy",
      payload: {},
      playerId: "p1",
      timestamp: 0,
    };
    const result: ActionResult<TestState> = { success: true };
    pm.runAfterAction(action, result);
    expect(afterAction).toHaveBeenCalledWith(action, result);
  });

  it("should call onPlayerJoin and onPlayerLeave", () => {
    const pm = new PluginManager();
    const join = vi.fn();
    const leave = vi.fn();
    pm.register(
      definePlugin({
        id: "a",
        name: "A",
        version: "1.0",
        hooks: { onPlayerJoin: join, onPlayerLeave: leave },
      }),
    );
    pm.playerJoined("p1");
    pm.playerLeft("p1");
    expect(join).toHaveBeenCalledWith("p1");
    expect(leave).toHaveBeenCalledWith("p1");
  });

  it("should destroyAll plugins", async () => {
    const pm = new PluginManager();
    const destroy = vi.fn();
    pm.register(
      definePlugin({
        id: "a",
        name: "A",
        version: "1.0",
        hooks: { onDestroy: destroy },
      }),
    );
    pm.register(
      definePlugin({
        id: "b",
        name: "B",
        version: "1.0",
        hooks: { onDestroy: destroy },
      }),
    );
    await pm.destroyAll();
    expect(destroy).toHaveBeenCalledTimes(2);
    expect(pm.getAll()).toHaveLength(0);
  });
});
