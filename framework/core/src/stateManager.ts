/**
 * StateManager — Generic state container with subscriptions and persistence.
 *
 * Manages player state lifecycle: load → update → save.
 * Game-specific engines extend this with their own action handlers.
 */

import type {
  BasePlayerState,
  GameAction,
  ActionResult,
  IPersistenceAdapter,
} from "./types.js";
import { EventBus } from "./eventBus.js";

export type StateUpdater<TState> = (current: TState) => TState;
export type StateSubscriber<TState> = (
  state: TState,
  action?: GameAction,
) => void;

export class StateManager<TState extends BasePlayerState> {
  private states: Map<string, TState> = new Map();
  private subscribers: Set<StateSubscriber<TState>> = new Set();
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly saveDebounceMs: number;

  constructor(
    private readonly persistence: IPersistenceAdapter<TState>,
    private readonly defaultState: Omit<TState, "id" | "username">,
    private readonly eventBus: EventBus,
    options?: { saveDebounceMs?: number },
  ) {
    this.saveDebounceMs = options?.saveDebounceMs ?? 3000;
  }

  /** Initialize: load all states from persistence */
  async init(): Promise<void> {
    await this.persistence.init();
    this.states = await this.persistence.loadAll();
  }

  /** Get a player's state, creating default if not found */
  get(playerId: string, username?: string): TState {
    let state = this.states.get(playerId);
    if (!state) {
      state = {
        ...JSON.parse(JSON.stringify(this.defaultState)),
        id: playerId,
        username: username ?? "Player",
      } as TState;
      this.states.set(playerId, state);
    }
    return state;
  }

  /** Check if a player state exists */
  has(playerId: string): boolean {
    return this.states.has(playerId);
  }

  /** Update a player's state immutably */
  update(
    playerId: string,
    updater: StateUpdater<TState>,
    action?: GameAction,
  ): TState {
    const current = this.get(playerId);
    const next = updater(current);
    next.lastSaved = Date.now();
    this.states.set(playerId, next);
    this.notifySubscribers(next, action);
    this.debouncedSave();
    return next;
  }

  /** Replace a player's state entirely (e.g., from client sync) */
  set(playerId: string, state: TState): void {
    state.lastSaved = Date.now();
    this.states.set(playerId, state);
    this.notifySubscribers(state);
    this.debouncedSave();
  }

  /** Delete a player's state */
  async delete(playerId: string): Promise<void> {
    this.states.delete(playerId);
    await this.persistence.delete(playerId);
  }

  /** Get all player IDs */
  getPlayerIds(): string[] {
    return Array.from(this.states.keys());
  }

  /** Get player count */
  get playerCount(): number {
    return this.states.size;
  }

  /** Subscribe to state changes */
  subscribe(subscriber: StateSubscriber<TState>): () => void {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }

  /** Force save all states immediately */
  async saveNow(): Promise<void> {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    await this.persistence.saveAll(this.states);
  }

  /** Cleanup */
  async destroy(): Promise<void> {
    await this.saveNow();
    await this.persistence.close();
    this.subscribers.clear();
  }

  private notifySubscribers(state: TState, action?: GameAction): void {
    this.subscribers.forEach((sub) => sub(state, action));
    this.eventBus.emit("state:updated", { playerId: state.id, state });
  }

  private debouncedSave(): void {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.persistence.saveAll(this.states).catch((err) => {
        console.error("[StateManager] Save error:", err);
      });
    }, this.saveDebounceMs);
  }
}
