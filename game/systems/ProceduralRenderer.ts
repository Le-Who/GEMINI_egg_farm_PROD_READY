/**
 * ProceduralRenderer — Procedural Shape Drawing for Items
 *
 * Extracted from MainScene.ts for modularity.
 * Handles generating isometric box textures for items that
 * don't have custom sprites, plus crop growth-stage sprite selection.
 */
import Phaser from "phaser";
import { TILE_WIDTH, TILE_HEIGHT, ITEMS } from "../../constants";
import { ItemType, CropConfig } from "../../types";

/**
 * Draw an isometric box procedurally onto existing Graphics.
 * Used when the sprite pool is saturated or sprite is unavailable.
 */
export function drawProceduralItemFallback(
  g: Phaser.GameObjects.Graphics,
  config: { type: ItemType; color: number },
  screenX: number,
  screenY: number,
  alpha: number,
  tint?: number | null,
): void {
  let itemHeight = 20;
  if (config.type === ItemType.PLANTER) itemHeight = 15;
  if (config.type === ItemType.INCUBATOR) itemHeight = 15;

  const baseColor = Phaser.Display.Color.IntegerToColor(config.color);
  let red = baseColor.red;
  let green = baseColor.green;
  let blue = baseColor.blue;
  if (tint != null) {
    const tintObj = Phaser.Display.Color.IntegerToColor(tint);
    red = Math.floor((red * tintObj.red) / 255);
    green = Math.floor((green * tintObj.green) / 255);
    blue = Math.floor((blue * tintObj.blue) / 255);
  }

  const color = Phaser.Display.Color.GetColor(red, green, blue);

  // Top Face
  g.fillStyle(color, alpha);
  g.fillPoints(
    [
      new Phaser.Geom.Point(screenX, screenY - itemHeight),
      new Phaser.Geom.Point(
        screenX + TILE_WIDTH / 2,
        screenY - TILE_HEIGHT / 2 - itemHeight,
      ),
      new Phaser.Geom.Point(screenX, screenY - TILE_HEIGHT - itemHeight),
      new Phaser.Geom.Point(
        screenX - TILE_WIDTH / 2,
        screenY - TILE_HEIGHT / 2 - itemHeight,
      ),
    ],
    true,
  );

  // Right side (darker)
  g.fillStyle(
    Phaser.Display.Color.GetColor(
      Math.floor(red * 0.8),
      Math.floor(green * 0.8),
      Math.floor(blue * 0.8),
    ),
    alpha,
  );
  g.fillPoints(
    [
      new Phaser.Geom.Point(
        screenX + TILE_WIDTH / 2,
        screenY - TILE_HEIGHT / 2 - itemHeight,
      ),
      new Phaser.Geom.Point(screenX, screenY - itemHeight),
      new Phaser.Geom.Point(screenX, screenY - TILE_HEIGHT),
      new Phaser.Geom.Point(
        screenX + TILE_WIDTH / 2,
        screenY - TILE_HEIGHT / 2,
      ),
    ],
    true,
  );

  // Left side (even darker)
  g.fillStyle(
    Phaser.Display.Color.GetColor(
      Math.floor(red * 0.6),
      Math.floor(green * 0.6),
      Math.floor(blue * 0.6),
    ),
    alpha,
  );
  g.fillPoints(
    [
      new Phaser.Geom.Point(
        screenX - TILE_WIDTH / 2,
        screenY - TILE_HEIGHT / 2 - itemHeight,
      ),
      new Phaser.Geom.Point(screenX, screenY - itemHeight),
      new Phaser.Geom.Point(screenX, screenY - TILE_HEIGHT),
      new Phaser.Geom.Point(
        screenX - TILE_WIDTH / 2,
        screenY - TILE_HEIGHT / 2,
      ),
    ],
    true,
  );

  // Planter soil overlay
  if (config.type === ItemType.PLANTER) {
    g.fillStyle(0x3d2817, alpha);
    g.fillPoints(
      [
        new Phaser.Geom.Point(screenX, screenY - itemHeight + 2),
        new Phaser.Geom.Point(
          screenX + TILE_WIDTH / 2 - 4,
          screenY - TILE_HEIGHT / 2 - itemHeight + 2,
        ),
        new Phaser.Geom.Point(screenX, screenY - TILE_HEIGHT - itemHeight + 4),
        new Phaser.Geom.Point(
          screenX - TILE_WIDTH / 2 + 4,
          screenY - TILE_HEIGHT / 2 - itemHeight + 2,
        ),
      ],
      true,
    );
  }
}

/**
 * Generate and cache an isometric box texture for a given item.
 * No-ops if the texture already exists.
 */
export function generateProceduralTexture(
  scene: Phaser.Scene,
  itemId: string,
): void {
  const key = `proc_${itemId}`;
  if (scene.textures.exists(key)) return;

  const config = ITEMS[itemId];
  if (!config) return;

  let itemHeight = 20;
  if (config.type === ItemType.PLANTER) itemHeight = 15;
  if (config.type === ItemType.INCUBATOR) itemHeight = 15;

  const texWidth = TILE_WIDTH;
  const texHeight = TILE_HEIGHT + itemHeight;

  const g = scene.make.graphics({ x: 0, y: 0, add: false } as any);
  const baseX = texWidth / 2;
  const baseY = texHeight;
  const color = config.color;

  // Top Face
  g.fillStyle(color, 1);
  g.fillPoints(
    [
      new Phaser.Geom.Point(baseX, baseY - itemHeight),
      new Phaser.Geom.Point(
        baseX + TILE_WIDTH / 2,
        baseY - TILE_HEIGHT / 2 - itemHeight,
      ),
      new Phaser.Geom.Point(baseX, baseY - TILE_HEIGHT - itemHeight),
      new Phaser.Geom.Point(
        baseX - TILE_WIDTH / 2,
        baseY - TILE_HEIGHT / 2 - itemHeight,
      ),
    ],
    true,
  );

  // Right Side (Darker)
  g.fillStyle(
    Phaser.Display.Color.GetColor(
      (color >> 16) & (255 * 0.8),
      (color >> 8) & (255 * 0.8),
      color & (255 * 0.8),
    ),
    1,
  );
  g.fillPoints(
    [
      new Phaser.Geom.Point(baseX, baseY - itemHeight),
      new Phaser.Geom.Point(
        baseX + TILE_WIDTH / 2,
        baseY - TILE_HEIGHT / 2 - itemHeight,
      ),
      new Phaser.Geom.Point(baseX + TILE_WIDTH / 2, baseY - TILE_HEIGHT / 2),
      new Phaser.Geom.Point(baseX, baseY),
    ],
    true,
  );

  // Left Side (Even Darker)
  g.fillStyle(
    Phaser.Display.Color.GetColor(
      (color >> 16) & (255 * 0.6),
      (color >> 8) & (255 * 0.6),
      color & (255 * 0.6),
    ),
    1,
  );
  g.fillPoints(
    [
      new Phaser.Geom.Point(baseX, baseY - itemHeight),
      new Phaser.Geom.Point(
        baseX - TILE_WIDTH / 2,
        baseY - TILE_HEIGHT / 2 - itemHeight,
      ),
      new Phaser.Geom.Point(baseX - TILE_WIDTH / 2, baseY - TILE_HEIGHT / 2),
      new Phaser.Geom.Point(baseX, baseY),
    ],
    true,
  );

  // Planter Soil
  if (config.type === ItemType.PLANTER) {
    g.fillStyle(0x3d2817, 1);
    g.fillPoints(
      [
        new Phaser.Geom.Point(baseX, baseY - itemHeight + 2),
        new Phaser.Geom.Point(
          baseX + TILE_WIDTH / 2 - 4,
          baseY - TILE_HEIGHT / 2 - itemHeight + 2,
        ),
        new Phaser.Geom.Point(baseX, baseY - TILE_HEIGHT - itemHeight + 2 + 2),
        new Phaser.Geom.Point(
          baseX - TILE_WIDTH / 2 + 4,
          baseY - TILE_HEIGHT / 2 - itemHeight + 2,
        ),
      ],
      true,
    );
  }

  g.generateTexture(key, texWidth, texHeight);
  g.destroy();
}

/**
 * Get the appropriate crop sprite path for current growth progress.
 * Returns null if no sprite is available for the current growth stage.
 */
export function getCropSprite(
  cropConfig: CropConfig,
  progress: number,
): string | null {
  // Multi-stage growth sprites (preferred)
  if (cropConfig.growthSprites && cropConfig.growthSprites.length > 0) {
    const pct = Math.floor(progress * 100);
    const sorted = [...cropConfig.growthSprites].sort(
      (a, b) => b.stage - a.stage,
    );
    for (const gs of sorted) {
      if (pct >= gs.stage) return gs.sprite;
    }
    return sorted[sorted.length - 1].sprite;
  }
  // Single sprite (only when fully grown)
  if (progress >= 1 && cropConfig.sprite) return cropConfig.sprite;
  return null;
}
