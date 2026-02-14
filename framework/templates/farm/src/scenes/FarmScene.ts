/**
 * {{GAME_TITLE}} — Farm Scene (Phaser 3)
 *
 * Isometric farm rendering with crop planting, harvesting, and decoration placement.
 */

import { BaseScene } from "@discord-activities/core";
import type { PlacedItem, FarmRoom } from "../types";

export class FarmScene extends BaseScene {
  private roomItems: PlacedItem[] = [];
  private roomType: string = "interior";
  private selectedItem: string | null = null;
  private playerX: number = 8;
  private playerY: number = 8;

  constructor() {
    super({
      key: "FarmScene",
      grid: {
        width: 16,
        height: 16,
        tileWidth: 64,
        tileHeight: 32,
        isometric: true,
      },
      backgroundColor: 0x2f3136,
    });
  }

  create(): void {
    const scene = this as any;
    scene.cameras.main.setBackgroundColor(this.bgColor);
    scene.cameras.main.setZoom(this.calculateZoom());
    scene.cameras.main.centerOn(0, (this.gridWidth * this.tileHeight) / 2);

    // Input: click to interact
    scene.input.on("pointerdown", (pointer: any) => {
      const worldPoint = scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const { gridX, gridY } = this.getGridFromScreen(
        worldPoint.x,
        worldPoint.y,
      );
      if (this.isValidGrid(gridX, gridY)) {
        this.gameBus.emit("grid:click", { gridX, gridY });
      }
    });

    // Redraw on data change
    this.gameBus.on("room:update", () => this.drawScene());

    // Initial draw
    this.drawScene();
  }

  /** Update room data from game engine */
  setRoomData(items: PlacedItem[], roomType: string): void {
    this.roomItems = items;
    this.roomType = roomType;
    this.drawScene();
  }

  drawScene(): void {
    this.resetPools();
    this.drawGrid(0x555555, 0.3);

    // Draw placed items sorted by depth (Y-axis)
    const sorted = [...this.roomItems].sort(
      (a, b) => a.gridY + a.gridX - (b.gridY + b.gridX),
    );

    for (const item of sorted) {
      this.drawFarmItem(item);
    }

    // Draw player
    this.drawPlayer();
  }

  private drawFarmItem(item: PlacedItem): void {
    const { screenX, screenY } = this.getScreenFromGrid(item.gridX, item.gridY);
    const g = this.getGraphics();
    const depth = item.gridX + item.gridY;

    // Simple colored rectangle for now (sprite loading would go here)
    const color = item.tint ?? 0x88aa44;
    g.fillStyle(color, 0.9);
    g.setDepth(depth);

    if (item.cropData) {
      // Crop: draw growing indicator
      const elapsed = Date.now() - item.cropData.plantedAt;
      const progress = Math.min(elapsed / 60000, 1); // 1 minute for demo
      const h = 20 + progress * 20;
      g.fillRect(screenX - 10, screenY - h, 20, h);

      // Growth progress text
      if (!item.cropData.isReady) {
        const pct = Math.floor(progress * 100);
        this.getText(screenX, screenY - h - 14, `${pct}%`, {
          fontSize: "10px",
          color: "#aaffaa",
        })
          .setOrigin(0.5, 1)
          .setDepth(depth + 1);
      } else {
        this.getText(screenX, screenY - h - 14, "✓", {
          fontSize: "14px",
          color: "#ffff00",
        })
          .setOrigin(0.5, 1)
          .setDepth(depth + 1);
      }
    } else {
      // Furniture/decoration: simple box
      g.fillRect(screenX - 15, screenY - 25, 30, 25);
    }
  }

  private drawPlayer(): void {
    const { screenX, screenY } = this.getScreenFromGrid(
      this.playerX,
      this.playerY,
    );
    const g = this.getGraphics();
    g.setDepth(this.playerX + this.playerY + 0.5);

    // Simple player avatar
    g.fillStyle(0x5865f2, 1); // Discord blurple
    g.fillCircle(screenX, screenY - 20, 10);
    g.fillRect(screenX - 6, screenY - 10, 12, 15);
  }
}
