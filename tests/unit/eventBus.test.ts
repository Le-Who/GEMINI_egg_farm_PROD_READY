import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '../../services/eventBus';

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  describe('on', () => {
    it('should register a handler for an event', () => {
      const handler = vi.fn();
      eventBus.on('test-event', handler);
      eventBus.emit('test-event');
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should register multiple handlers for the same event', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      eventBus.on('test-event', handler1);
      eventBus.on('test-event', handler2);
      eventBus.emit('test-event');
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should not register the same handler twice for the same event', () => {
      const handler = vi.fn();
      eventBus.on('test-event', handler);
      eventBus.on('test-event', handler);
      eventBus.emit('test-event');
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('emit', () => {
    it('should call registered handlers with arguments', () => {
      const handler = vi.fn();
      eventBus.on('test-event', handler);
      eventBus.emit('test-event', 'arg1', 123);
      expect(handler).toHaveBeenCalledWith('arg1', 123);
    });

    it('should not call handlers for other events', () => {
      const handler = vi.fn();
      eventBus.on('test-event', handler);
      eventBus.emit('other-event');
      expect(handler).not.toHaveBeenCalled();
    });

    it('should do nothing if no handlers are registered for the event', () => {
      const handler = vi.fn();
      eventBus.emit('test-event');
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('off', () => {
    it('should unregister a handler', () => {
      const handler = vi.fn();
      eventBus.on('test-event', handler);
      eventBus.off('test-event', handler);
      eventBus.emit('test-event');
      expect(handler).not.toHaveBeenCalled();
    });

    it('should not affect other handlers for the same event', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      eventBus.on('test-event', handler1);
      eventBus.on('test-event', handler2);
      eventBus.off('test-event', handler1);
      eventBus.emit('test-event');
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should handle unregistering a handler that was never registered', () => {
      const handler = vi.fn();
      // Should not throw
      eventBus.off('test-event', handler);
    });

    it('should handle unregistering from an event that has no handlers', () => {
      const handler = vi.fn();
      // Should not throw
      eventBus.off('non-existent-event', handler);
    });
  });
});
