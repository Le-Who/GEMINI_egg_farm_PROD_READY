/**
 * Pet AI Stress Test
 *
 * Measures updatePetAI() performance under varying grid densities.
 * All functions are pure — no Phaser dependency needed.
 *
 * Scenarios:
 *   1. Light load   — 10 items,  10,000 iterations
 *   2. Medium load  — 100 items, 5,000 iterations
 *   3. Heavy load   — 500 items, 1,000 iterations
 *   4. Pathological — Full 14×14 grid (196 items), 1,000 iterations
 *   5. State transitions — IDLE→WANDER→APPROACH cycle, 5,000 iterations
 */
import { describe, it, beforeEach, vi } from "vitest";
import {
  createPetAIState,
  resetPetAI,
  updatePetAI,
  PetAIState,
} from "../../game/systems/PetAI";
import {
  measure,
  assertBudget,
  generateItems,
  generateItemsGrid,
} from "./perfUtils";
import { PlacedItem } from "../../types";

// Mock Phaser (PetAI.ts imports Phaser for Math.Linear in triggerPetReaction)
vi.mock("phaser", () => ({
  default: {
    Math: { Linear: (a: number, b: number, t: number) => a + (b - a) * t },
  },
}));

// Mock constants
vi.mock("../../constants", () => ({
  GRID_SIZE: 14,
}));

describe("Pet AI Performance", () => {
  let ai: PetAIState;

  beforeEach(() => {
    ai = createPetAIState();
    ai.stateTimer = 0; // Force immediate state transition
    ai.approachCooldown = 0;
  });

  // ─── Scenario 1: Light Load ──────────────────────────────
  it("should handle 10 items within 50μs/tick (p95)", () => {
    const items = generateItems(10);

    const result = measure(() => {
      updatePetAI(ai, 16.67, true, 7, 7, items);
    }, 10_000);

    assertBudget("PetAI — 10 items", result, 50);
  });

  // ─── Scenario 2: Medium Load ─────────────────────────────
  it("should handle 100 items within 200μs/tick (p95)", () => {
    const items = generateItems(100);

    const result = measure(() => {
      updatePetAI(ai, 16.67, true, 7, 7, items);
    }, 5_000);

    assertBudget("PetAI — 100 items", result, 200);
  });

  // ─── Scenario 3: Heavy Load ──────────────────────────────
  it("should handle 500 items within 1ms/tick (p95)", () => {
    // 500 items on a 14×14 grid = many off-grid items (collision array is large)
    const items: PlacedItem[] = [];
    for (let i = 0; i < 500; i++) {
      items.push({
        id: `heavy_${i}`,
        itemId: "planter_basic",
        gridX: Math.floor(Math.random() * 30), // Wider than grid
        gridY: Math.floor(Math.random() * 30),
        rotation: 0,
        placedAt: Date.now(),
      });
    }

    const result = measure(() => {
      updatePetAI(ai, 16.67, true, 7, 7, items);
    }, 1_000);

    assertBudget("PetAI — 500 items", result, 1_000);
  });

  // ─── Scenario 4: Full Grid (Pathological) ────────────────
  it("should handle full 14×14 grid within 500μs/tick (p95)", () => {
    const items = generateItemsGrid(196, 14); // Every tile occupied

    const result = measure(() => {
      // Force pathfinding with all tiles blocked
      ai.state = "WANDER";
      ai.stateTimer = 0;
      ai.moveProgress = 1;
      updatePetAI(ai, 16.67, true, 7, 7, items);
    }, 1_000);

    assertBudget("PetAI — full grid (196 items)", result, 500);
  });

  // ─── Scenario 5: State Transitions ───────────────────────
  it("should cycle IDLE→WANDER→APPROACH within 100μs/tick (p95)", () => {
    const items = generateItems(20);
    let frame = 0;

    const result = measure(() => {
      // Simulate a long delta to force state transitions
      const delta = frame % 3 === 0 ? 5000 : 16.67;
      updatePetAI(ai, delta, true, 10, 10, items);
      frame++;
    }, 5_000);

    assertBudget("PetAI — state transitions", result, 100);
  });

  // ─── Bonus: createPetAIState allocation ──────────────────
  it("should create state in < 5μs (p95)", () => {
    let state: PetAIState;

    const result = measure(() => {
      state = createPetAIState();
    }, 50_000);

    assertBudget("createPetAIState()", result, 5);
  });

  // ─── Bonus: resetPetAI ──────────────────────────────────
  it("should reset state in < 5μs (p95)", () => {
    const result = measure(() => {
      resetPetAI(ai, 7, 7);
    }, 50_000);

    assertBudget("resetPetAI()", result, 5);
  });

  // ─── Bonus: No-pet early exit ────────────────────────────
  it("should early-exit with no pet in < 1μs (p95)", () => {
    const items = generateItems(100);

    const result = measure(() => {
      updatePetAI(ai, 16.67, false, 7, 7, items); // hasPet = false
    }, 50_000);

    assertBudget("PetAI — no pet (early exit)", result, 1);
  });
});
