/**
 * AssetManager — Sprite and audio loading pipeline.
 *
 * Provides utilities for loading game assets (sprites, audio, etc.)
 * at runtime, with caching and status tracking.
 * Works with Phaser 3 scenes for texture loading.
 */

export interface AssetEntry {
  key: string;
  url: string;
  type: "image" | "audio" | "spritesheet";
  loaded: boolean;
}

export interface AssetManagerOptions {
  /** Base URL for sprite assets (default: /sprites/) */
  spritesBaseUrl?: string;
}

export class AssetManager {
  private assets: Map<string, AssetEntry> = new Map();
  private loadingPromises: Map<string, Promise<boolean>> = new Map();
  private readonly spritesBaseUrl: string;

  constructor(options: AssetManagerOptions = {}) {
    this.spritesBaseUrl = options.spritesBaseUrl ?? "/sprites/";
  }

  /** Register an asset for loading */
  register(key: string, url: string, type: AssetEntry["type"] = "image"): void {
    if (!this.assets.has(key)) {
      this.assets.set(key, { key, url, type, loaded: false });
    }
  }

  /** Get sprite key from URL path (e.g., /sprites/foo.png → sprite_foo) */
  getSpriteKey(spritePath: string): string {
    const filename = spritePath.split("/").pop() ?? spritePath;
    const base = filename.replace(/\.[^.]+$/, "");
    return `sprite_${base}`;
  }

  /** Resolve a sprite path to a full URL */
  resolveSpritePath(spriteRef: string): string {
    if (spriteRef.startsWith("http") || spriteRef.startsWith("/")) {
      return spriteRef;
    }
    return `${this.spritesBaseUrl}${spriteRef}`;
  }

  /** Check if an asset is loaded */
  isLoaded(key: string): boolean {
    return this.assets.get(key)?.loaded ?? false;
  }

  /** Mark an asset as loaded (called from Phaser loader callback) */
  markLoaded(key: string): void {
    const asset = this.assets.get(key);
    if (asset) asset.loaded = true;
  }

  /** Get all registered assets */
  getAll(): AssetEntry[] {
    return Array.from(this.assets.values());
  }

  /** Get all unloaded assets */
  getUnloaded(): AssetEntry[] {
    return Array.from(this.assets.values()).filter((a) => !a.loaded);
  }

  /** Clear all asset registrations */
  clear(): void {
    this.assets.clear();
    this.loadingPromises.clear();
  }

  /**
   * Load a sprite into a Phaser scene.
   * Returns true if the texture is ready (already loaded or just loaded).
   */
  loadSpriteInScene(
    scene: any, // Phaser.Scene
    spritePath: string,
  ): boolean {
    const key = this.getSpriteKey(spritePath);
    const url = this.resolveSpritePath(spritePath);

    // Already loaded in Phaser
    if (scene.textures?.exists(key)) {
      this.markLoaded(key);
      return true;
    }

    // Already loading
    if (this.loadingPromises.has(key)) return false;

    // Start loading
    this.register(key, url, "image");
    const loadPromise = new Promise<boolean>((resolve) => {
      try {
        scene.load.image(key, url);
        scene.load.once(`filecomplete-image-${key}`, () => {
          this.markLoaded(key);
          resolve(true);
        });
        scene.load.once("loaderror", () => resolve(false));
        scene.load.start();
      } catch {
        resolve(false);
      }
    });

    this.loadingPromises.set(key, loadPromise);
    return false;
  }
}
