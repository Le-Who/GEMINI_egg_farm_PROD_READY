/**
 * ContentManager — Generic content loading & caching system.
 *
 * Loads game content (items, cards, questions, etc.) from JSON files
 * via API or local filesystem. Supports ETags for efficient polling.
 */

import type { ContentTypeDefinition } from "./types.js";
import { EventBus } from "./eventBus.js";

export interface ContentManagerOptions {
  /** Content API base URL (client-side) */
  apiBaseUrl?: string;
  /** Event bus for content change events */
  eventBus?: EventBus;
  /** Polling interval in ms (0 = disabled) */
  pollIntervalMs?: number;
}

export class ContentManager {
  private cache: Record<string, any> = {};
  private version: number = 0;
  private contentTypes: ContentTypeDefinition[] = [];
  private pollingInterval: ReturnType<typeof setInterval> | null = null;
  private readonly apiBaseUrl: string;
  private readonly eventBus: EventBus | null;

  constructor(options: ContentManagerOptions = {}) {
    this.apiBaseUrl = options.apiBaseUrl ?? "/api/content";
    this.eventBus = options.eventBus ?? null;

    if (options.pollIntervalMs && options.pollIntervalMs > 0) {
      this.startPolling(options.pollIntervalMs);
    }
  }

  /** Register content types the game uses */
  registerTypes(types: ContentTypeDefinition[]): void {
    this.contentTypes = types;
  }

  /** Get registered content type keys */
  getTypeKeys(): string[] {
    return this.contentTypes.map((t) => t.key);
  }

  /** Load all content from API */
  async loadFromApi(): Promise<boolean> {
    try {
      const res = await fetch(this.apiBaseUrl);
      if (!res.ok) throw new Error(`Content API error: ${res.status}`);
      const data = await res.json();
      this.cache = data;
      this.version++;
      this.eventBus?.emit("content:loaded", { version: this.version });
      return true;
    } catch (err) {
      console.error("[ContentManager] Load error:", err);
      return false;
    }
  }

  /** Load content from raw data object (server-side) */
  loadFromData(data: Record<string, any>): void {
    this.cache = data;
    this.version++;
    this.eventBus?.emit("content:loaded", { version: this.version });
  }

  /** Get content for a specific type */
  get<T = any>(typeKey: string): T {
    return this.cache[typeKey] as T;
  }

  /** Get the full content cache */
  getAll(): Record<string, any> {
    return this.cache;
  }

  /** Get current content version */
  getVersion(): number {
    return this.version;
  }

  /** Update a specific content entry (for admin/CMS) */
  set(typeKey: string, data: any): void {
    this.cache[typeKey] = data;
    this.version++;
    this.eventBus?.emit("content:updated", {
      type: typeKey,
      version: this.version,
    });
  }

  /** Start polling for content updates */
  startPolling(intervalMs: number, onRefresh?: () => void): void {
    this.stopPolling();
    let knownVersion = this.version;

    this.pollingInterval = setInterval(async () => {
      try {
        const res = await fetch(`${this.apiBaseUrl}/version`);
        if (!res.ok) return;
        const { version } = await res.json();
        if (version > knownVersion) {
          await this.loadFromApi();
          knownVersion = this.version;
          onRefresh?.();
          this.eventBus?.emit("content:refreshed", { version: this.version });
        }
      } catch {
        // Silent polling failure
      }
    }, intervalMs);
  }

  /** Stop polling */
  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /** Cleanup */
  destroy(): void {
    this.stopPolling();
    this.cache = {};
  }
}
