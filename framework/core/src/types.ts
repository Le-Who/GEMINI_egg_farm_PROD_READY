/**
 * @discord-activities/core — Generic Type System
 *
 * Genre-agnostic types that every Discord Activities game extends.
 * Game-specific types (e.g., CropData, CardDeck) are defined in templates.
 */

import type React from "react";

// ═══════════════════════════════════════════════════════════
// Game Configuration
// ═══════════════════════════════════════════════════════════

/** Top-level game definition loaded from game.config.json */
export interface GameConfig {
  /** Unique game identifier (slug) */
  id: string;
  /** Human-readable game title */
  title: string;
  /** Short description */
  description: string;
  /** Game genre for template selection */
  genre: GameGenre;
  /** Semantic version */
  version: string;
  /** Supported locales (first = default) */
  locales: string[];
  /** Persistence backend */
  persistence: PersistenceType;
  /** Optional feature flags */
  features?: Record<string, boolean>;
  /** Discord Activity configuration */
  discord: DiscordConfig;
  /** Rendering configuration */
  rendering: RenderingConfig;
  /** Server configuration */
  server: ServerConfig;
}

export type GameGenre =
  | "farm"
  | "card-battle"
  | "trivia"
  | "match-3"
  | "rpg"
  | "custom";
export type PersistenceType = "memory" | "local-file" | "gcs" | "redis";

export interface DiscordConfig {
  clientId: string;
  scopes: string[];
  activityAssets?: {
    largeImage?: string;
    largeText?: string;
  };
}

export interface RenderingConfig {
  /** Renderer type */
  type: "phaser" | "canvas" | "dom";
  /** Grid settings (for grid-based games) */
  grid?: {
    width: number;
    height: number;
    tileWidth: number;
    tileHeight: number;
    isometric: boolean;
  };
  /** Background color */
  backgroundColor: number;
}

export interface ServerConfig {
  port: number;
  /** Admin panel enabled */
  adminPanel: boolean;
  /** Admin password (from env) */
  adminPasswordEnv: string;
  /** Rate limiting */
  rateLimit?: {
    windowMs: number;
    maxRequests: number;
  };
}

// ═══════════════════════════════════════════════════════════
// Player & State
// ═══════════════════════════════════════════════════════════

/** Base player state — every game extends this */
export interface BasePlayerState {
  /** Unique player ID (Discord user ID) */
  id: string;
  /** Display name */
  username: string;
  /** Discord user ID */
  discordId?: string;
  /** Timestamp of last save */
  lastSaved?: number;
}

/** Generic game action for the action/event system */
export interface GameAction<TPayload = unknown> {
  /** Action type identifier */
  type: string;
  /** Action payload */
  payload: TPayload;
  /** Actor player ID */
  playerId: string;
  /** Timestamp */
  timestamp: number;
}

/** Result of processing an action */
export interface ActionResult<TState = unknown> {
  success: boolean;
  message?: string;
  newState?: TState;
  events?: GameEvent[];
}

// ═══════════════════════════════════════════════════════════
// Events
// ═══════════════════════════════════════════════════════════

/** Game event emitted by the engine */
export interface GameEvent<TData = unknown> {
  type: string;
  data: TData;
  timestamp: number;
}

/** Event handler function */
export type EventHandler<T = unknown> = (event: GameEvent<T>) => void;

// ═══════════════════════════════════════════════════════════
// Content & Assets
// ═══════════════════════════════════════════════════════════

/** Generic content item (items, cards, questions, etc.) */
export interface ContentItem {
  id: string;
  name: string;
  description?: string;
  /** Localized names: { "ru": "Название" } */
  localizedNames?: Record<string, string>;
  localizedDescriptions?: Record<string, string>;
  /** Optional sprite/image path */
  sprite?: string | null;
  /** Arbitrary metadata */
  meta?: Record<string, unknown>;
}

/** Content type registry entry */
export interface ContentTypeDefinition {
  /** Type key (e.g., "items", "cards", "questions") */
  key: string;
  /** Whether the content is an array or keyed object */
  format: "array" | "object";
  /** Optional Zod schema for validation */
  schema?: unknown;
}

// ═══════════════════════════════════════════════════════════
// Plugin System
// ═══════════════════════════════════════════════════════════

/** Lifecycle hooks that plugins can implement */
export interface PluginHooks<TState extends BasePlayerState = BasePlayerState> {
  /** Called when game initializes */
  onInit?: (config: GameConfig) => void | Promise<void>;
  /** Called before an action is processed */
  beforeAction?: (action: GameAction, state: TState) => GameAction | null;
  /** Called after an action is processed */
  afterAction?: (action: GameAction, result: ActionResult<TState>) => void;
  /** Called on each game tick (if applicable) */
  onTick?: (delta: number, state: TState) => void;
  /** Called when player connects */
  onPlayerJoin?: (playerId: string) => void;
  /** Called when player disconnects */
  onPlayerLeave?: (playerId: string) => void;
  /** Called on cleanup/shutdown */
  onDestroy?: () => void | Promise<void>;
}

/** Plugin definition */
export interface GamePlugin<TState extends BasePlayerState = BasePlayerState> {
  /** Unique plugin identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Semantic version */
  version: string;
  /** Plugin hooks */
  hooks: PluginHooks<TState>;
}

// ═══════════════════════════════════════════════════════════
// Persistence
// ═══════════════════════════════════════════════════════════

/** Interface for persistence backends */
export interface IPersistenceAdapter<
  TState extends BasePlayerState = BasePlayerState,
> {
  /** Initialize the adapter */
  init(): Promise<void>;
  /** Load a player's state */
  load(playerId: string): Promise<TState | null>;
  /** Save a player's state */
  save(playerId: string, state: TState): Promise<void>;
  /** Load all player states */
  loadAll(): Promise<Map<string, TState>>;
  /** Save all player states */
  saveAll(states: Map<string, TState>): Promise<void>;
  /** List all player IDs */
  listPlayers(): Promise<string[]>;
  /** Delete a player's state */
  delete(playerId: string): Promise<void>;
  /** Cleanup/close connections */
  close(): Promise<void>;
}

// ═══════════════════════════════════════════════════════════
// Discord Integration
// ═══════════════════════════════════════════════════════════

/** Discord user info */
export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  publicFlags?: number;
}

/** Discord Activity lifecycle states */
export type ActivityLifecycleState =
  | "initializing"
  | "authenticating"
  | "ready"
  | "error"
  | "destroyed";

// ═══════════════════════════════════════════════════════════
// UI Components
// ═══════════════════════════════════════════════════════════

/** Registration for a UI panel/modal that the game provides */
export interface UIRegistration {
  id: string;
  label: string;
  icon?: string;
  /** Component factory (React lazy-compatible) */
  component: () => Promise<{ default: React.ComponentType<any> }>;
}
