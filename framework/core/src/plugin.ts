/**
 * Plugin — Plugin system for extending game functionality.
 *
 * Plugins can hook into game lifecycle events (init, action, tick, etc.)
 * without modifying the core engine code.
 */

import type {
  GamePlugin,
  PluginHooks,
  GameConfig,
  BasePlayerState,
  GameAction,
  ActionResult,
} from "./types.js";

export class PluginManager<TState extends BasePlayerState = BasePlayerState> {
  private plugins: Map<string, GamePlugin<TState>> = new Map();

  /** Register a plugin */
  register(plugin: GamePlugin<TState>): void {
    if (this.plugins.has(plugin.id)) {
      console.warn(
        `[PluginManager] Plugin "${plugin.id}" already registered, replacing.`,
      );
    }
    this.plugins.set(plugin.id, plugin);
  }

  /** Unregister a plugin */
  unregister(pluginId: string): void {
    this.plugins.delete(pluginId);
  }

  /** Get a registered plugin by ID */
  get(pluginId: string): GamePlugin<TState> | undefined {
    return this.plugins.get(pluginId);
  }

  /** Get all registered plugins */
  getAll(): GamePlugin<TState>[] {
    return Array.from(this.plugins.values());
  }

  /** Call onInit on all plugins */
  async initAll(config: GameConfig): Promise<void> {
    for (const plugin of this.plugins.values()) {
      await plugin.hooks.onInit?.(config);
    }
  }

  /** Run beforeAction hooks — returns modified action or null to cancel */
  runBeforeAction(action: GameAction, state: TState): GameAction | null {
    let current: GameAction | null = action;
    for (const plugin of this.plugins.values()) {
      if (!current) break;
      const result: GameAction | null | undefined = plugin.hooks.beforeAction?.(
        current,
        state,
      );
      if (result === null) return null;
      if (result !== undefined) current = result;
    }
    return current;
  }

  /** Run afterAction hooks */
  runAfterAction(action: GameAction, result: ActionResult<TState>): void {
    for (const plugin of this.plugins.values()) {
      plugin.hooks.afterAction?.(action, result);
    }
  }

  /** Run onTick hooks */
  tick(delta: number, state: TState): void {
    for (const plugin of this.plugins.values()) {
      plugin.hooks.onTick?.(delta, state);
    }
  }

  /** Run onPlayerJoin hooks */
  playerJoined(playerId: string): void {
    for (const plugin of this.plugins.values()) {
      plugin.hooks.onPlayerJoin?.(playerId);
    }
  }

  /** Run onPlayerLeave hooks */
  playerLeft(playerId: string): void {
    for (const plugin of this.plugins.values()) {
      plugin.hooks.onPlayerLeave?.(playerId);
    }
  }

  /** Run onDestroy on all plugins */
  async destroyAll(): Promise<void> {
    for (const plugin of this.plugins.values()) {
      await plugin.hooks.onDestroy?.();
    }
    this.plugins.clear();
  }
}

/** Helper to create a typed plugin definition */
export function definePlugin<TState extends BasePlayerState = BasePlayerState>(
  plugin: GamePlugin<TState>,
): GamePlugin<TState> {
  return plugin;
}
