
import { ItemConfig, ItemType, CropConfig, LevelConfig, PetConfig, EggConfig, SkuConfig, TutorialStepConfig } from './types';

export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;
export const GRID_SIZE = 16;
export const CANVAS_BG_COLOR = 0x2f3136;
export const GARDEN_BG_COLOR = 0x5a7d5a;

export const LEVELS: LevelConfig[] = [
  { level: 1, xpRequired: 0, unlocks: ["mint", "incubator_basic"] },
  { level: 2, xpRequired: 50, unlocks: ["wheat"] },
  { level: 3, xpRequired: 150, unlocks: ["basil", "egg_common"] },
  { level: 4, xpRequired: 350, unlocks: ["pot_upgrade"] },
  { level: 5, xpRequired: 700, unlocks: ["garden_access", "fence_white"] }
];

export const SKUS: SkuConfig[] = [
  { id: 'sku_gems_100', name: 'Pouch of Gems', price: '$1.99', amount: 100, icon: 'gem_small' },
  { id: 'sku_gems_550', name: 'Bucket of Gems', price: '$4.99', amount: 550, icon: 'gem_bucket' },
  { id: 'sku_starter', name: 'Starter Pack', price: '$2.99', amount: 200, icon: 'starter' }, 
];

export const TUTORIAL_STEPS: TutorialStepConfig[] = [
  { id: 0, text: "Welcome! Open the Shop to start your gardening journey.", trigger: "OPEN_SHOP" },
  { id: 1, text: "Buy a Wooden Planter.", trigger: "BUY_ITEM", targetId: "planter_basic" }, 
  { id: 2, text: "Close Shop. Open Edit Mode (Home icon) and place the Planter.", trigger: "PLACE_ITEM", targetId: "planter_basic" },
  { id: 3, text: "Click the Planter to open the Seed Bag and plant Mint.", trigger: "PLANT_SEED" },
  { id: 4, text: "Wait for the Mint to grow, then click to harvest!", trigger: "HARVEST" },
  { id: 5, text: "Great job! You're a natural. (Click to finish)", trigger: "COMPLETE" }
];

export const CROPS: Record<string, CropConfig> = {
  'mint': {
    id: 'mint',
    name: 'Fresh Mint',
    seedPrice: 10,
    sellPrice: 14,
    growthTime: 5, 
    xpReward: 2,
    levelReq: 1,
    color: 0x00ff88
  },
  'wheat': {
    id: 'wheat',
    name: 'Golden Wheat',
    seedPrice: 25,
    sellPrice: 35,
    growthTime: 30,
    xpReward: 5,
    levelReq: 2,
    color: 0xffdd00
  },
  'basil': {
    id: 'basil',
    name: 'Spicy Basil',
    seedPrice: 60,
    sellPrice: 90,
    growthTime: 60,
    xpReward: 12,
    levelReq: 3,
    color: 0x228822
  }
};

export const PETS: Record<string, PetConfig> = {
  'slime_green': {
    id: 'slime_green',
    name: 'Garden Slime',
    rarity: 'common',
    color: 0x77dd77,
    bonusDescription: "+5% Growth Speed"
  },
  'cat_lucky': {
    id: 'cat_lucky',
    name: 'Lucky Cat',
    rarity: 'rare',
    color: 0xffaa00,
    bonusDescription: "+10% Coin Reward"
  }
};

export const EGGS: Record<string, EggConfig> = {
  'egg_common': {
    id: 'egg_common',
    hatchTime: 20, 
    pool: [
      { petId: 'slime_green', weight: 80 },
      { petId: 'cat_lucky', weight: 20 }
    ]
  }
};

export const ITEMS: Record<string, ItemConfig> = {
  'fertilizer': {
    id: 'fertilizer',
    name: 'Magic Dust',
    type: ItemType.CONSUMABLE,
    price: 5,
    currency: 'gems',
    color: 0xff00ff,
    width: 1,
    height: 1,
    description: "Instantly grow a plant!"
  },
  'planter_basic': {
    id: 'planter_basic',
    name: 'Wooden Planter',
    type: ItemType.PLANTER,
    price: 50,
    color: 0x8b5a2b,
    width: 1,
    height: 1,
    description: "Grow your own herbs!"
  },
  'incubator_basic': {
    id: 'incubator_basic',
    name: 'Basic Incubator',
    type: ItemType.INCUBATOR,
    price: 200,
    color: 0xdddddd,
    width: 1,
    height: 1,
    description: "Hatch pets from eggs."
  },
  'egg_common': {
    id: 'egg_common',
    name: 'Spotted Egg',
    type: ItemType.EGG,
    price: 100,
    color: 0xffeebb,
    width: 1,
    height: 1,
    description: "What's inside?"
  },
  'chair_wood': {
    id: 'chair_wood',
    name: 'Wooden Chair',
    type: ItemType.FURNITURE,
    price: 150,
    color: 0x8b4513,
    width: 1,
    height: 1,
    description: "Basic comfort."
  },
  'table_round': {
    id: 'table_round',
    name: 'Round Table',
    type: ItemType.FURNITURE,
    price: 300,
    color: 0xd2691e,
    width: 2,
    height: 2,
    description: "Perfect for tea."
  },
  'lamp_floor': {
    id: 'lamp_floor',
    name: 'Floor Lamp',
    type: ItemType.DECORATION,
    price: 200,
    color: 0xffff99,
    width: 1,
    height: 1,
    description: "Brightens the corner."
  },
  'rug_blue': {
    id: 'rug_blue',
    name: 'Blue Rug',
    type: ItemType.DECORATION,
    price: 100,
    color: 0x4682b4,
    width: 2,
    height: 2,
    description: "Soft on the feet."
  },
  'fence_white': {
    id: 'fence_white',
    name: 'White Fence',
    type: ItemType.DECORATION,
    price: 40,
    color: 0xffffff,
    width: 1,
    height: 1,
    description: "A classic garden border."
  }
};
