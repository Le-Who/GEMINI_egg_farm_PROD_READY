import {
  ItemConfig,
  ItemType,
  CropConfig,
  PetConfig,
  EggConfig,
  LevelConfig,
  SkuConfig,
  TutorialStepConfig,
} from "../types";

// --- Content Store (loaded from server API) ---
let _items: Record<string, ItemConfig> = {};
let _crops: Record<string, CropConfig> = {};
let _pets: Record<string, PetConfig> = {};
let _eggs: Record<string, EggConfig> = {};
let _levels: LevelConfig[] = [];
let _tutorial: TutorialStepConfig[] = [];
let _skus: SkuConfig[] = [];
let _loaded = false;

// Parse color strings ("0xff00ff") back to numbers
function parseColor(c: string | number): number {
  if (typeof c === "number") return c;
  if (typeof c === "string" && c.startsWith("0x")) return parseInt(c, 16);
  return 0xcccccc;
}

// Convert raw JSON item to typed ItemConfig
function parseItem(raw: any): ItemConfig {
  return {
    ...raw,
    type: ItemType[raw.type as keyof typeof ItemType] || raw.type,
    color: parseColor(raw.color),
    price: Number(raw.price),
    width: Number(raw.width || 1),
    height: Number(raw.height || 1),
  };
}

function parseCrop(raw: any): CropConfig {
  return {
    ...raw,
    color: parseColor(raw.color),
    seedPrice: Number(raw.seedPrice),
    sellPrice: Number(raw.sellPrice),
    growthTime: Number(raw.growthTime),
    xpReward: Number(raw.xpReward),
    levelReq: Number(raw.levelReq),
  };
}

function parsePet(raw: any): PetConfig {
  return { ...raw, color: parseColor(raw.color) };
}

function parseEgg(raw: any): EggConfig {
  return { ...raw, hatchTime: Number(raw.hatchTime) };
}

// --- Load from API ---
export async function loadContent(): Promise<boolean> {
  try {
    const res = await fetch("/api/content");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (data.items) {
      _items = {};
      for (const [id, raw] of Object.entries(data.items))
        _items[id] = parseItem(raw);
    }
    if (data.crops) {
      _crops = {};
      for (const [id, raw] of Object.entries(data.crops))
        _crops[id] = parseCrop(raw);
    }
    if (data.pets) {
      _pets = {};
      for (const [id, raw] of Object.entries(data.pets))
        _pets[id] = parsePet(raw);
    }
    if (data.eggs) {
      _eggs = {};
      for (const [id, raw] of Object.entries(data.eggs))
        _eggs[id] = parseEgg(raw);
    }
    if (data.levels) _levels = data.levels;
    if (data.tutorial) _tutorial = data.tutorial;
    if (data.skus) _skus = data.skus;

    _loaded = true;
    console.log("Content loaded from API:", {
      items: Object.keys(_items).length,
      crops: Object.keys(_crops).length,
      pets: Object.keys(_pets).length,
      eggs: Object.keys(_eggs).length,
      levels: _levels.length,
    });

    // Cache in localStorage for offline fallback
    try {
      localStorage.setItem("egg_farm_content", JSON.stringify(data));
    } catch {}

    return true;
  } catch (e) {
    console.warn(
      "Failed to load content from API, trying localStorage cache:",
      e,
    );
    try {
      const cached = localStorage.getItem("egg_farm_content");
      if (cached) {
        const data = JSON.parse(cached);
        if (data.items) {
          _items = {};
          for (const [id, raw] of Object.entries(data.items))
            _items[id] = parseItem(raw);
        }
        if (data.crops) {
          _crops = {};
          for (const [id, raw] of Object.entries(data.crops))
            _crops[id] = parseCrop(raw);
        }
        if (data.pets) {
          _pets = {};
          for (const [id, raw] of Object.entries(data.pets))
            _pets[id] = parsePet(raw);
        }
        if (data.eggs) {
          _eggs = {};
          for (const [id, raw] of Object.entries(data.eggs))
            _eggs[id] = parseEgg(raw);
        }
        if (data.levels) _levels = data.levels;
        if (data.tutorial) _tutorial = data.tutorial;
        if (data.skus) _skus = data.skus;
        _loaded = true;
        console.log("Content loaded from localStorage cache");
        return true;
      }
    } catch {}
    return false;
  }
}

// --- Accessors (used by game code instead of imported constants) ---
export function getItems(): Record<string, ItemConfig> {
  return _items;
}
export function getCrops(): Record<string, CropConfig> {
  return _crops;
}
export function getPets(): Record<string, PetConfig> {
  return _pets;
}
export function getEggs(): Record<string, EggConfig> {
  return _eggs;
}
export function getLevels(): LevelConfig[] {
  return _levels;
}
export function getTutorial(): TutorialStepConfig[] {
  return _tutorial;
}
export function getSkus(): SkuConfig[] {
  return _skus;
}
export function isContentLoaded(): boolean {
  return _loaded;
}

// --- Live Content Polling (checks for CMS updates) ---
let _pollingInterval: any = null;
let _knownVersion = -1;
let _onContentRefresh: (() => void) | null = null;

export function startContentPolling(onRefresh?: () => void) {
  if (_pollingInterval) return; // Already polling
  _onContentRefresh = onRefresh || null;

  _pollingInterval = setInterval(async () => {
    try {
      const res = await fetch("/api/content/version");
      if (!res.ok) return;
      const { version } = await res.json();

      if (_knownVersion === -1) {
        _knownVersion = version; // First check — just store
        return;
      }

      if (version !== _knownVersion) {
        console.log(
          `Content updated: v${_knownVersion} → v${version}, reloading...`,
        );
        _knownVersion = version;
        await loadContent();
        if (_onContentRefresh) _onContentRefresh();
      }
    } catch (e) {
      /* silent — network hiccup */
    }
  }, 30000); // Check every 30s
}

export function stopContentPolling() {
  if (_pollingInterval) {
    clearInterval(_pollingInterval);
    _pollingInterval = null;
  }
}
