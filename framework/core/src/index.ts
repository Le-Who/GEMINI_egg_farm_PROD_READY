/**
 * @discord-activities/core — Public API
 *
 * Barrel export for all core framework modules.
 */

// Types
export type {
  GameConfig,
  GameGenre,
  PersistenceType,
  DiscordConfig,
  RenderingConfig,
  ServerConfig,
  BasePlayerState,
  GameAction,
  ActionResult,
  GameEvent,
  EventHandler,
  ContentItem,
  ContentTypeDefinition,
  PluginHooks,
  GamePlugin,
  IPersistenceAdapter,
  DiscordUser,
  ActivityLifecycleState,
  UIRegistration,
} from "./types.js";

// EventBus
export { EventBus, gameBus } from "./eventBus.js";
export type { EventHandler as EventBusHandler } from "./eventBus.js";

// StateManager
export { StateManager } from "./stateManager.js";
export type { StateUpdater, StateSubscriber } from "./stateManager.js";

// Persistence
export { MemoryAdapter, LocalFileAdapter } from "./persistence.js";

// Discord Bridge
export { DiscordBridge } from "./discordBridge.js";
export type { DiscordBridgeOptions } from "./discordBridge.js";

// Content Manager
export { ContentManager } from "./contentManager.js";
export type { ContentManagerOptions } from "./contentManager.js";

// Asset Manager
export { AssetManager } from "./assetManager.js";
export type { AssetEntry, AssetManagerOptions } from "./assetManager.js";

// Base Server
export { BaseServer } from "./baseServer.js";
export type { BaseServerOptions } from "./baseServer.js";

// Base Scene
export { BaseScene } from "./baseScene.js";
export type { BaseSceneConfig } from "./baseScene.js";

// i18n
export { I18n, i18n } from "./i18n.js";

// Config
export {
  loadGameConfig,
  loadGameConfigWithEnv,
  DEFAULT_GAME_CONFIG,
} from "./config.js";

// Plugin
export { PluginManager, definePlugin } from "./plugin.js";
