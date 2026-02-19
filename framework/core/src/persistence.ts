/**
 * Persistence Adapters — Swappable storage backends.
 *
 * Implements IPersistenceAdapter for:
 * - MemoryAdapter: In-memory (dev/testing)
 * - LocalFileAdapter: JSON file on disk
 */

import type { BasePlayerState, IPersistenceAdapter } from "./types.js";
import fs from "fs";
import path from "path";

// ═══════════════════════════════════════════════════════════
// Memory Adapter (development / testing)
// ═══════════════════════════════════════════════════════════

export class MemoryAdapter<
  TState extends BasePlayerState,
> implements IPersistenceAdapter<TState> {
  private store: Map<string, TState> = new Map();

  async init(): Promise<void> {}

  async load(playerId: string): Promise<TState | null> {
    return this.store.get(playerId) ?? null;
  }

  async save(playerId: string, state: TState): Promise<void> {
    this.store.set(playerId, JSON.parse(JSON.stringify(state)));
  }

  async loadAll(): Promise<Map<string, TState>> {
    return new Map(this.store);
  }

  async saveAll(states: Map<string, TState>): Promise<void> {
    this.store = new Map(
      Array.from(states.entries()).map(([k, v]) => [
        k,
        JSON.parse(JSON.stringify(v)),
      ]),
    );
  }

  async listPlayers(): Promise<string[]> {
    return Array.from(this.store.keys());
  }

  async delete(playerId: string): Promise<void> {
    this.store.delete(playerId);
  }

  async close(): Promise<void> {
    this.store.clear();
  }
}

// ═══════════════════════════════════════════════════════════
// Local File Adapter (single JSON file)
// ═══════════════════════════════════════════════════════════

export class LocalFileAdapter<
  TState extends BasePlayerState,
> implements IPersistenceAdapter<TState> {
  private store: Map<string, TState> = new Map();

  constructor(private readonly filePath: string) {}

  async init(): Promise<void> {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, "utf-8");
        const parsed = JSON.parse(raw);
        for (const [k, v] of Object.entries(parsed)) {
          this.store.set(k, v as TState);
        }
      }
    } catch (err) {
      console.error("[LocalFileAdapter] Init error:", err);
    }
  }

  async load(playerId: string): Promise<TState | null> {
    return this.store.get(playerId) ?? null;
  }

  async save(playerId: string, state: TState): Promise<void> {
    this.store.set(playerId, state);
    await this.writeToDisk();
  }

  async loadAll(): Promise<Map<string, TState>> {
    return new Map(this.store);
  }

  async saveAll(states: Map<string, TState>): Promise<void> {
    this.store = new Map(states);
    await this.writeToDisk();
  }

  async listPlayers(): Promise<string[]> {
    return Array.from(this.store.keys());
  }

  async delete(playerId: string): Promise<void> {
    this.store.delete(playerId);
    await this.writeToDisk();
  }

  async close(): Promise<void> {
    await this.writeToDisk();
  }

  private async writeToDisk(): Promise<void> {
    try {
      const obj = Object.fromEntries(this.store);
      await fs.promises.writeFile(this.filePath, JSON.stringify(obj, null, 2));
    } catch (err) {
      console.error("[LocalFileAdapter] Write error:", err);
    }
  }
}
