/**
 * Performance Test Utilities
 *
 * Provides statistical measurement and assertion helpers for
 * performance tests. Uses high-resolution timing (performance.now())
 * and reports p50/p95/max/avg metrics in microseconds.
 */
import { expect } from "vitest";
import { PlacedItem, ItemType } from "../../types";

// ─────────────────────────────────────────────────────────────
// Measurement
// ─────────────────────────────────────────────────────────────

export interface PerfResult {
  /** Median (50th percentile) in μs */
  p50: number;
  /** 95th percentile in μs */
  p95: number;
  /** Maximum single iteration in μs */
  max: number;
  /** Mean across all iterations in μs */
  avg: number;
  /** Total wall time in ms */
  totalMs: number;
  /** Number of iterations executed */
  iterations: number;
}

/**
 * Measure a synchronous function over N iterations.
 * Returns statistical summary in microseconds.
 */
export function measure(fn: () => void, iterations: number): PerfResult {
  // Warmup: 10% of iterations (min 5)
  const warmup = Math.max(5, Math.floor(iterations * 0.1));
  for (let i = 0; i < warmup; i++) fn();

  const timings: number[] = new Array(iterations);
  const wallStart = performance.now();

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    timings[i] = (performance.now() - start) * 1000; // ms → μs
  }

  const wallEnd = performance.now();
  timings.sort((a, b) => a - b);

  return {
    p50: timings[Math.floor(iterations * 0.5)],
    p95: timings[Math.floor(iterations * 0.95)],
    max: timings[iterations - 1],
    avg: timings.reduce((a, b) => a + b, 0) / iterations,
    totalMs: wallEnd - wallStart,
    iterations,
  };
}

/**
 * Measure an async function over N iterations (sequential).
 */
export async function measureAsync(
  fn: () => Promise<void>,
  iterations: number,
): Promise<PerfResult> {
  // Warmup
  const warmup = Math.max(3, Math.floor(iterations * 0.1));
  for (let i = 0; i < warmup; i++) await fn();

  const timings: number[] = new Array(iterations);
  const wallStart = performance.now();

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    timings[i] = (performance.now() - start) * 1000; // ms → μs
  }

  const wallEnd = performance.now();
  timings.sort((a, b) => a - b);

  return {
    p50: timings[Math.floor(iterations * 0.5)],
    p95: timings[Math.floor(iterations * 0.95)],
    max: timings[iterations - 1],
    avg: timings.reduce((a, b) => a + b, 0) / iterations,
    totalMs: wallEnd - wallStart,
    iterations,
  };
}

// ─────────────────────────────────────────────────────────────
// Assertion
// ─────────────────────────────────────────────────────────────

/**
 * Assert that p95 is under the given budget (in μs).
 * Prints a formatted summary table on failure.
 */
export function assertBudget(
  label: string,
  result: PerfResult,
  budgetUs: number,
): void {
  const summary = formatResult(label, result, budgetUs);
  console.log(summary);

  expect(
    result.p95,
    `[PERF FAIL] "${label}" p95 ${fmtUs(result.p95)} exceeds budget ${fmtUs(budgetUs)}\n${summary}`,
  ).toBeLessThanOrEqual(budgetUs);
}

/**
 * Format a PerfResult as a readable summary line.
 */
export function formatResult(
  label: string,
  result: PerfResult,
  budgetUs?: number,
): string {
  const status =
    budgetUs != null ? (result.p95 <= budgetUs ? "✅" : "❌") : "📊";
  const budgetStr = budgetUs != null ? ` budget=${fmtUs(budgetUs)}` : "";
  return (
    `${status} ${label}: ` +
    `p50=${fmtUs(result.p50)} p95=${fmtUs(result.p95)} max=${fmtUs(result.max)} ` +
    `avg=${fmtUs(result.avg)} total=${result.totalMs.toFixed(1)}ms ` +
    `(${result.iterations} iters)${budgetStr}`
  );
}

function fmtUs(us: number): string {
  if (us >= 1000) return `${(us / 1000).toFixed(2)}ms`;
  return `${us.toFixed(1)}μs`;
}

// ─────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────

let _itemIdCounter = 0;

/**
 * Generate an array of PlacedItem fixtures spread across the grid.
 * Items are placed on unique grid positions to simulate realistic load.
 */
export function generateItems(count: number, gridSize = 14): PlacedItem[] {
  const items: PlacedItem[] = [];
  const maxPositions = gridSize * gridSize;
  const positions = new Set<string>();

  for (let i = 0; i < Math.min(count, maxPositions); i++) {
    let x: number, y: number, key: string;
    do {
      x = Math.floor(Math.random() * gridSize);
      y = Math.floor(Math.random() * gridSize);
      key = `${x},${y}`;
    } while (positions.has(key));
    positions.add(key);

    items.push({
      id: `perf_item_${++_itemIdCounter}`,
      itemId:
        i % 3 === 0
          ? "planter_basic"
          : i % 3 === 1
            ? "chair_wood"
            : "incubator_basic",
      gridX: x,
      gridY: y,
      rotation: 0,
      placedAt: Date.now(),
    });
  }

  return items;
}

/**
 * Generate items at specific grid positions (deterministic).
 */
export function generateItemsGrid(count: number, gridSize = 14): PlacedItem[] {
  const items: PlacedItem[] = [];
  let placed = 0;
  for (let y = 0; y < gridSize && placed < count; y++) {
    for (let x = 0; x < gridSize && placed < count; x++) {
      items.push({
        id: `grid_item_${++_itemIdCounter}`,
        itemId: "planter_basic",
        gridX: x,
        gridY: y,
        rotation: 0,
        placedAt: Date.now(),
      });
      placed++;
    }
  }
  return items;
}
