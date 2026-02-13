/**
 * PetAI — Free-Roaming Pet AI System
 *
 * Extracted from MainScene.ts for modularity.
 * Manages pet movement states (IDLE, WANDER, APPROACH), pathfinding,
 * target selection, and pet-interaction reactions.
 */
import Phaser from "phaser";
import { GRID_SIZE } from "../../constants";
import { PlacedItem, PetData } from "../../types";

export interface PetAIState {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  moveProgress: number; // 0->1 interpolation (1 = arrived)
  state: "IDLE" | "WANDER" | "APPROACH";
  stateTimer: number; // ms remaining in current state
  approachCooldown: number; // ms until next approach check
  lastPetTime: number; // Last time pet was petted (cooldown)
}

export function createPetAIState(): PetAIState {
  return {
    x: 6,
    y: 7,
    targetX: 6,
    targetY: 7,
    moveProgress: 1,
    state: "IDLE",
    stateTimer: 0,
    approachCooldown: 0,
    lastPetTime: 0,
  };
}

/**
 * Reset PetAI state when a new pet is assigned.
 */
export function resetPetAI(
  ai: PetAIState,
  playerX: number,
  playerY: number,
): void {
  ai.x = Math.max(0, Math.min(GRID_SIZE - 1, playerX - 1));
  ai.y = Math.max(0, Math.min(GRID_SIZE - 1, playerY));
  ai.targetX = ai.x;
  ai.targetY = ai.y;
  ai.moveProgress = 1;
  ai.state = "IDLE";
  ai.stateTimer = 2000;
  ai.approachCooldown = 15000;
}

/**
 * Check if a tile is occupied by a placed item.
 */
function isTileOccupied(x: number, y: number, items: PlacedItem[]): boolean {
  return items.some((item) => item.gridX === x && item.gridY === y);
}

/**
 * Check if a grid coordinate is within valid bounds.
 */
function isValidGrid(x: number, y: number): boolean {
  return x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE;
}

/**
 * Pick a movement target based on current AI state.
 */
function pickTarget(
  ai: PetAIState,
  playerX: number,
  playerY: number,
  items: PlacedItem[],
): void {
  if (ai.state === "APPROACH") {
    // Move one step toward player
    const dx = playerX - ai.x;
    const dy = playerY - ai.y;

    if (Math.abs(dx) >= Math.abs(dy)) {
      ai.targetX = ai.x + Math.sign(dx);
      ai.targetY = ai.y;
    } else {
      ai.targetX = ai.x;
      ai.targetY = ai.y + Math.sign(dy);
    }
  } else {
    // WANDER: pick random adjacent tile
    const dirs = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];
    // Shuffle
    for (let i = dirs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
    }

    let picked = false;
    for (const d of dirs) {
      const nx = ai.x + d.dx;
      const ny = ai.y + d.dy;
      if (isValidGrid(nx, ny) && !isTileOccupied(nx, ny, items)) {
        ai.targetX = nx;
        ai.targetY = ny;
        picked = true;
        break;
      }
    }
    if (!picked) {
      ai.targetX = ai.x;
      ai.targetY = ai.y;
    }
  }

  // Clamp
  ai.targetX = Math.max(0, Math.min(GRID_SIZE - 1, ai.targetX));
  ai.targetY = Math.max(0, Math.min(GRID_SIZE - 1, ai.targetY));
  ai.moveProgress = 0;
}

/**
 * Update the pet AI state each frame.
 * @param ai - The mutable AI state object
 * @param delta - Frame delta in ms
 * @param hasPet - Whether a pet is currently active
 * @param playerX - Player grid X
 * @param playerY - Player grid Y
 * @param items - Current placed items (for collision)
 */
export function updatePetAI(
  ai: PetAIState,
  delta: number,
  hasPet: boolean,
  playerX: number,
  playerY: number,
  items: PlacedItem[],
): void {
  if (!hasPet) return;

  ai.approachCooldown = Math.max(0, ai.approachCooldown - delta);

  switch (ai.state) {
    case "IDLE": {
      ai.stateTimer -= delta;
      if (ai.stateTimer <= 0) {
        const distToPlayer =
          Math.abs(ai.x - playerX) + Math.abs(ai.y - playerY);

        if (distToPlayer > 3 && ai.approachCooldown <= 0) {
          ai.state = "APPROACH";
          ai.approachCooldown = 15000;
        } else {
          ai.state = "WANDER";
        }
        pickTarget(ai, playerX, playerY, items);
      }
      break;
    }

    case "WANDER":
    case "APPROACH": {
      ai.moveProgress += delta / 650;
      if (ai.moveProgress >= 1) {
        ai.moveProgress = 1;
        ai.x = ai.targetX;
        ai.y = ai.targetY;
        ai.state = "IDLE";
        ai.stateTimer = 2000 + Math.random() * 3000;
      }
      break;
    }
  }
}

/**
 * Trigger a pet reaction (floating emoji) when the pet is interacted with.
 * Returns false if on cooldown.
 */
export function triggerPetReaction(
  ai: PetAIState,
  scene: Phaser.Scene,
  getScreenFromIso: (x: number, y: number) => { x: number; y: number },
  emojis: string[] = [
    "\u2764\uFE0F",
    "\u2B50",
    "\u2728",
    "\uD83D\uDC3E",
    "\uD83D\uDC95",
  ],
): boolean {
  const now = Date.now();
  if (now - ai.lastPetTime < 5000) return false;
  ai.lastPetTime = now;

  const emoji = emojis[Math.floor(Math.random() * emojis.length)];
  const lerpX = Phaser.Math.Linear(ai.x, ai.targetX, ai.moveProgress);
  const lerpY = Phaser.Math.Linear(ai.y, ai.targetY, ai.moveProgress);
  const screen = getScreenFromIso(lerpX, lerpY);

  const text = scene.add
    .text(screen.x, screen.y - 30, emoji, { fontSize: "24px" })
    .setOrigin(0.5)
    .setDepth(10000);

  scene.tweens.add({
    targets: text,
    y: text.y - 40,
    alpha: 0,
    duration: 1200,
    ease: "Cubic.easeOut",
    onComplete: () => text.destroy(),
  });

  return true;
}
