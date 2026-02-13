import Phaser from "phaser";
import {
  GRID_SIZE,
  TILE_WIDTH,
  TILE_HEIGHT,
  ITEMS,
  CROPS,
  EGGS,
  PETS,
  CANVAS_BG_COLOR,
  GARDEN_BG_COLOR,
} from "../../constants";
import {
  PlacedItem,
  ItemType,
  PetData,
  RoomType,
  CropConfig,
} from "../../types";

// Union type for anything that needs to be sorted and drawn on the grid
type RenderEntity =
  | { type: "ITEM"; data: PlacedItem; isGhost: boolean }
  | { type: "PLAYER"; gridX: number; gridY: number }
  | { type: "PET"; gridX: number; gridY: number; petData: PetData };

export class MainScene extends Phaser.Scene {
  public cameras!: Phaser.Cameras.Scene2D.CameraManager;
  public add!: Phaser.GameObjects.GameObjectFactory;
  public input!: Phaser.Input.InputPlugin;
  public time!: Phaser.Time.Clock;
  public tweens!: Phaser.Tweens.TweenManager;

  private gridGraphics!: Phaser.GameObjects.Graphics;
  private highlightGraphics!: Phaser.GameObjects.Graphics;
  private overlayGraphics!: Phaser.GameObjects.Graphics;
  private itemsGraphics!: Phaser.GameObjects.Graphics; // Persistent: items/player/pet rendering

  // Sprite rendering system — Object Pool
  private spritePool!: Phaser.GameObjects.Group; // Reusable image pool (never destroyed)
  private activeSprites: Phaser.GameObjects.Image[] = []; // Sprites used THIS frame
  private textPool!: Phaser.GameObjects.Group; // Reusable floating text pool
  private loadingTextures: Set<string> = new Set(); // URLs currently being loaded
  private loadedTextures: Set<string> = new Set(); // Successfully loaded texture keys
  private failedTextures: Set<string> = new Set(); // URLs that failed to load

  public onTileClick?: (x: number, y: number) => void;
  public placedItems: PlacedItem[] = [];
  public currentRoomType: RoomType = "interior";
  public currentPet: PetData | null = null;
  public isVisiting: boolean = false;
  public wateredPlants: Set<string> = new Set();
  public playerGridPos = { x: 7, y: 7 };
  public tutorialStep: number = 0;

  // Echo Ghost — last action of visited user
  public lastAction: {
    type: string;
    gridX: number;
    gridY: number;
    timestamp: number;
  } | null = null;

  // Editor State
  private ghostItemId: string | null = null;
  private ghostRotation: number = 0;
  private currentGhostGridPos: { x: number; y: number } | null = null;

  constructor() {
    super({ key: "MainScene" });
  }

  // Calculate zoom so the full iso grid fits in the viewport
  private calculateZoom(): number {
    const vw = this.scale.width;
    const vh = this.scale.height;
    const gridPixelWidth = GRID_SIZE * TILE_WIDTH; // 1024
    const gridPixelHeight = GRID_SIZE * TILE_HEIGHT; // 512
    const padding = 0.85; // 15% breathing room
    const zoomX = (vw * padding) / gridPixelWidth;
    const zoomY = (vh * padding) / gridPixelHeight;
    return Math.min(zoomX, zoomY, 2.0); // cap at 2x
  }

  create() {
    this.cameras.main.centerOn(0, 0);
    this.cameras.main.setZoom(this.calculateZoom());

    // Recalculate zoom on window/iframe resize
    this.scale.on("resize", () => {
      this.cameras.main.setZoom(this.calculateZoom());
      this.cameras.main.centerOn(0, 0);
      this.drawGrid();
    });

    this.gridGraphics = this.add.graphics();
    this.itemsGraphics = this.add.graphics();
    this.highlightGraphics = this.add.graphics();
    this.overlayGraphics = this.add.graphics();

    this.drawGrid();

    // --- Object Pools ---
    this.spritePool = this.add.group({
      classType: Phaser.GameObjects.Image,
      maxSize: 100, // Max sprite images in a single frame
      runChildUpdate: false,
    });
    this.textPool = this.add.group({
      classType: Phaser.GameObjects.Text,
      maxSize: 20,
      runChildUpdate: false,
    });

    // --- Input for tile clicking ---
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      const cam = this.cameras.main;
      const worldX = pointer.x / cam.zoom + cam.scrollX;
      const worldY = pointer.y / cam.zoom + cam.scrollY;
      const iso = this.getIsoFromScreen(worldX, worldY);
      if (this.isValidGrid(iso.x, iso.y) && this.onTileClick) {
        this.onTileClick(iso.x, iso.y);
      }
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      const { x, y } = this.getIsoFromScreen(pointer.worldX, pointer.worldY);
      this.currentGhostGridPos = { x, y };
    });
  }

  update() {
    this.drawScene();
  }

  public setRoomData(
    items: PlacedItem[],
    roomType: RoomType,
    currentPet: PetData | null = null,
    isVisiting = false,
    wateredPlants?: Set<string>,
    tutorialStep: number = 0,
    lastAction?: {
      type: string;
      gridX: number;
      gridY: number;
      timestamp: number;
    } | null,
  ) {
    this.placedItems = items;
    this.currentRoomType = roomType;
    this.currentPet = currentPet;
    this.isVisiting = isVisiting;
    this.wateredPlants = wateredPlants || new Set();
    this.tutorialStep = tutorialStep;
    this.lastAction = lastAction || null;

    const bgColor =
      this.currentRoomType === "garden" ? GARDEN_BG_COLOR : CANVAS_BG_COLOR;
    this.cameras.main.setBackgroundColor(bgColor);

    this.drawGrid();
  }

  public setGhostItem(itemId: string | null, rotation: number) {
    this.ghostItemId = itemId;
    this.ghostRotation = rotation;
  }

  public setPlayerPos(x: number, y: number) {
    this.playerGridPos = { x, y };
  }

  public showFloatingText(
    gridX: number,
    gridY: number,
    text: string,
    color: string,
  ) {
    const screen = this.getScreenFromIso(gridX, gridY);

    // Acquire from pool or create new
    let textObj = this.textPool.getFirstDead(
      false,
    ) as Phaser.GameObjects.Text | null;
    if (textObj) {
      textObj.setActive(true).setVisible(true);
      textObj.setPosition(screen.x, screen.y - 60);
      textObj.setText(text);
      textObj.setStyle({ color: color });
      textObj.setAlpha(1).setScale(1);
      textObj.setOrigin(0.5);
    } else {
      textObj = this.add
        .text(screen.x, screen.y - 60, text, {
          fontFamily: "monospace",
          fontSize: "20px",
          color: color,
          stroke: "#000000",
          strokeThickness: 4,
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      this.textPool.add(textObj);
    }

    this.tweens.add({
      targets: textObj,
      y: screen.y - 120,
      alpha: 0,
      scale: 1.5,
      duration: 1200,
      ease: "Back.easeOut",
      onComplete: () => {
        (textObj as Phaser.GameObjects.Text).setActive(false).setVisible(false);
      },
    });
  }

  // --- Sprite Texture Management ---

  /** Get a texture key from a sprite URL path like /sprites/foo.png */
  private getSpriteKey(spritePath: string): string {
    return `sprite_${spritePath.replace(/[^a-zA-Z0-9]/g, "_")}`;
  }

  /** Dynamically load a sprite texture from URL. Returns true if texture is ready. */
  private ensureSpriteLoaded(spritePath: string): boolean {
    if (!spritePath) return false;
    const key = this.getSpriteKey(spritePath);

    // Already loaded?
    if (this.loadedTextures.has(key)) return true;
    // Already failed?
    if (this.failedTextures.has(key)) return false;
    // Currently loading?
    if (this.loadingTextures.has(key)) return false;

    // Start loading
    this.loadingTextures.add(key);
    this.load.image(key, spritePath);
    this.load.once("filecomplete-image-" + key, () => {
      this.loadingTextures.delete(key);
      this.loadedTextures.add(key);
    });
    this.load.once("loaderror", (file: any) => {
      if (file.key === key) {
        this.loadingTextures.delete(key);
        this.failedTextures.add(key);
        console.warn(`Failed to load sprite: ${spritePath}`);
      }
    });
    this.load.start();
    return false;
  }

  /** Place a sprite image at screen coordinates, sized to fit an isometric tile.
   *  @param originY  Vertical anchor: 0.5 = center (default, for furniture), 1.0 = bottom (for crops/plants)
   *  @param tint     Optional color tint (hex, e.g. 0xff4444) applied via Phaser setTint */
  private drawSpriteImage(
    spritePath: string,
    screenX: number,
    screenY: number,
    width: number,
    height: number,
    alpha: number = 1,
    depth: number = 0,
    originY: number = 0.5,
    tint?: number | null,
  ): boolean {
    const key = this.getSpriteKey(spritePath);
    if (!this.loadedTextures.has(key)) {
      this.ensureSpriteLoaded(spritePath);
      return false; // Not ready yet, caller should fallback
    }

    // Acquire from pool or create new
    let img = this.spritePool.getFirstDead(
      false,
    ) as Phaser.GameObjects.Image | null;
    if (img) {
      img.setActive(true).setVisible(true);
      img.setTexture(key);
      img.setPosition(screenX, screenY);
    } else {
      img = this.add.image(screenX, screenY, key);
      this.spritePool.add(img);
    }
    img.setOrigin(0.5, originY);
    img.setDisplaySize(width, height);
    img.setAlpha(alpha);
    img.setDepth(depth);
    // Apply or clear tint
    if (tint != null) {
      img.setTint(tint);
    } else {
      img.clearTint();
    }
    this.activeSprites.push(img);
    return true;
  }

  /** Get the appropriate crop sprite for current growth progress */
  private getCropSprite(
    cropConfig: CropConfig,
    progress: number,
  ): string | null {
    // Multi-stage growth sprites (preferred)
    if (cropConfig.growthSprites && cropConfig.growthSprites.length > 0) {
      const pct = Math.floor(progress * 100);
      // Sort stages descending, find first where stage <= current progress
      const sorted = [...cropConfig.growthSprites].sort(
        (a, b) => b.stage - a.stage,
      );
      for (const gs of sorted) {
        if (pct >= gs.stage) return gs.sprite;
      }
      return sorted[sorted.length - 1].sprite; // Fallback to lowest stage
    }
    // Single sprite (only when fully grown)
    if (progress >= 1 && cropConfig.sprite) return cropConfig.sprite;
    return null;
  }

  private drawScene() {
    // 1. Clear previous frame
    this.highlightGraphics.clear();
    this.overlayGraphics.clear();
    this.itemsGraphics.clear();

    // Return previous frame's sprites to pool (deactivate, don't destroy)
    for (const img of this.activeSprites) {
      img.setActive(false).setVisible(false);
    }
    this.activeSprites.length = 0;

    // 2. Build Render List
    const renderList: RenderEntity[] = [];

    // Items
    this.placedItems.forEach((item) => {
      renderList.push({ type: "ITEM", data: item, isGhost: false });
    });

    // Ghost Item
    if (
      this.ghostItemId &&
      this.currentGhostGridPos &&
      this.isValidGrid(this.currentGhostGridPos.x, this.currentGhostGridPos.y)
    ) {
      renderList.push({
        type: "ITEM",
        isGhost: true,
        data: {
          id: "ghost",
          itemId: this.ghostItemId,
          gridX: this.currentGhostGridPos.x,
          gridY: this.currentGhostGridPos.y,
          rotation: this.ghostRotation,
          placedAt: Date.now(),
          meta: {},
          cropData: null,
        },
      });
    }

    // Player
    renderList.push({
      type: "PLAYER",
      gridX: this.playerGridPos.x,
      gridY: this.playerGridPos.y,
    });

    // Pet
    if (this.currentPet) {
      // Simple "follow" logic: Pet is 1 unit behind player or beside
      const petX = Math.max(
        0,
        Math.min(GRID_SIZE - 1, this.playerGridPos.x - 1),
      );
      const petY = Math.max(0, Math.min(GRID_SIZE - 1, this.playerGridPos.y)); // beside

      renderList.push({
        type: "PET",
        gridX: petX,
        gridY: petY,
        petData: this.currentPet,
      });
    }

    // 3. Sort by Depth
    renderList.sort((a, b) => {
      // Primary sort: Isometric depth (x + y)
      const aDepth =
        (a.type === "ITEM" ? a.data.gridX : a.gridX) +
        (a.type === "ITEM" ? a.data.gridY : a.gridY);
      const bDepth =
        (b.type === "ITEM" ? b.data.gridX : b.gridX) +
        (b.type === "ITEM" ? b.data.gridY : b.gridY);

      if (aDepth !== bDepth) return aDepth - bDepth;

      // Secondary sort: X coordinate
      const aX = a.type === "ITEM" ? a.data.gridX : a.gridX;
      const bX = b.type === "ITEM" ? b.data.gridX : b.gridX;
      return aX - bX;
    });

    // 4. Draw All Entities
    renderList.forEach((entity) => {
      if (entity.type === "ITEM") {
        this.drawItem(entity.data, entity.isGhost);
      } else if (entity.type === "PLAYER") {
        this.drawPlayer(entity.gridX, entity.gridY);
      } else if (entity.type === "PET") {
        this.drawPet(entity.gridX, entity.gridY, entity.petData);
      }
    });

    // 5. Draw Highlight (On Top of items to be clear)
    if (this.currentGhostGridPos && !this.isVisiting) {
      this.drawHighlight(
        this.currentGhostGridPos.x,
        this.currentGhostGridPos.y,
      );
    }

    // 6. Draw Tutorial Hints
    this.drawTutorialHints();

    // 7. Echo Ghost glow (when visiting, show last action of the host)
    if (this.isVisiting && this.lastAction) {
      const age = Date.now() - this.lastAction.timestamp;
      if (age < 24 * 60 * 60 * 1000) {
        // Only show within 24 hours
        const screen = this.getScreenFromIso(
          this.lastAction.gridX,
          this.lastAction.gridY,
        );
        const pulse = 0.3 + 0.2 * Math.sin(Date.now() / 400); // Breathing glow
        const g = this.overlayGraphics;
        g.fillStyle(0x88ccff, pulse);
        g.fillCircle(screen.x, screen.y, 18);
        g.fillStyle(0xffffff, pulse + 0.1);
        g.fillCircle(screen.x, screen.y, 8);

        // Action type icon hint
        const icons: Record<string, string> = {
          PLANT: "🌱",
          HARVEST: "🌾",
          PLACE: "📦",
          PICKUP: "🔄",
        };
        const icon = icons[this.lastAction.type] || "✨";
        const textKey = `ghost_${this.lastAction.gridX}_${this.lastAction.gridY}`;
        let label = this.children.getByName(
          textKey,
        ) as Phaser.GameObjects.Text | null;
        if (!label) {
          label = this.add
            .text(screen.x, screen.y - 28, icon, {
              fontSize: "16px",
            })
            .setOrigin(0.5)
            .setName(textKey)
            .setDepth(9999);
        }
        label.setPosition(screen.x, screen.y - 28);
        label.setAlpha(pulse + 0.3);
      }
    }
  }

  private drawTutorialHints() {
    if (this.tutorialStep === 3) {
      // "Click the Planter to plant Mint"
      this.placedItems.forEach((item) => {
        const config = ITEMS[item.itemId];
        if (config.type === ItemType.PLANTER && !item.cropData) {
          this.drawBounceArrow(item.gridX, item.gridY, 0xffff00);
        }
      });
    }

    if (this.tutorialStep === 4) {
      // "Harvest"
      this.placedItems.forEach((item) => {
        if (item.cropData) {
          const cropConfig = CROPS[item.cropData.cropId];
          const isReady =
            Date.now() - item.cropData.plantedAt >=
            cropConfig.growthTime * 1000;
          if (isReady) {
            this.drawBounceArrow(item.gridX, item.gridY, 0x00ff00);
          }
        }
      });
    }
  }

  private drawBounceArrow(gridX: number, gridY: number, color: number) {
    const screen = this.getScreenFromIso(gridX, gridY);
    const bounce = Math.sin(this.time.now / 150) * 10;

    this.overlayGraphics.lineStyle(4, 0x000000, 1);
    this.overlayGraphics.fillStyle(color, 1);

    const ay = screen.y - 60 + bounce;

    // Arrow shape
    const path = [
      new Phaser.Geom.Point(screen.x - 10, ay - 20),
      new Phaser.Geom.Point(screen.x + 10, ay - 20),
      new Phaser.Geom.Point(screen.x + 10, ay),
      new Phaser.Geom.Point(screen.x + 20, ay),
      new Phaser.Geom.Point(screen.x, ay + 20),
      new Phaser.Geom.Point(screen.x - 20, ay),
      new Phaser.Geom.Point(screen.x - 10, ay),
    ];

    this.overlayGraphics.fillPoints(path, true);
    this.overlayGraphics.strokePoints(path, true);
  }

  private drawPlayer(gridX: number, gridY: number) {
    const screen = this.getScreenFromIso(gridX, gridY);
    const g = this.itemsGraphics;
    const bounce = Math.sin(this.time.now / 200) * 3;

    // Shadow
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(screen.x, screen.y, 24, 12);

    // Body
    g.fillStyle(0x3366cc, 1);
    g.fillRect(screen.x - 8, screen.y - 35 + bounce, 16, 25);

    // Head
    g.fillStyle(0xffccaa, 1);
    g.fillCircle(screen.x, screen.y - 42 + bounce, 10);

    // Hat
    g.fillStyle(0xddaa44, 1);
    g.fillEllipse(screen.x, screen.y - 48 + bounce, 26, 8);
    g.fillCircle(screen.x, screen.y - 52 + bounce, 8);

    // No renderGroup.add needed — using persistent graphics
  }

  private drawPet(gridX: number, gridY: number, data: PetData) {
    const config = PETS[data.configId];
    if (!config) return;

    const screen = this.getScreenFromIso(gridX, gridY);
    const g = this.itemsGraphics;
    const bounce = Math.sin(this.time.now / 150) * 4;
    const depth = gridX + gridY;

    // Shadow
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(screen.x, screen.y, 16, 8);

    // Try sprite rendering
    if (config.sprite) {
      const drawn = this.drawSpriteImage(
        config.sprite,
        screen.x,
        screen.y - 10 + bounce - 12, // Center-anchor: position at visual center
        24,
        24,
        1,
        depth,
      );
      if (drawn) return; // Sprite rendered, skip procedural
    }

    // Procedural fallback
    g.fillStyle(config.color, 1);
    g.fillCircle(screen.x, screen.y - 10 + bounce, 10);

    // Eyes
    g.fillStyle(0xffffff, 1);
    g.fillCircle(screen.x - 3, screen.y - 12 + bounce, 3);
    g.fillCircle(screen.x + 3, screen.y - 12 + bounce, 3);
    g.fillStyle(0x000000, 1);
    g.fillCircle(screen.x - 3, screen.y - 12 + bounce, 1);
    g.fillCircle(screen.x + 3, screen.y - 12 + bounce, 1);
  }

  private drawItem(item: PlacedItem, isGhost: boolean) {
    const config = ITEMS[item.itemId];
    if (!config) return;

    const screen = this.getScreenFromIso(item.gridX, item.gridY);
    const g = this.itemsGraphics;
    const depth = item.gridX + item.gridY;

    let color = config.color;
    let alpha = isGhost ? 0.6 : 1;

    if (isGhost) {
      const pulse = Math.sin(this.time.now / 200) * 0.1 + 0.6;
      alpha = pulse;
    }

    // Height
    let height = 20;
    if (config.type === ItemType.PLANTER) height = 15;
    if (config.type === ItemType.INCUBATOR) height = 15;

    // --- Try sprite rendering for non-planter/non-incubator items ---
    if (
      config.sprite &&
      config.type !== ItemType.PLANTER &&
      config.type !== ItemType.INCUBATOR
    ) {
      const spriteW = TILE_WIDTH * config.width;
      const spriteH = spriteW * 1.2; // Slightly taller than wide for 3D feel
      const drawn = this.drawSpriteImage(
        config.sprite,
        screen.x,
        screen.y - height - spriteH / 2, // Center-anchor: position at visual center above base
        spriteW,
        spriteH,
        alpha,
        depth,
        0.5,
        item.tint, // Apply dye tint if set
      );
      if (drawn) return; // Sprite rendered — skip procedural
    }

    // --- Procedural fallback: isometric box ---
    g.fillStyle(color, alpha);

    // Top
    g.fillPoints(
      [
        new Phaser.Geom.Point(screen.x, screen.y - height),
        new Phaser.Geom.Point(
          screen.x + TILE_WIDTH / 2,
          screen.y - TILE_HEIGHT / 2 - height,
        ),
        new Phaser.Geom.Point(screen.x, screen.y - TILE_HEIGHT - height),
        new Phaser.Geom.Point(
          screen.x - TILE_WIDTH / 2,
          screen.y - TILE_HEIGHT / 2 - height,
        ),
      ],
      true,
    );

    // Sides (Darker)
    g.fillStyle(
      Phaser.Display.Color.GetColor(
        (color >> 16) & (255 * 0.8),
        (color >> 8) & (255 * 0.8),
        color & (255 * 0.8),
      ),
      alpha,
    );
    g.fillPoints(
      [
        new Phaser.Geom.Point(screen.x, screen.y - height),
        new Phaser.Geom.Point(
          screen.x + TILE_WIDTH / 2,
          screen.y - TILE_HEIGHT / 2 - height,
        ),
        new Phaser.Geom.Point(
          screen.x + TILE_WIDTH / 2,
          screen.y - TILE_HEIGHT / 2,
        ),
        new Phaser.Geom.Point(screen.x, screen.y),
      ],
      true,
    );

    g.fillStyle(
      Phaser.Display.Color.GetColor(
        (color >> 16) & (255 * 0.6),
        (color >> 8) & (255 * 0.6),
        color & (255 * 0.6),
      ),
      alpha,
    );
    g.fillPoints(
      [
        new Phaser.Geom.Point(screen.x, screen.y - height),
        new Phaser.Geom.Point(
          screen.x - TILE_WIDTH / 2,
          screen.y - TILE_HEIGHT / 2 - height,
        ),
        new Phaser.Geom.Point(
          screen.x - TILE_WIDTH / 2,
          screen.y - TILE_HEIGHT / 2,
        ),
        new Phaser.Geom.Point(screen.x, screen.y),
      ],
      true,
    );

    // Crop rendering
    if (config.type === ItemType.PLANTER) {
      g.fillStyle(0x3d2817, alpha); // Soil
      g.fillPoints(
        [
          new Phaser.Geom.Point(screen.x, screen.y - height + 2),
          new Phaser.Geom.Point(
            screen.x + TILE_WIDTH / 2 - 4,
            screen.y - TILE_HEIGHT / 2 - height + 2,
          ),
          new Phaser.Geom.Point(
            screen.x,
            screen.y - TILE_HEIGHT - height + 2 + 2,
          ),
          new Phaser.Geom.Point(
            screen.x - TILE_WIDTH / 2 + 4,
            screen.y - TILE_HEIGHT / 2 - height + 2,
          ),
        ],
        true,
      );

      if (item.cropData) {
        const cropConfig = CROPS[item.cropData.cropId];
        if (cropConfig) {
          const progress = Math.min(
            1,
            (Date.now() - item.cropData.plantedAt) /
              (cropConfig.growthTime * 1000),
          );
          const cx = screen.x;
          const cy = screen.y - height - 5;

          // Try sprite-based crop rendering
          const cropSprite = this.getCropSprite(cropConfig, progress);
          if (cropSprite) {
            // Eased growth curve — fast when young, slowing near maturity
            const easedP = Phaser.Math.Easing.Quadratic.Out(progress);
            const cropH = 12 + easedP * 30;

            // Maintain source aspect ratio
            const spriteKey = this.getSpriteKey(cropSprite);
            const tex = this.textures.exists(spriteKey)
              ? this.textures.get(spriteKey)
              : null;
            const srcImg = tex?.getSourceImage();
            const ratio = srcImg ? srcImg.width / srcImg.height : 0.6;
            const cropW = cropH * ratio;

            // Bottom-anchor: sprite grows UP from soil surface
            const soilY = screen.y - height;
            const drawn = this.drawSpriteImage(
              cropSprite,
              cx,
              soilY, // Base position = top of planter (soil)
              cropW,
              cropH,
              alpha,
              depth + 0.1,
              1.0, // originY = 1.0 — bottom-anchored
            );
            if (drawn) {
              // Sparkle effect for ready crops (above the plant top)
              if (progress >= 1 && !this.isVisiting) {
                g.lineStyle(2, 0xffff00, alpha);
                g.strokeCircle(cx, soilY - cropH - 5, 8);
              }
              return; // Skip procedural crop drawing
            }
          }

          // Procedural crop fallback
          g.fillStyle(progress < 1 ? 0x88aa88 : cropConfig.color, alpha);
          const growH = 5 + progress * 25;
          g.fillRect(cx - 3, cy - growH, 6, growH);
          if (progress >= 1) {
            g.fillCircle(cx, cy - growH, 6);
            if (!this.isVisiting) {
              g.lineStyle(2, 0xffff00, alpha);
              g.strokeCircle(cx, cy - growH - 5, 8);
            }
          }
        }
      }
    }

    // Incubator
    if (config.type === ItemType.INCUBATOR) {
      if (item.meta?.eggId) {
        const egg = EGGS[item.meta.eggId];

        // Egg body
        g.fillStyle(0xffeebb, alpha);
        g.fillEllipse(screen.x, screen.y - height - 10, 14, 18);
        // Spots
        g.fillStyle(0xccaa88, alpha);
        g.fillCircle(screen.x - 3, screen.y - height - 12, 2);

        if (egg) {
          const elapsed = (Date.now() - (item.meta.hatchStart || 0)) / 1000;
          const progress = Math.min(1, elapsed / egg.hatchTime);

          // Progress bar background
          const barWidth = 30;
          const barHeight = 4;
          const barX = screen.x - barWidth / 2;
          const barY = screen.y - height + 8;

          g.fillStyle(0x333333, 0.8);
          g.fillRect(barX, barY, barWidth, barHeight);

          // Progress bar fill
          const fillColor = progress >= 1 ? 0x00ff88 : 0xffaa00;
          g.fillStyle(fillColor, alpha);
          g.fillRect(barX, barY, barWidth * progress, barHeight);

          // Border
          g.lineStyle(1, 0x666666, alpha);
          g.strokeRect(barX, barY, barWidth, barHeight);

          if (progress >= 1) {
            // Ready sparkle effect
            if (!this.isVisiting) {
              const sparkle = Math.sin(this.time.now / 150) * 0.5 + 0.5;
              g.lineStyle(2, 0x00ff88, sparkle);
              g.strokeCircle(screen.x, screen.y - height - 10, 14);
              g.lineStyle(1, 0xffff00, sparkle * 0.6);
              g.strokeCircle(screen.x, screen.y - height - 10, 18);
            }
          } else {
            // Time remaining text
            const remaining = Math.ceil(egg.hatchTime - elapsed);
            const mins = Math.floor(remaining / 60);
            const secs = remaining % 60;
            const timeText = mins > 0 ? `${mins}m${secs}s` : `${secs}s`;

            // We draw a small "%" indicator near the bar since Phaser graphics can't draw text
            // The progress bar itself visually indicates time left
          }
        }
      }
    }

    // No renderGroup.add needed — using persistent graphics
  }

  private drawGrid() {
    this.gridGraphics.clear();
    const color = this.isVisiting ? 0x6688aa : 0x555555;
    this.gridGraphics.lineStyle(2, color, 0.3);

    for (let x = 0; x < GRID_SIZE; x++) {
      for (let y = 0; y < GRID_SIZE; y++) {
        const screen = this.getScreenFromIso(x, y);
        const points = [
          new Phaser.Geom.Point(screen.x, screen.y),
          new Phaser.Geom.Point(
            screen.x + TILE_WIDTH / 2,
            screen.y - TILE_HEIGHT / 2,
          ),
          new Phaser.Geom.Point(screen.x, screen.y - TILE_HEIGHT),
          new Phaser.Geom.Point(
            screen.x - TILE_WIDTH / 2,
            screen.y - TILE_HEIGHT / 2,
          ),
        ];
        this.gridGraphics.strokePoints(points, true);
      }
    }
  }

  private drawHighlight(gridX: number, gridY: number) {
    if (this.isValidGrid(gridX, gridY)) {
      const screen = this.getScreenFromIso(gridX, gridY);

      const pulse = Math.abs(Math.sin(this.time.now / 300));
      this.highlightGraphics.lineStyle(3, 0xffffff, 0.5 + pulse * 0.5); // Pulsing white border
      this.highlightGraphics.fillStyle(0xffffff, 0.1);

      const points = [
        new Phaser.Geom.Point(screen.x, screen.y),
        new Phaser.Geom.Point(
          screen.x + TILE_WIDTH / 2,
          screen.y - TILE_HEIGHT / 2,
        ),
        new Phaser.Geom.Point(screen.x, screen.y - TILE_HEIGHT),
        new Phaser.Geom.Point(
          screen.x - TILE_WIDTH / 2,
          screen.y - TILE_HEIGHT / 2,
        ),
      ];
      this.highlightGraphics.fillPoints(points, true);
      this.highlightGraphics.strokePoints(points, true);
    }
  }

  private getScreenFromIso(x: number, y: number) {
    const isoX = (x - y) * (TILE_WIDTH / 2);
    const isoY = (x + y) * (TILE_HEIGHT / 2);
    const offsetY = -(GRID_SIZE * TILE_HEIGHT) / 2;
    return { x: isoX, y: isoY + offsetY };
  }

  private getIsoFromScreen(screenX: number, screenY: number) {
    const offsetY = -(GRID_SIZE * TILE_HEIGHT) / 2;
    const adjY = screenY - offsetY;
    const adjX = screenX;
    const halfW = TILE_WIDTH / 2;
    const halfH = TILE_HEIGHT / 2;
    // Adding 0.5 helps center the hit detection logic for rounding
    const mu = adjY / halfH;
    const mv = adjX / halfW;
    const x = Math.round((mu + mv) / 2);
    const y = Math.round((mu - mv) / 2);
    return { x, y };
  }

  private isValidGrid(x: number, y: number) {
    return x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE;
  }
}
