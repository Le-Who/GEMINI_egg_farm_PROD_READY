/**
 * Unit tests for EventBus
 */

import { describe, it, expect, vi } from "vitest";
import { EventBus } from "../src/eventBus";

describe("EventBus", () => {
  it("should emit and receive events", () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on("test", handler);
    bus.emit("test", "payload");
    expect(handler).toHaveBeenCalledWith("payload");
  });

  it("should support multiple handlers", () => {
    const bus = new EventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.on("test", h1);
    bus.on("test", h2);
    bus.emit("test", 42);
    expect(h1).toHaveBeenCalledWith(42);
    expect(h2).toHaveBeenCalledWith(42);
  });

  it("should unsubscribe with off()", () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on("test", handler);
    bus.off("test", handler);
    bus.emit("test");
    expect(handler).not.toHaveBeenCalled();
  });

  it("should handle once() — auto-unsubscribe after first call", () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.once("test", handler);
    bus.emit("test", "first");
    bus.emit("test", "second");
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith("first");
  });

  it("should clear specific event handlers", () => {
    const bus = new EventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.on("a", h1);
    bus.on("b", h2);
    bus.clear("a");
    bus.emit("a");
    bus.emit("b");
    expect(h1).not.toHaveBeenCalled();
    expect(h2).toHaveBeenCalled();
  });

  it("should clear all handlers", () => {
    const bus = new EventBus();
    bus.on("a", vi.fn());
    bus.on("b", vi.fn());
    bus.clear();
    expect(bus.listenerCount("a")).toBe(0);
    expect(bus.listenerCount("b")).toBe(0);
  });

  it("should report listener count", () => {
    const bus = new EventBus();
    expect(bus.listenerCount("test")).toBe(0);
    bus.on("test", () => {});
    bus.on("test", () => {});
    expect(bus.listenerCount("test")).toBe(2);
  });

  it("should not throw when emitting with no handlers", () => {
    const bus = new EventBus();
    expect(() => bus.emit("nonexistent")).not.toThrow();
  });
});
