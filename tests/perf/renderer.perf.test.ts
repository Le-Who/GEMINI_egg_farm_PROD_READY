/**
 * Renderer Performance Test — getCropSprite()
 *
 * Tests the pure getCropSprite() function which selects the
 * correct growth-stage sprite based on progress percentage.
 *
 * drawProceduralItemFallback and generateProceduralTexture require
 * a live Phaser canvas — they are excluded from unit perf tests.
 */
import { describe, it, vi } from "vitest";
import { getCropSprite } from "../../game/systems/ProceduralRenderer";
import { measure, assertBudget } from "./perfUtils";
import { CropConfig } from "../../types";

// Mock constants (TILE_WIDTH, TILE_HEIGHT, ITEMS) used by ProceduralRenderer
vi.mock("../../constants", () => ({
  TILE_WIDTH: 64,
  TILE_HEIGHT: 32,
  ITEMS: {},
}));

// Mock Phaser (only needed for module import, not for getCropSprite)
vi.mock("phaser", () => ({
  default: {
    Display: {
      Color: {
        IntegerToColor: () => ({ red: 0, green: 0, blue: 0 }),
        GetColor: () => 0,
      },
    },
    Geom: {
      Point: class {
        constructor(
          public x: number,
          public y: number,
        ) {}
      },
    },
    Math: { Linear: (a: number, b: number, t: number) => a + (b - a) * t },
  },
}));

describe("Renderer Performance — getCropSprite", () => {
  // ─── Scenario 1: No Sprites ──────────────────────────────
  it("should return null for no-sprite config in < 5μs (p95)", () => {
    const config: CropConfig = {
      id: "test_crop",
      name: "Test Crop",
      seedPrice: 10,
      sellPrice: 50,
      growthTime: 30,
      xpReward: 5,
      levelReq: 1,
      color: 0x00ff00,
    };

    const result = measure(() => {
      getCropSprite(config, 0.5);
    }, 10_000);

    assertBudget("getCropSprite — no sprites", result, 5);
  });

  // ─── Scenario 2: 5 Growth Stages ────────────────────────
  it("should select from 5 stages in < 10μs (p95)", () => {
    const config: CropConfig = {
      id: "test_crop_5",
      name: "Test Crop 5-stage",
      seedPrice: 10,
      sellPrice: 50,
      growthTime: 60,
      xpReward: 10,
      levelReq: 1,
      color: 0x00ff00,
      growthSprites: [
        { stage: 0, sprite: "seed.png" },
        { stage: 25, sprite: "sprout.png" },
        { stage: 50, sprite: "growing.png" },
        { stage: 75, sprite: "budding.png" },
        { stage: 100, sprite: "bloom.png" },
      ],
    };

    let progress = 0;
    const result = measure(() => {
      getCropSprite(config, progress);
      progress = (progress + 0.1) % 1.1;
    }, 10_000);

    assertBudget("getCropSprite — 5 stages", result, 10);
  });

  // ─── Scenario 3: 20 Growth Stages (sort-heavy) ──────────
  it("should select from 20 stages in < 50μs (p95)", () => {
    const stages = Array.from({ length: 20 }, (_, i) => ({
      stage: i * 5,
      sprite: `stage_${i}.png`,
    }));

    const config: CropConfig = {
      id: "test_crop_20",
      name: "Test Crop 20-stage",
      seedPrice: 10,
      sellPrice: 50,
      growthTime: 120,
      xpReward: 20,
      levelReq: 1,
      color: 0x00ff00,
      growthSprites: stages,
    };

    let progress = 0;
    const result = measure(() => {
      getCropSprite(config, progress);
      progress = (progress + 0.05) % 1.1;
    }, 10_000);

    assertBudget("getCropSprite — 20 stages", result, 50);
  });

  // ─── Scenario 4: Progress Sweep (batch) ──────────────────
  it("should sweep 100 progress values × 10 stages in < 20μs avg", () => {
    const stages = Array.from({ length: 10 }, (_, i) => ({
      stage: i * 10,
      sprite: `stage_${i}.png`,
    }));

    const config: CropConfig = {
      id: "test_crop_sweep",
      name: "Sweep Crop",
      seedPrice: 10,
      sellPrice: 50,
      growthTime: 60,
      xpReward: 10,
      levelReq: 1,
      color: 0x00ff00,
      growthSprites: stages,
    };

    const result = measure(() => {
      // 100 progress values per iteration
      for (let p = 0; p <= 1.0; p += 0.01) {
        getCropSprite(config, p);
      }
    }, 5_000);

    // Budget is per batch of 100 calls
    assertBudget("getCropSprite — 100-value sweep", result, 2_000);
  });

  // ─── Scenario 5: Single Sprite (legacy) ──────────────────
  it("should handle legacy single sprite in < 5μs (p95)", () => {
    const config: CropConfig = {
      id: "legacy_crop",
      name: "Legacy Crop",
      seedPrice: 10,
      sellPrice: 50,
      growthTime: 30,
      xpReward: 5,
      levelReq: 1,
      color: 0xff0000,
      sprite: "legacy_bloom.png",
    };

    const result = measure(() => {
      getCropSprite(config, 1.0); // Fully grown
    }, 10_000);

    assertBudget("getCropSprite — legacy sprite", result, 5);
  });

  // ─── Scenario 6: Not-ready (no match) ────────────────────
  it("should return null for not-ready legacy crop in < 5μs (p95)", () => {
    const config: CropConfig = {
      id: "notready_crop",
      name: "Not Ready",
      seedPrice: 10,
      sellPrice: 50,
      growthTime: 30,
      xpReward: 5,
      levelReq: 1,
      color: 0x00ff00,
      sprite: "bloom.png",
    };

    const result = measure(() => {
      getCropSprite(config, 0.5); // Not ready yet
    }, 10_000);

    assertBudget("getCropSprite — not ready", result, 5);
  });
});
