import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { UserStateSchema } from "./schemas.js";
import {
  initStorage,
  gcsRead,
  gcsWrite,
  gcsList,
  getBucket,
} from "./server/storage.js";
import {
  initContentManager,
  loadContent,
  saveContent,
  getContentCache,
  getContentVersion,
  getLocalContentDir,
  CONTENT_TYPES,
} from "./server/contentManager.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const GCS_BUCKET = process.env.GCS_BUCKET || "";

app.use(express.json({ limit: "10mb" }));

// ═══════════════════════════════════════════════════════════
// Initialize Storage (GCS + local fallback)
// ═══════════════════════════════════════════════════════════

initStorage(GCS_BUCKET);

// ═══════════════════════════════════════════════════════════
// Player Data Persistence
// ═══════════════════════════════════════════════════════════

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const LOCAL_DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, "db.json");
const db = new Map();

// --- Data Sanitization ---
const DEFAULT_USER_STATE = {
  coins: 500,
  gems: 10,
  xp: 0,
  level: 1,
  inventory: { planter_basic: 2, incubator_basic: 1, egg_common: 1 },
  placedItems: [],
  rooms: {
    interior: { type: "interior", items: [], unlocked: true },
    garden: { type: "garden", items: [], unlocked: false },
  },
  currentRoom: "interior",
  pets: [],
  equippedPetId: null,
  tutorialStep: 0,
  completedTutorial: false,
  quests: [],
  billboard: [],
};

function sanitizeUser(user) {
  // Start with a deep clone of defaults to avoid shared state
  const safeUser = JSON.parse(JSON.stringify(DEFAULT_USER_STATE));

  // Merge user data on top (shallow merge of top-level properties)
  Object.assign(safeUser, user);

  // Deep merge/checks for objects

  // 1. Inventory
  // If user provided inventory, safeUser.inventory is now user.inventory (reference).
  // If user didn't provide it, safeUser.inventory is the deep-cloned default.
  // We don't strictly require deep cloning user's provided inventory if we assume it's their unique data.

  // 2. Rooms
  if (!user.rooms) {
    // safeUser.rooms is already the deep-cloned default.
  } else {
    // safeUser.rooms is user.rooms reference.
    // Ensure both rooms exist
    if (!safeUser.rooms.interior)
      safeUser.rooms.interior = { type: "interior", items: [], unlocked: true };
    if (!safeUser.rooms.garden)
      safeUser.rooms.garden = { type: "garden", items: [], unlocked: false };

    // Ensure items array exists in rooms
    if (!safeUser.rooms.interior.items) safeUser.rooms.interior.items = [];
    if (!safeUser.rooms.garden.items) safeUser.rooms.garden.items = [];
  }

  // 3. Arrays
  // If user.pets was undefined, safeUser.pets is default [] (deep cloned).
  // If user.pets was null (explicitly), Object.assign copied it, so safeUser.pets is null.
  if (!safeUser.pets) safeUser.pets = [];
  if (!safeUser.quests) safeUser.quests = [];
  if (!safeUser.billboard) safeUser.billboard = [];

  return safeUser;
}

async function loadDb() {
  // Try GCS first
  const gcsData = await gcsRead("db.json");
  if (gcsData) {
    try {
      const parsed = JSON.parse(gcsData);
      for (const [k, v] of Object.entries(parsed)) db.set(k, sanitizeUser(v));
      console.log(`DB loaded from GCS: ${db.size} users`);
      return;
    } catch (e) {
      console.error("GCS DB parse error:", e);
    }
  }

  // Fallback to local file
  try {
    if (fs.existsSync(LOCAL_DB_PATH)) {
      const raw = fs.readFileSync(LOCAL_DB_PATH, "utf-8");
      const data = JSON.parse(raw);
      for (const [k, v] of Object.entries(data)) db.set(k, sanitizeUser(v));
      console.log(`DB loaded from local file: ${db.size} users`);
      return;
    }
  } catch (e) {
    console.error("Local DB load error:", e);
  }
  console.log("DB: starting fresh (no existing data found)");
}

async function saveDb() {
  const obj = Object.fromEntries(db);
  const json = JSON.stringify(obj, null, 2);

  // Always save to GCS if available
  await gcsWrite("db.json", json);

  // Also save locally as backup
  try {
    const dir = path.dirname(LOCAL_DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(LOCAL_DB_PATH, json);
  } catch (e) {
    console.error("Local DB save error:", e);
  }
}

let saveTimeout = null;
function debouncedSaveDb() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => saveDb(), 3000);
}

// Save on shutdown
const gracefulShutdown = async () => {
  await saveDb();
  process.exit(0);
};
process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

// ═══════════════════════════════════════════════════════════
// Content Management (CMS) — delegated to server/contentManager.js
// ═══════════════════════════════════════════════════════════

const LOCAL_CONTENT_DIR = path.join(DATA_DIR, "content");
initContentManager(LOCAL_CONTENT_DIR);

// Re-export contentCache/contentVersion via getters for route handlers
const contentCache = () => getContentCache();
const contentVersion = () => getContentVersion();

// ═══════════════════════════════════════════════════════════
// Startup (load data before serving)
// ═══════════════════════════════════════════════════════════

async function startServer(port = PORT) {
  await loadDb();
  await loadContent();

  // --- Serve Frontend ---
  const distPath = path.join(__dirname, "dist");
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
  } else {
    app.use(express.static(__dirname));
  }

  // Serve sprites (from GCS via proxy, or local dir)
  const LOCAL_SPRITES_DIR =
    process.env.SPRITES_DIR || path.join(__dirname, "public", "sprites");
  if (!fs.existsSync(LOCAL_SPRITES_DIR))
    fs.mkdirSync(LOCAL_SPRITES_DIR, { recursive: true });

  app.get("/sprites/:filename", async (req, res) => {
    const { filename } = req.params;

    // Security: Prevent path traversal
    const safePath = path.resolve(LOCAL_SPRITES_DIR, filename);
    if (!safePath.startsWith(LOCAL_SPRITES_DIR + path.sep)) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Try GCS first
    if (getBucket()) {
      try {
        const [data] = await getBucket().file(`sprites/${filename}`).download();
        const ext = path.extname(filename).toLowerCase();
        const mimeTypes = {
          ".png": "image/png",
          ".webp": "image/webp",
          ".jpg": "image/jpeg",
          ".gif": "image/gif",
        };
        res.set("Content-Type", mimeTypes[ext] || "application/octet-stream");
        res.set("Cache-Control", "public, max-age=86400");
        return res.send(data);
      } catch (e) {
        /* fallthrough to local */
      }
    }

    // Local fallback
    const localPath = path.join(LOCAL_SPRITES_DIR, filename);
    if (fs.existsSync(localPath)) return res.sendFile(localPath);
    res.status(404).json({ error: "Sprite not found" });
  });

  // --- Config ---
  const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
  const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
  const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || "";

  // --- Health Check ---
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      timestamp: Date.now(),
      users: db.size,
      gcs: !!getBucket(),
    });
  });

  // --- Content API (public, read-only, with ETag) ---
  app.get("/api/content", (req, res) => {
    const etag = `"v${contentVersion()}"`;
    res.set("ETag", etag);
    if (req.headers["if-none-match"] === etag) return res.status(304).end();
    res.json(contentCache());
  });
  app.get("/api/content/version", (req, res) =>
    res.json({ version: contentVersion() }),
  );
  app.get("/api/content/:type", (req, res) => {
    const { type } = req.params;
    if (!CONTENT_TYPES.includes(type))
      return res.status(404).json({ error: `Unknown: ${type}` });
    res.json(contentCache()[type] || {});
  });

  // --- Public: Get any user's state (for visiting) ---
  app.get("/api/state/:userId", (req, res) => {
    const data = db.get(req.params.userId);
    if (!data) return res.status(404).json({ error: "User not found" });
    // Return sanitized state (no need for auth — this is public read-only)
    res.json(data);
  });

  // --- Admin Auth ---
  const requireAdmin = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader)
      return res.status(401).json({ error: "Admin password required" });
    const password = authHeader.replace("Bearer ", "");
    if (password !== ADMIN_PASSWORD)
      return res.status(403).json({ error: "Invalid admin password" });
    next();
  };

  // --- Admin Panel ---
  app.get("/admin", (req, res) =>
    res.sendFile(path.join(__dirname, "admin", "index.html")),
  );
  app.get("/admin/api/content", requireAdmin, (req, res) =>
    res.json(contentCache()),
  );

  app.put("/admin/api/content/:type", requireAdmin, async (req, res) => {
    const { type } = req.params;
    if (!CONTENT_TYPES.includes(type))
      return res.status(404).json({ error: `Unknown: ${type}` });
    getContentCache()[type] = req.body;
    await saveContent(type);
    res.json({ success: true, type });
  });

  app.put("/admin/api/content/:type/:id", requireAdmin, async (req, res) => {
    const { type, id } = req.params;
    if (!CONTENT_TYPES.includes(type))
      return res.status(404).json({ error: `Unknown: ${type}` });
    if (Array.isArray(getContentCache()[type]))
      return res.status(400).json({ error: `${type} is array-based` });
    getContentCache()[type][id] = req.body;
    await saveContent(type);
    res.json({ success: true, type, id });
  });

  app.delete("/admin/api/content/:type/:id", requireAdmin, async (req, res) => {
    const { type, id } = req.params;
    if (!CONTENT_TYPES.includes(type))
      return res.status(404).json({ error: `Unknown: ${type}` });
    if (Array.isArray(getContentCache()[type]))
      return res.status(400).json({ error: `${type} is array-based` });
    if (!getContentCache()[type][id])
      return res.status(404).json({ error: `${id} not found` });
    delete getContentCache()[type][id];
    await saveContent(type);
    res.json({ success: true, type, id });
  });

  app.post("/admin/api/reload", requireAdmin, async (req, res) => {
    await loadContent();
    res.json({ success: true, types: Object.keys(getContentCache()) });
  });

  // Admin: Upload sprite
  app.post("/admin/api/sprites", requireAdmin, async (req, res) => {
    const { filename, data } = req.body;
    if (!filename || !data)
      return res.status(400).json({ error: "filename and data required" });
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const buffer = Buffer.from(data, "base64");

    // Save to GCS
    const ext = path.extname(safeName).toLowerCase();
    const mimeTypes = {
      ".png": "image/png",
      ".webp": "image/webp",
      ".jpg": "image/jpeg",
      ".gif": "image/gif",
    };
    await gcsWrite(
      `sprites/${safeName}`,
      buffer,
      mimeTypes[ext] || "application/octet-stream",
    );

    // Also save locally
    try {
      fs.writeFileSync(path.join(LOCAL_SPRITES_DIR, safeName), buffer);
    } catch (e) {}

    res.json({ success: true, path: `/sprites/${safeName}` });
  });

  // Admin: List sprites
  app.get("/admin/api/sprites", requireAdmin, async (req, res) => {
    const files = new Set();

    // From GCS
    const gcsFiles = await gcsList("sprites/");
    gcsFiles.forEach((f) => {
      const name = f.replace("sprites/", "");
      if (/\.(png|jpg|webp|gif)$/i.test(name)) files.add(name);
    });

    // From local
    try {
      fs.readdirSync(LOCAL_SPRITES_DIR)
        .filter((f) => /\.(png|jpg|webp|gif)$/i.test(f))
        .forEach((f) => files.add(f));
    } catch (e) {}

    res.json([...files].map((f) => ({ name: f, path: `/sprites/${f}` })));
  });

  // Admin: Delete sprite (with cascade cleanup)
  app.delete("/admin/api/sprites/:name", requireAdmin, async (req, res) => {
    const safeName = req.params.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const spritePath = `/sprites/${safeName}`;
    try {
      // Delete from GCS
      if (getBucket()) {
        try {
          await getBucket().file(`sprites/${safeName}`).delete();
        } catch (e) {}
      }
      // Delete from local
      const localPath = path.join(LOCAL_SPRITES_DIR, safeName);
      if (fs.existsSync(localPath)) fs.unlinkSync(localPath);

      // Cascade: clear references from all content
      let cleared = 0;
      const contentDir = LOCAL_CONTENT_DIR;
      for (const type of ["items", "crops", "pets"]) {
        const filePath = path.join(contentDir, `${type}.json`);
        if (!fs.existsSync(filePath)) continue;
        const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        let changed = false;
        for (const id of Object.keys(data)) {
          if (data[id].sprite === spritePath) {
            data[id].sprite = null;
            changed = true;
            cleared++;
          }
          // Also clear growthSprites entries in crops
          if (type === "crops" && Array.isArray(data[id].growthSprites)) {
            const before = data[id].growthSprites.length;
            data[id].growthSprites = data[id].growthSprites.filter(
              (gs) => gs.sprite !== spritePath,
            );
            if (data[id].growthSprites.length < before) {
              changed = true;
              cleared += before - data[id].growthSprites.length;
            }
          }
        }
        if (changed) {
          fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
          // Sync to GCS
          if (getBucket()) {
            await gcsWrite(
              `content/${type}.json`,
              JSON.stringify(data, null, 2),
            );
          }
        }
      }

      res.json({ success: true, cleared });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- Discord Auth ---
  const requireAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader)
      return res.status(401).json({ error: "No token provided" });
    const token = authHeader.split(" ")[1];
    try {
      const userReq = await fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!userReq.ok) throw new Error("Invalid token");
      req.discordUser = await userReq.json();
      next();
    } catch (e) {
      return res.status(401).json({ error: "Invalid token" });
    }
  };

  // --- Game Routes ---
  app.post("/api/token", async (req, res) => {
    try {
      const { code } = req.body;
      const params = new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
      });
      const response = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params,
      });
      const data = await response.json();
      if (!response.ok) {
        console.error("Token exchange failed:", data);
        return res.status(500).json(data);
      }
      res.json(data);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.get("/api/state", requireAuth, (req, res) => {
    const data = db.get(req.discordUser.id);
    res.json(data || null);
  });

  app.post("/api/state", requireAuth, (req, res) => {
    const userId = req.discordUser.id;
    const validation = UserStateSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: "Invalid state",
        details: validation.error.errors,
      });
    }

    const state = validation.data;

    if (state.id !== userId)
      return res.status(400).json({ error: "User ID mismatch" });
    db.set(userId, state);
    debouncedSaveDb();
    res.json({ success: true });
  });

  // Neighbor list with TTL cache (60s)
  let neighborCache = { data: null, timestamp: 0 };
  app.get("/api/neighbors", requireAuth, (req, res) => {
    const now = Date.now();
    if (!neighborCache.data || now - neighborCache.timestamp > 60000) {
      const keys = Array.from(db.keys());
      const profiles = keys
        .map((k) => {
          const u = db.get(k);
          return u
            ? {
                id: u.id,
                username: u.username,
                level: u.level,
                discordId: u.id,
                avatarUrl: null,
              }
            : null;
        })
        .filter(Boolean);
      neighborCache = { data: profiles, timestamp: now };
    }
    // Filter out self, shuffle, return 5
    const neighbors = neighborCache.data
      .filter((n) => n.id !== req.discordUser.id)
      .sort(() => 0.5 - Math.random())
      .slice(0, 5);
    res.json(neighbors);
  });

  // Generic Interaction (Watering, etc.) for Visitors
  // POST /api/interact/:userId
  app.post("/api/interact/:userId", requireAuth, (req, res) => {
    const targetId = req.params.userId;
    const { action, targetItemId } = req.body; // e.g., { action: "WATER", targetItemId: "plant_123" }

    if (action !== "WATER") {
      return res.status(400).json({ error: "Invalid action" });
    }

    const targetState = db.get(targetId);
    if (!targetState) return res.status(404).json({ error: "User not found" });

    // Prevent self-interaction via this endpoint (though client should block it too)
    if (targetId === req.discordUser.id) {
      return res.status(400).json({ error: "Cannot visit-interact with self" });
    }

    // Logic for WATER
    if (action === "WATER") {
      // Find the item in any room (usually garden)
      let found = false;
      for (const roomKey of ["interior", "garden"]) {
        const room = targetState.rooms[roomKey];
        if (!room) continue;
        const item = room.items.find((i) => i.id === targetItemId);
        if (item && item.cropData) {
          // Apply water effect: Reduce plantedAt timestamp by 10 minutes (600s)
          // effective "speed up"
          const reduction = 10 * 60 * 1000;
          item.cropData.plantedAt -= reduction;
          found = true;

          // Create EchoMark for the owner
          if (!targetState.echoMarks) targetState.echoMarks = [];
          targetState.echoMarks.push({
            id: `echo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            objectId: item.id,
            actorId: req.discordUser.id,
            actorNick: req.discordUser.username || "Visitor",
            actionType: "watering",
            gridX: item.gridX,
            gridY: item.gridY,
            createdAt: Date.now(),
            status: "new",
          });
          // Cap echo marks at 50
          if (targetState.echoMarks.length > 50) {
            targetState.echoMarks = targetState.echoMarks.slice(-50);
          }
          break;
        }
      }

      if (!found) {
        return res
          .status(404)
          .json({ error: "Plant not found or not growing" });
      }

      db.set(targetId, targetState);
      debouncedSaveDb();
      return res.json({
        success: true,
        message: "Watered! (Growth sped up by 10m)",
      });
    }

    res.status(400).json({ error: "Unknown action" });
  });

  // Leave a sticker on someone's billboard
  const VALID_STICKERS = [
    "heart",
    "star",
    "thumbsup",
    "sparkle",
    "flower",
    "wave",
  ];
  app.post("/api/billboard/:userId", requireAuth, (req, res) => {
    const targetId = req.params.userId;
    const { sticker, message } = req.body;

    if (!VALID_STICKERS.includes(sticker)) {
      return res.status(400).json({ error: "Invalid sticker type" });
    }

    // Security: Validate message content (alphanumeric + common punctuation)
    if (message && !/^[a-zA-Z0-9\s.,!?'\-_]+$/.test(message)) {
      return res.status(400).json({ error: "Invalid characters in message" });
    }

    const targetState = db.get(targetId);
    if (!targetState) return res.status(404).json({ error: "User not found" });

    // Prevent self-stickering
    if (targetId === req.discordUser.id) {
      return res
        .status(400)
        .json({ error: "Can't sticker your own billboard" });
    }

    if (!targetState.billboard) targetState.billboard = [];

    // Max 20 entries, FIFO
    targetState.billboard.push({
      fromId: req.discordUser.id,
      fromName: req.discordUser.username || "Visitor",
      sticker,
      message: message ? message.substring(0, 256) : undefined,
      timestamp: Date.now(),
    });
    if (targetState.billboard.length > 20) {
      targetState.billboard = targetState.billboard.slice(-20);
    }

    // Create billboard_post EchoMark
    if (!targetState.echoMarks) targetState.echoMarks = [];
    // Find billboard object grid position
    let billboardGridX = 0,
      billboardGridY = 0;
    let billboardObjectId = "billboard";
    for (const roomKey of ["interior", "garden"]) {
      const room = targetState.rooms[roomKey];
      if (!room) continue;
      const bb = room.items.find((i) => i.itemId === "billboard_wood");
      if (bb) {
        billboardGridX = bb.gridX;
        billboardGridY = bb.gridY;
        billboardObjectId = bb.id;
        break;
      }
    }
    targetState.echoMarks.push({
      id: `echo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      objectId: billboardObjectId,
      actorId: req.discordUser.id,
      actorNick: req.discordUser.username || "Visitor",
      actionType: "billboard_post",
      gridX: billboardGridX,
      gridY: billboardGridY,
      createdAt: Date.now(),
      status: "new",
    });
    if (targetState.echoMarks.length > 50) {
      targetState.echoMarks = targetState.echoMarks.slice(-50);
    }

    db.set(targetId, targetState);
    debouncedSaveDb();
    res.json({ success: true, billboard: targetState.billboard });
  });

  // --- Echo Ghost Acknowledgment (owner enters their territory) ---
  app.post("/api/echo/acknowledge", requireAuth, (req, res) => {
    const ownerId = req.discordUser.id;
    const state = db.get(ownerId);
    if (!state) return res.status(404).json({ error: "User not found" });

    const newMarks = (state.echoMarks || []).filter((m) => m.status === "new");
    if (newMarks.length === 0) {
      return res.json({ acknowledged_count: 0, details: [] });
    }

    // Build summary grouped by actor
    const summary = {};
    for (const mark of newMarks) {
      if (!summary[mark.actorNick]) {
        summary[mark.actorNick] = { watering: 0, billboard_post: 0 };
      }
      summary[mark.actorNick][mark.actionType]++;
      mark.status = "acknowledged";
    }

    const details = newMarks.map((m) => ({
      actorNick: m.actorNick,
      actionType: m.actionType,
      objectId: m.objectId,
      gridX: m.gridX,
      gridY: m.gridY,
      createdAt: m.createdAt,
    }));

    // Remove acknowledged marks older than 7 days to prevent unbounded growth
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    state.echoMarks = (state.echoMarks || []).filter(
      (m) => m.status === "new" || m.createdAt > weekAgo,
    );

    db.set(ownerId, state);
    debouncedSaveDb();

    res.json({
      acknowledged_count: newMarks.length,
      summary,
      details,
    });
  });

  // Catch-all for SPA
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/admin"))
      return res.status(404).json({ error: "Not found" });
    const indexPath = fs.existsSync(distPath)
      ? path.join(distPath, "index.html")
      : path.join(__dirname, "index.html");
    res.sendFile(indexPath);
  });

  return app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Admin panel: http://localhost:${PORT}/admin`);
    console.log(
      `Storage: ${getBucket() ? "GCS (" + GCS_BUCKET + ")" : "LOCAL (ephemeral)"}`,
    );
  });
}

// Export for testing
export { app, startServer, sanitizeUser };

// Only start strict if main module
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer().catch((e) => {
    console.error("Fatal startup error:", e);
    process.exit(1);
  });
}
