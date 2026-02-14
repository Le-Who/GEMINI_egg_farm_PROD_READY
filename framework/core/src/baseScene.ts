/**
 * BaseScene — Generic Phaser 3 scene with grid, camera, and rendering helpers.
 *
 * Provides common functionality for grid-based / 2D games:
 * - Isometric or orthogonal grid calculations
 * - Camera management with zoom fitting
 * - Object pooling for sprites/graphics
 * - Floating text effects
 * - Input handling (click-to-grid)
 *
 * Game-specific scenes extend this.
 */

import type { RenderingConfig } from "./types.js";
import { EventBus } from "./eventBus.js";
import { AssetManager } from "./assetManager.js";

export interface BaseSceneConfig {
  /** Phaser scene key */
  key: string;
  /** Grid configuration */
  grid?: RenderingConfig["grid"];
  /** Background color */
  backgroundColor?: number;
  /** Event bus for scene events */
  eventBus?: EventBus;
  /** Asset manager for sprite loading */
  assetManager?: AssetManager;
}

/**
 * Abstract base scene providing grid, camera, and rendering utilities.
 * Extend this class and implement drawScene() for your game.
 *
 * Usage:
 *   class MyScene extends BaseScene {
 *     drawScene() { ... }
 *   }
 */
export abstract class BaseScene extends (globalThis.Phaser?.Scene ?? class {}) {
  // Grid settings
  protected gridWidth: number = 16;
  protected gridHeight: number = 16;
  protected tileWidth: number = 64;
  protected tileHeight: number = 32;
  protected isometric: boolean = true;
  protected bgColor: number = 0x2f3136;

  // Core helpers
  protected gameBus: EventBus;
  protected assets: AssetManager;

  // Object pools for efficient rendering
  protected graphicsPool: any[] = [];
  protected graphicsPoolIndex: number = 0;
  protected spritePool: any[] = [];
  protected spritePoolIndex: number = 0;
  protected textPool: any[] = [];
  protected textPoolIndex: number = 0;

  constructor(config: BaseSceneConfig) {
    super({ key: config.key });
    this.gameBus = config.eventBus ?? new EventBus();
    this.assets = config.assetManager ?? new AssetManager();

    if (config.grid) {
      this.gridWidth = config.grid.width;
      this.gridHeight = config.grid.height;
      this.tileWidth = config.grid.tileWidth;
      this.tileHeight = config.grid.tileHeight;
      this.isometric = config.grid.isometric;
    }
    if (config.backgroundColor !== undefined) {
      this.bgColor = config.backgroundColor;
    }
  }

  /** Calculate zoom so the full grid fits in the viewport */
  calculateZoom(): number {
    const scene = this as any;
    if (!scene.cameras?.main) return 1;

    const cam = scene.cameras.main;
    const worldWidth =
      (this.gridWidth + this.gridHeight) * (this.tileWidth / 2);
    const worldHeight =
      (this.gridWidth + this.gridHeight) * (this.tileHeight / 2);
    const zoomX = cam.width / worldWidth;
    const zoomY = cam.height / worldHeight;
    return Math.min(zoomX, zoomY) * 0.85;
  }

  /** Convert grid coordinates to screen position */
  getScreenFromGrid(
    x: number,
    y: number,
  ): { screenX: number; screenY: number } {
    if (this.isometric) {
      const screenX = (x - y) * (this.tileWidth / 2);
      const screenY = (x + y) * (this.tileHeight / 2);
      return { screenX, screenY };
    }
    return {
      screenX: x * this.tileWidth,
      screenY: y * this.tileHeight,
    };
  }

  /** Convert screen position to grid coordinates */
  getGridFromScreen(
    screenX: number,
    screenY: number,
  ): { gridX: number; gridY: number } {
    if (this.isometric) {
      const gridX = Math.floor(
        (screenX / (this.tileWidth / 2) + screenY / (this.tileHeight / 2)) / 2,
      );
      const gridY = Math.floor(
        (screenY / (this.tileHeight / 2) - screenX / (this.tileWidth / 2)) / 2,
      );
      return { gridX, gridY };
    }
    return {
      gridX: Math.floor(screenX / this.tileWidth),
      gridY: Math.floor(screenY / this.tileHeight),
    };
  }

  /** Check if grid coordinates are valid */
  isValidGrid(x: number, y: number): boolean {
    return x >= 0 && x < this.gridWidth && y >= 0 && y < this.gridHeight;
  }

  /** Get a graphics object from the pool */
  protected getGraphics(): any {
    const scene = this as any;
    if (this.graphicsPoolIndex < this.graphicsPool.length) {
      const g = this.graphicsPool[this.graphicsPoolIndex++];
      g.clear();
      g.setVisible(true);
      g.setAlpha(1);
      g.setDepth(0);
      return g;
    }
    const g = scene.add.graphics();
    this.graphicsPool.push(g);
    this.graphicsPoolIndex++;
    return g;
  }

  /** Get a text object from the pool */
  protected getText(x: number, y: number, text: string, style?: any): any {
    const scene = this as any;
    const defaultStyle = {
      fontSize: "12px",
      color: "#ffffff",
      fontFamily: "Arial, sans-serif",
      stroke: "#000000",
      strokeThickness: 2,
      ...style,
    };

    if (this.textPoolIndex < this.textPool.length) {
      const t = this.textPool[this.textPoolIndex++];
      t.setPosition(x, y);
      t.setText(text);
      t.setStyle(defaultStyle);
      t.setVisible(true);
      t.setAlpha(1);
      t.setDepth(0);
      return t;
    }

    const t = scene.add.text(x, y, text, defaultStyle);
    this.textPool.push(t);
    this.textPoolIndex++;
    return t;
  }

  /** Reset all object pools (call at start of each drawScene) */
  protected resetPools(): void {
    // Hide unused pooled objects
    for (let i = this.graphicsPoolIndex; i < this.graphicsPool.length; i++) {
      this.graphicsPool[i].setVisible(false);
    }
    for (let i = this.spritePoolIndex; i < this.spritePool.length; i++) {
      this.spritePool[i].setVisible(false);
    }
    for (let i = this.textPoolIndex; i < this.textPool.length; i++) {
      this.textPool[i].setVisible(false);
    }

    this.graphicsPoolIndex = 0;
    this.spritePoolIndex = 0;
    this.textPoolIndex = 0;
  }

  /** Show floating text at a grid position */
  showFloatingText(
    gridX: number,
    gridY: number,
    text: string,
    color: string = "#ffffff",
  ): void {
    const scene = this as any;
    if (!scene.add) return;

    const { screenX, screenY } = this.getScreenFromGrid(gridX, gridY);

    const textObj = scene.add.text(screenX, screenY - 20, text, {
      fontSize: "16px",
      color,
      fontFamily: "Arial, sans-serif",
      stroke: "#000000",
      strokeThickness: 3,
      align: "center",
    });
    textObj.setOrigin(0.5, 1);
    textObj.setDepth(9999);

    scene.tweens?.add({
      targets: textObj,
      y: screenY - 60,
      alpha: 0,
      duration: 1500,
      ease: "Power2",
      onComplete: () => textObj.destroy(),
    });
  }

  /** Draw an isometric grid */
  drawGrid(color: number = 0x555555, alpha: number = 0.3): void {
    const g = this.getGraphics();
    g.lineStyle(1, color, alpha);
    g.setDepth(-1);

    for (let x = 0; x <= this.gridWidth; x++) {
      const start = this.getScreenFromGrid(x, 0);
      const end = this.getScreenFromGrid(x, this.gridHeight);
      g.lineBetween(start.screenX, start.screenY, end.screenX, end.screenY);
    }
    for (let y = 0; y <= this.gridHeight; y++) {
      const start = this.getScreenFromGrid(0, y);
      const end = this.getScreenFromGrid(this.gridWidth, y);
      g.lineBetween(start.screenX, start.screenY, end.screenX, end.screenY);
    }
  }

  /** Draw a tile highlight */
  drawHighlight(
    gridX: number,
    gridY: number,
    color: number = 0x55ff55,
    alpha: number = 0.4,
  ): void {
    if (!this.isValidGrid(gridX, gridY)) return;
    const g = this.getGraphics();
    g.setDepth(9998);

    const tl = this.getScreenFromGrid(gridX, gridY);
    const tr = this.getScreenFromGrid(gridX + 1, gridY);
    const br = this.getScreenFromGrid(gridX + 1, gridY + 1);
    const bl = this.getScreenFromGrid(gridX, gridY + 1);

    g.fillStyle(color, alpha);
    g.beginPath();
    g.moveTo(tl.screenX, tl.screenY);
    g.lineTo(tr.screenX, tr.screenY);
    g.lineTo(br.screenX, br.screenY);
    g.lineTo(bl.screenX, bl.screenY);
    g.closePath();
    g.fillPath();
  }

  /** Override this in your game scene to draw all game objects */
  abstract drawScene(): void;

  /** Format a timestamp as "X ago" */
  formatTimeAgo(timestamp: number): string {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return "just now";
  }
}
