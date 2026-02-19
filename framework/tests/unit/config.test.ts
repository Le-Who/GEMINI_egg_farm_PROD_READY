/**
 * Unit tests for Config loader
 */

import { describe, it, expect } from "vitest";
import {
  loadGameConfig,
  loadGameConfigWithEnv,
  DEFAULT_GAME_CONFIG,
} from "../../core/src/config";

describe("Config", () => {
  it("should return defaults when given empty object", () => {
    const config = loadGameConfig();
    expect(config.id).toBe("my-game");
    expect(config.genre).toBe("custom");
    expect(config.server.port).toBe(8080);
    expect(config.persistence).toBe("memory");
  });

  it("should merge partial config with defaults", () => {
    const config = loadGameConfig({
      id: "farm-game",
      genre: "farm",
      persistence: "local-file",
    });
    expect(config.id).toBe("farm-game");
    expect(config.genre).toBe("farm");
    expect(config.persistence).toBe("local-file");
    // Non-overridden fields remain default
    expect(config.server.port).toBe(8080);
    expect(config.discord.scopes).toEqual(["identify", "rpc.activities.write"]);
  });

  it("should deep merge nested objects", () => {
    const config = loadGameConfig({
      discord: { clientId: "abc123" },
      server: { port: 3000 },
    } as any);
    expect(config.discord.clientId).toBe("abc123");
    expect(config.discord.scopes).toEqual(["identify", "rpc.activities.write"]);
    expect(config.server.port).toBe(3000);
    expect(config.server.adminPanel).toBe(true);
  });

  it("should apply env overrides", () => {
    const config = loadGameConfigWithEnv(
      { id: "test" },
      {
        DISCORD_CLIENT_ID: "env_id",
        PORT: "9090",
        GAME_PERSISTENCE: "gcs",
      },
    );
    expect(config.discord.clientId).toBe("env_id");
    expect(config.server.port).toBe(9090);
    expect(config.persistence).toBe("gcs");
  });
});
