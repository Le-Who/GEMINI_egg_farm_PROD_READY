/**
 * EventBus — Lightweight pub/sub for decoupling game systems.
 *
 * Used for React ↔ Phaser, engine ↔ UI, plugin communication.
 * Extracted from the original egg farm eventBus.ts (already generic).
 */

export type EventHandler = (...args: any[]) => void;

export class EventBus {
  private handlers: Map<string, Set<EventHandler>> = new Map();

  /** Subscribe to an event */
  on(event: string, handler: EventHandler): void {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler);
  }

  /** Unsubscribe from an event */
  off(event: string, handler: EventHandler): void {
    this.handlers.get(event)?.delete(handler);
  }

  /** Subscribe to an event, auto-unsubscribe after first call */
  once(event: string, handler: EventHandler): void {
    const wrapper: EventHandler = (...args) => {
      this.off(event, wrapper);
      handler(...args);
    };
    this.on(event, wrapper);
  }

  /** Emit an event to all subscribers */
  emit(event: string, ...args: any[]): void {
    this.handlers.get(event)?.forEach((h) => h(...args));
  }

  /** Remove all handlers for an event, or all handlers if no event specified */
  clear(event?: string): void {
    if (event) {
      this.handlers.delete(event);
    } else {
      this.handlers.clear();
    }
  }

  /** Get count of listeners for an event */
  listenerCount(event: string): number {
    return this.handlers.get(event)?.size ?? 0;
  }
}

/** Shared game event bus instance */
export const gameBus = new EventBus();
