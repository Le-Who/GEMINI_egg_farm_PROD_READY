import { sanitizeUser } from '../../server.js';
import { describe, it, expect } from 'vitest';

describe('sanitizeUser', () => {
  it('should return default state for empty input', () => {
    const user = {};
    const sanitized = sanitizeUser(user);

    expect(sanitized.coins).toBe(500);
    expect(sanitized.rooms).toBeDefined();
    expect(sanitized.rooms.interior).toBeDefined();
    expect(sanitized.rooms.garden).toBeDefined();
    expect(sanitized.rooms.interior.items).toEqual([]);
  });

  it('should preserve existing fields', () => {
    const user = {
      id: 'user1',
      username: 'User 1',
      coins: 1000,
    };
    const sanitized = sanitizeUser(user);

    expect(sanitized.id).toBe('user1');
    expect(sanitized.username).toBe('User 1');
    expect(sanitized.coins).toBe(1000);
    expect(sanitized.rooms).toBeDefined(); // Filled in
  });

  it('should fill missing rooms', () => {
    const user = {
      rooms: {
        interior: { type: 'interior', items: [{ id: '1' }], unlocked: true }
      }
    };
    const sanitized = sanitizeUser(user);

    expect(sanitized.rooms.interior.items).toHaveLength(1);
    expect(sanitized.rooms.garden).toBeDefined();
    expect(sanitized.rooms.garden.type).toBe('garden');
  });

  it('should fill missing items array in room', () => {
    const user = {
      rooms: {
        interior: { type: 'interior', unlocked: true }, // missing items
        garden: { type: 'garden', items: [], unlocked: false }
      }
    };
    const sanitized = sanitizeUser(user);

    expect(sanitized.rooms.interior.items).toEqual([]);
  });

  it('should handle target-user-id case from issue description', () => {
    const badUser = {
      "id": "target-user-id",
      "username": "Target",
      "billboard": [
        {
          "fromId": "test-user-id",
          "fromName": "Integration Tester",
          "sticker": "heart",
          "message": "Hello!",
          "timestamp": 1770987472502
        }
      ]
    };

    const sanitized = sanitizeUser(badUser);

    expect(sanitized.id).toBe("target-user-id");
    expect(sanitized.username).toBe("Target");
    expect(sanitized.billboard).toHaveLength(1);

    // Check required fields that were missing
    expect(sanitized.coins).toBeDefined();
    expect(sanitized.rooms).toBeDefined();
    expect(sanitized.currentRoom).toBe("interior"); // Default
    expect(sanitized.pets).toEqual([]);
    expect(sanitized.rooms.interior.items).toEqual([]);
  });

  it('should not share state between defaults', () => {
    const user1 = sanitizeUser({});
    const user2 = sanitizeUser({});

    // This confirms deep cloning
    expect(user1.rooms).not.toBe(user2.rooms);
    expect(user1.inventory).not.toBe(user2.inventory);

    user1.rooms.interior.items.push({ id: '1' });
    expect(user2.rooms.interior.items).toHaveLength(0);
  });
});
