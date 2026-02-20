/**
 * Config — Game configuration loader.
 *
 * Reads and validates game.config.json / YAML files.
 * Supports environment variable overrides.
 */

import type { GameConfig } from "./types.js";

/** Default game config values */
export const DEFAULT_GAME_CONFIG: GameConfig = {
  id: "my-game",
  title: "My Discord Game",
  description: "A Discord Activities game",
  genre: "custom",
  version: "0.1.0",
  locales: ["en"],
  persistence: "memory",
  discord: {
    clientId: "",
    scopes: ["identify", "rpc.activities.write"],
  },
  rendering: {
    type: "phaser",
    backgroundColor: 0x2f3136,
  },
  server: {
    port: 8080,
    adminPanel: true,
    adminPasswordEnv: "ADMIN_PASSWORD",
  },
};

/**
 * Load and merge a game config from a raw object.
 * Overrides defaults with provided values.
 */
export function loadGameConfig(raw: Partial<GameConfig> = {}): GameConfig {
  return deepMerge(DEFAULT_GAME_CONFIG, raw) as GameConfig;
}

/**
 * Load game config with environment variable overrides.
 */
export function loadGameConfigWithEnv(
  raw: Partial<GameConfig> = {},
  env: Record<string, string | undefined> = process.env as any,
): GameConfig {
  const config = loadGameConfig(raw);

  // Apply env overrides
  if (env.DISCORD_CLIENT_ID) config.discord.clientId = env.DISCORD_CLIENT_ID;
  if (env.PORT) config.server.port = parseInt(env.PORT, 10);
  if (env.GAME_PERSISTENCE) config.persistence = env.GAME_PERSISTENCE as any;

  return config;
}

/** Deep merge utility (target ← source) */
function deepMerge(target: any, source: any): any {
  const output = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === "object"
    ) {
      output[key] = deepMerge(target[key], source[key]);
    } else if (source[key] !== undefined) {
      output[key] = source[key];
    }
  }
  return output;
}
