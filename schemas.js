import { z } from "zod";

// Enum types
export const ItemTypeEnum = z.enum([
  "FURNITURE",
  "PLANT",
  "DECORATION",
  "PLANTER",
  "INCUBATOR",
  "EGG",
  "CONSUMABLE",
  "DYE",
]);

export const RoomTypeEnum = z.enum(["interior", "garden"]);

export const StickerTypeEnum = z.enum([
  "heart",
  "star",
  "thumbsup",
  "sparkle",
  "flower",
  "wave",
]);

// PlacedItem
export const PlacedItemSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  gridX: z.number(),
  gridY: z.number(),
  rotation: z.number(),
  placedAt: z.number(),
  meta: z
    .object({
      eggId: z.string().optional(),
      hatchStart: z.number().optional(),
    })
    .catchall(z.any())
    .optional(),
  cropData: z
    .object({
      cropId: z.string(),
      plantedAt: z.number(),
      isReady: z.boolean(),
    })
    .nullable()
    .optional(),
  tint: z.number().nullable().optional(),
});

// Room
export const RoomSchema = z.object({
  type: RoomTypeEnum,
  items: z.array(PlacedItemSchema),
  unlocked: z.boolean(),
});

// PetData
export const PetDataSchema = z.object({
  id: z.string(),
  configId: z.string(),
  name: z.string(),
  level: z.number(),
  xp: z.number(),
  happiness: z.number(),
  acquiredAt: z.number(),
});

// QuestProgress
export const QuestProgressSchema = z.object({
  questId: z.string(),
  progress: z.number(),
  completed: z.boolean(),
  completedAt: z.number().optional(),
});

// BillboardEntry
export const BillboardEntrySchema = z.object({
  fromId: z.string(),
  fromName: z.string(),
  sticker: StickerTypeEnum,
  message: z.string().optional(),
  timestamp: z.number(),
});

// UserState
export const UserStateSchema = z.object({
  id: z.string(),
  username: z.string(),
  discordId: z.string().optional(),
  coins: z.number(),
  gems: z.number(),
  xp: z.number(),
  level: z.number(),
  inventory: z.record(z.string(), z.number()),
  placedItems: z.array(PlacedItemSchema).default([]), // Default to empty if missing (legacy support)
  rooms: z.record(RoomTypeEnum, RoomSchema),
  currentRoom: RoomTypeEnum,
  pets: z.array(PetDataSchema).default([]),
  equippedPetId: z.string().nullable().default(null),
  tutorialStep: z.number().default(0),
  completedTutorial: z.boolean().default(false),
  quests: z.array(QuestProgressSchema).default([]),
  billboard: z.array(BillboardEntrySchema).optional(),
  echoMarks: z
    .array(
      z.object({
        id: z.string(),
        objectId: z.string(),
        actorId: z.string(),
        actorNick: z.string(),
        actionType: z.enum(["watering", "billboard_post"]),
        gridX: z.number(),
        gridY: z.number(),
        createdAt: z.number(),
        status: z.enum(["new", "acknowledged"]).default("new"),
      }),
    )
    .optional()
    .default([]),
});
