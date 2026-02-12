
import Phaser from 'phaser';
import { GRID_SIZE, TILE_WIDTH, TILE_HEIGHT, ITEMS, CROPS, EGGS, PETS, CANVAS_BG_COLOR, GARDEN_BG_COLOR } from '../../constants';
import { PlacedItem, ItemType, PetData, RoomType } from '../../types';

// Union type for anything that needs to be sorted and drawn on the grid
type RenderEntity = 
  | { type: 'ITEM'; data: PlacedItem; isGhost: boolean }
  | { type: 'PLAYER'; gridX: number; gridY: number }
  | { type: 'PET'; gridX: number; gridY: number; petData: PetData };

export class MainScene extends Phaser.Scene {
  public cameras!: Phaser.Cameras.Scene2D.CameraManager;
  public add!: Phaser.GameObjects.GameObjectFactory;
  public input!: Phaser.Input.InputPlugin;
  public time!: Phaser.Time.Clock;
  public tweens!: Phaser.Tweens.TweenManager;

  private gridGraphics!: Phaser.GameObjects.Graphics;
  private highlightGraphics!: Phaser.GameObjects.Graphics;
  private overlayGraphics!: Phaser.GameObjects.Graphics; // Drawn on top of everything
  private renderGroup!: Phaser.GameObjects.Group; // Single group for sorted content
  
  public onTileClick?: (x: number, y: number) => void;
  public placedItems: PlacedItem[] = [];
  public currentRoomType: RoomType = 'interior';
  public currentPet: PetData | null = null;
  public isVisiting: boolean = false;
  public wateredPlants: Set<string> = new Set();
  public playerGridPos = { x: 7, y: 7 };
  public tutorialStep: number = 0;
  
  // Editor State
  private ghostItemId: string | null = null;
  private ghostRotation: number = 0;
  private currentGhostGridPos: { x: number, y: number } | null = null;

  constructor() {
    super({ key: 'MainScene' });
  }

  create() {
    this.cameras.main.centerOn(0, 0);
    this.cameras.main.setZoom(1.2);

    this.gridGraphics = this.add.graphics();
    this.renderGroup = this.add.group(); // Use one group for depth-sorted items/chars
    this.highlightGraphics = this.add.graphics(); // Drawn AFTER renderGroup to be visible
    this.overlayGraphics = this.add.graphics();

    this.drawGrid();

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const { x, y } = this.getIsoFromScreen(pointer.worldX, pointer.worldY);
      if (this.isValidGrid(x, y)) {
        if (this.onTileClick) {
          this.onTileClick(x, y);
        }
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
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
      tutorialStep: number = 0
    ) {
    this.placedItems = items;
    this.currentRoomType = roomType;
    this.currentPet = currentPet;
    this.isVisiting = isVisiting;
    this.wateredPlants = wateredPlants || new Set();
    this.tutorialStep = tutorialStep;
    
    const bgColor = this.currentRoomType === 'garden' ? GARDEN_BG_COLOR : CANVAS_BG_COLOR;
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

  public showFloatingText(gridX: number, gridY: number, text: string, color: string) {
      const screen = this.getScreenFromIso(gridX, gridY);
      const textObj = this.add.text(screen.x, screen.y - 60, text, {
          fontFamily: 'monospace',
          fontSize: '20px',
          color: color,
          stroke: '#000000',
          strokeThickness: 4,
          fontStyle: 'bold'
      }).setOrigin(0.5);

      this.tweens.add({
          targets: textObj,
          y: screen.y - 120,
          alpha: 0,
          scale: 1.5,
          duration: 1200,
          ease: 'Back.easeOut',
          onComplete: () => textObj.destroy()
      });
  }

  private drawScene() {
    // 1. Clear previous frame
    this.highlightGraphics.clear();
    this.overlayGraphics.clear();
    this.renderGroup.clear(true, true);

    // 2. Build Render List
    const renderList: RenderEntity[] = [];

    // Items
    this.placedItems.forEach(item => {
      renderList.push({ type: 'ITEM', data: item, isGhost: false });
    });

    // Ghost Item
    if (this.ghostItemId && this.currentGhostGridPos && this.isValidGrid(this.currentGhostGridPos.x, this.currentGhostGridPos.y)) {
        renderList.push({
            type: 'ITEM',
            isGhost: true,
            data: {
                id: 'ghost',
                itemId: this.ghostItemId,
                gridX: this.currentGhostGridPos.x,
                gridY: this.currentGhostGridPos.y,
                rotation: this.ghostRotation,
                placedAt: Date.now(),
                meta: {},
                cropData: null
            }
        });
    }

    // Player
    renderList.push({
        type: 'PLAYER',
        gridX: this.playerGridPos.x,
        gridY: this.playerGridPos.y
    });

    // Pet
    if (this.currentPet) {
         // Simple "follow" logic: Pet is 1 unit behind player or beside
         const petX = Math.max(0, Math.min(GRID_SIZE-1, this.playerGridPos.x - 1));
         const petY = Math.max(0, Math.min(GRID_SIZE-1, this.playerGridPos.y)); // beside
         
         renderList.push({
             type: 'PET',
             gridX: petX,
             gridY: petY,
             petData: this.currentPet
         });
    }

    // 3. Sort by Depth
    renderList.sort((a, b) => {
        // Primary sort: Isometric depth (x + y)
        const aDepth = (a.type === 'ITEM' ? a.data.gridX : a.gridX) + (a.type === 'ITEM' ? a.data.gridY : a.gridY);
        const bDepth = (b.type === 'ITEM' ? b.data.gridX : b.gridX) + (b.type === 'ITEM' ? b.data.gridY : b.gridY);
        
        if (aDepth !== bDepth) return aDepth - bDepth;

        // Secondary sort: X coordinate
        const aX = a.type === 'ITEM' ? a.data.gridX : a.gridX;
        const bX = b.type === 'ITEM' ? b.data.gridX : b.gridX;
        return aX - bX;
    });

    // 4. Draw All Entities
    renderList.forEach(entity => {
        if (entity.type === 'ITEM') {
            this.drawItem(entity.data, entity.isGhost);
        } else if (entity.type === 'PLAYER') {
            this.drawPlayer(entity.gridX, entity.gridY);
        } else if (entity.type === 'PET') {
            this.drawPet(entity.gridX, entity.gridY, entity.petData);
        }
    });

    // 5. Draw Highlight (On Top of items to be clear)
    if (this.currentGhostGridPos && !this.isVisiting) {
        this.drawHighlight(this.currentGhostGridPos.x, this.currentGhostGridPos.y);
    }
    
    // 6. Draw Tutorial Hints
    this.drawTutorialHints();
  }
  
  private drawTutorialHints() {
      if (this.tutorialStep === 3) {
          // "Click the Planter to plant Mint"
          this.placedItems.forEach(item => {
             const config = ITEMS[item.itemId];
             if (config.type === ItemType.PLANTER && !item.cropData) {
                 this.drawBounceArrow(item.gridX, item.gridY, 0xffff00);
             }
          });
      }
      
      if (this.tutorialStep === 4) {
          // "Harvest"
          this.placedItems.forEach(item => {
             if (item.cropData) {
                const cropConfig = CROPS[item.cropData.cropId];
                const isReady = (Date.now() - item.cropData.plantedAt) >= cropConfig.growthTime * 1000;
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
      const g = this.add.graphics();
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

      this.renderGroup.add(g);
  }

  private drawPet(gridX: number, gridY: number, data: PetData) {
      const config = PETS[data.configId];
      if (!config) return;

      const screen = this.getScreenFromIso(gridX, gridY);
      const g = this.add.graphics();
      const bounce = Math.sin(this.time.now / 150) * 4;

      // Shadow
      g.fillStyle(0x000000, 0.3);
      g.fillEllipse(screen.x, screen.y, 16, 8);

      // Body
      g.fillStyle(config.color, 1);
      g.fillCircle(screen.x, screen.y - 10 + bounce, 10);
      
      // Eyes
      g.fillStyle(0xffffff, 1);
      g.fillCircle(screen.x - 3, screen.y - 12 + bounce, 3);
      g.fillCircle(screen.x + 3, screen.y - 12 + bounce, 3);
      g.fillStyle(0x000000, 1);
      g.fillCircle(screen.x - 3, screen.y - 12 + bounce, 1);
      g.fillCircle(screen.x + 3, screen.y - 12 + bounce, 1);

      this.renderGroup.add(g);
  }

  private drawItem(item: PlacedItem, isGhost: boolean) {
      const config = ITEMS[item.itemId];
      if (!config) return;

      const screen = this.getScreenFromIso(item.gridX, item.gridY);
      const g = this.add.graphics();
      
      let color = config.color;
      let alpha = isGhost ? 0.6 : 1;
      
      if (isGhost) {
          const pulse = Math.sin(this.time.now / 200) * 0.1 + 0.6;
          alpha = pulse;
      }

      g.fillStyle(color, alpha);

      // Height
      let height = 20;
      if (config.type === ItemType.PLANTER) height = 15;
      if (config.type === ItemType.INCUBATOR) height = 15;

      // Top
      g.fillPoints([
        new Phaser.Geom.Point(screen.x, screen.y - height),
        new Phaser.Geom.Point(screen.x + TILE_WIDTH/2, screen.y - TILE_HEIGHT/2 - height),
        new Phaser.Geom.Point(screen.x, screen.y - TILE_HEIGHT - height),
        new Phaser.Geom.Point(screen.x - TILE_WIDTH/2, screen.y - TILE_HEIGHT/2 - height),
      ], true);

      // Sides (Darker)
      g.fillStyle(Phaser.Display.Color.GetColor((color >> 16)&255 * 0.8, (color >> 8)&255 * 0.8, (color)&255 * 0.8), alpha);
      g.fillPoints([
        new Phaser.Geom.Point(screen.x, screen.y - height),
        new Phaser.Geom.Point(screen.x + TILE_WIDTH/2, screen.y - TILE_HEIGHT/2 - height),
        new Phaser.Geom.Point(screen.x + TILE_WIDTH/2, screen.y - TILE_HEIGHT/2),
        new Phaser.Geom.Point(screen.x, screen.y),
      ], true);

      g.fillStyle(Phaser.Display.Color.GetColor((color >> 16)&255 * 0.6, (color >> 8)&255 * 0.6, (color)&255 * 0.6), alpha);
      g.fillPoints([
        new Phaser.Geom.Point(screen.x, screen.y - height),
        new Phaser.Geom.Point(screen.x - TILE_WIDTH/2, screen.y - TILE_HEIGHT/2 - height),
        new Phaser.Geom.Point(screen.x - TILE_WIDTH/2, screen.y - TILE_HEIGHT/2),
        new Phaser.Geom.Point(screen.x, screen.y),
      ], true);

      // Crop
      if (config.type === ItemType.PLANTER) {
        g.fillStyle(0x3d2817, alpha); // Soil
        g.fillPoints([
            new Phaser.Geom.Point(screen.x, screen.y - height + 2),
            new Phaser.Geom.Point(screen.x + TILE_WIDTH/2 - 4, screen.y - TILE_HEIGHT/2 - height + 2),
            new Phaser.Geom.Point(screen.x, screen.y - TILE_HEIGHT - height + 2 + 2), 
            new Phaser.Geom.Point(screen.x - TILE_WIDTH/2 + 4, screen.y - TILE_HEIGHT/2 - height + 2),
        ], true);

        if (item.cropData) {
            const cropConfig = CROPS[item.cropData.cropId];
            if (cropConfig) {
                const progress = Math.min(1, (Date.now() - item.cropData.plantedAt) / (cropConfig.growthTime * 1000));
                const cx = screen.x;
                const cy = screen.y - height - 5;
                g.fillStyle(progress < 1 ? 0x88aa88 : cropConfig.color, alpha);
                const growH = 5 + (progress * 25);
                g.fillRect(cx - 3, cy - growH, 6, growH);
                if (progress >= 1) {
                    g.fillCircle(cx, cy - growH, 6);
                    if (!this.isVisiting) { // Sparkle
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
             g.fillStyle(0xffeebb, alpha);
             g.fillEllipse(screen.x, screen.y - height - 10, 14, 18);
             // Spots
             g.fillStyle(0xccaa88, alpha);
             g.fillCircle(screen.x - 3, screen.y - height - 12, 2);
          }
      }

      this.renderGroup.add(g);
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
          new Phaser.Geom.Point(screen.x + TILE_WIDTH / 2, screen.y - TILE_HEIGHT / 2),
          new Phaser.Geom.Point(screen.x, screen.y - TILE_HEIGHT),
          new Phaser.Geom.Point(screen.x - TILE_WIDTH / 2, screen.y - TILE_HEIGHT / 2),
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
        new Phaser.Geom.Point(screen.x + TILE_WIDTH / 2, screen.y - TILE_HEIGHT / 2),
        new Phaser.Geom.Point(screen.x, screen.y - TILE_HEIGHT),
        new Phaser.Geom.Point(screen.x - TILE_WIDTH / 2, screen.y - TILE_HEIGHT / 2),
      ];
      this.highlightGraphics.fillPoints(points, true);
      this.highlightGraphics.strokePoints(points, true);
    }
  }

  private getScreenFromIso(x: number, y: number) {
    const isoX = (x - y) * (TILE_WIDTH / 2);
    const isoY = (x + y) * (TILE_HEIGHT / 2);
    const offsetY = - (GRID_SIZE * TILE_HEIGHT) / 2;
    return { x: isoX, y: isoY + offsetY };
  }

  private getIsoFromScreen(screenX: number, screenY: number) {
    const offsetY = - (GRID_SIZE * TILE_HEIGHT) / 2;
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
