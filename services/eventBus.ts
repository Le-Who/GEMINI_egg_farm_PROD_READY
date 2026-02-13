/**
 * Lightweight EventBus for React ↔ Phaser decoupling.
 * Replaces prop-drilling with targeted events so Phaser only reacts
 * to changes it cares about.
 */
type Handler = (...args: any[]) => void;

export class EventBus {
  private handlers: Map<string, Set<Handler>> = new Map();

  on(event: string, handler: Handler): void {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler);
  }

  off(event: string, handler: Handler): void {
    this.handlers.get(event)?.delete(handler);
  }

  emit(event: string, ...args: any[]): void {
    this.handlers.get(event)?.forEach((h) => h(...args));
  }
}

export const gameBus = new EventBus();
