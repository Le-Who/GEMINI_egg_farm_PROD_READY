import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

app.use(express.json({ limit: "10mb" }));

// --- JSON File Persistence ---
const DB_PATH = path.join(__dirname, "data", "db.json");

function loadDb() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, "utf-8");
      const data = JSON.parse(raw);
      return new Map(Object.entries(data));
    }
  } catch (e) {
    console.error("Failed to load DB:", e);
  }
  return new Map();
}

function saveDb(db) {
  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const obj = Object.fromEntries(db);
    fs.writeFileSync(DB_PATH, JSON.stringify(obj, null, 2));
  } catch (e) {
    console.error("Failed to save DB:", e);
  }
}

const db = loadDb();

// Debounced save to avoid excessive writes
let saveTimeout = null;
function debouncedSaveDb() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => saveDb(db), 3000);
}

// Save on shutdown
process.on("SIGTERM", () => {
  saveDb(db);
  process.exit(0);
});
process.on("SIGINT", () => {
  saveDb(db);
  process.exit(0);
});

// --- Content Management ---
const CONTENT_DIR = path.join(__dirname, "data", "content");
const SPRITES_DIR = path.join(__dirname, "public", "sprites");
const CONTENT_TYPES = [
  "items",
  "crops",
  "pets",
  "eggs",
  "levels",
  "tutorial",
  "skus",
];

// In-memory content cache
let contentCache = {};

function loadContent() {
  contentCache = {};
  for (const type of CONTENT_TYPES) {
    const filePath = path.join(CONTENT_DIR, `${type}.json`);
    try {
      if (fs.existsSync(filePath)) {
        contentCache[type] = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      }
    } catch (e) {
      console.error(`Failed to load content ${type}:`, e);
    }
  }
  console.log(`Content loaded: ${Object.keys(contentCache).join(", ")}`);
}

function saveContent(type) {
  const filePath = path.join(CONTENT_DIR, `${type}.json`);
  try {
    if (!fs.existsSync(CONTENT_DIR))
      fs.mkdirSync(CONTENT_DIR, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(contentCache[type], null, 2));
  } catch (e) {
    console.error(`Failed to save content ${type}:`, e);
  }
}

loadContent();

// --- Serve Frontend ---
const distPath = path.join(__dirname, "dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
} else {
  app.use(express.static(__dirname));
}

// Serve sprites
if (!fs.existsSync(SPRITES_DIR)) fs.mkdirSync(SPRITES_DIR, { recursive: true });
app.use("/sprites", express.static(SPRITES_DIR));

// --- Config ---
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || "";

// --- Health Check ---
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: Date.now(), users: db.size });
});

// --- Content API (public, read-only) ---
app.get("/api/content", (req, res) => {
  res.json(contentCache);
});

app.get("/api/content/:type", (req, res) => {
  const { type } = req.params;
  if (!CONTENT_TYPES.includes(type)) {
    return res.status(404).json({ error: `Unknown content type: ${type}` });
  }
  res.json(contentCache[type] || {});
});

// --- Admin Auth Middleware ---
const requireAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Admin password required" });
  }
  const password = authHeader.replace("Bearer ", "");
  if (password !== ADMIN_PASSWORD) {
    return res.status(403).json({ error: "Invalid admin password" });
  }
  next();
};

// --- Admin Panel ---
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "admin", "index.html"));
});

// Admin API: Get all content
app.get("/admin/api/content", requireAdmin, (req, res) => {
  res.json(contentCache);
});

// Admin API: Update entire content type
app.put("/admin/api/content/:type", requireAdmin, (req, res) => {
  const { type } = req.params;
  if (!CONTENT_TYPES.includes(type)) {
    return res.status(404).json({ error: `Unknown content type: ${type}` });
  }
  contentCache[type] = req.body;
  saveContent(type);
  res.json({ success: true, type });
});

// Admin API: Update single item within a content type (for Record<string, T> types)
app.put("/admin/api/content/:type/:id", requireAdmin, (req, res) => {
  const { type, id } = req.params;
  if (!CONTENT_TYPES.includes(type)) {
    return res.status(404).json({ error: `Unknown content type: ${type}` });
  }
  if (Array.isArray(contentCache[type])) {
    return res
      .status(400)
      .json({ error: `${type} is array-based, use PUT /:type instead` });
  }
  contentCache[type][id] = req.body;
  saveContent(type);
  res.json({ success: true, type, id });
});

// Admin API: Delete single item
app.delete("/admin/api/content/:type/:id", requireAdmin, (req, res) => {
  const { type, id } = req.params;
  if (!CONTENT_TYPES.includes(type)) {
    return res.status(404).json({ error: `Unknown content type: ${type}` });
  }
  if (Array.isArray(contentCache[type])) {
    return res
      .status(400)
      .json({ error: `${type} is array-based, use PUT /:type instead` });
  }
  if (!contentCache[type][id]) {
    return res.status(404).json({ error: `${id} not found in ${type}` });
  }
  delete contentCache[type][id];
  saveContent(type);
  res.json({ success: true, type, id });
});

// Admin API: Reload content from disk
app.post("/admin/api/reload", requireAdmin, (req, res) => {
  loadContent();
  res.json({ success: true, types: Object.keys(contentCache) });
});

// Admin API: Upload sprite
app.post("/admin/api/sprites", requireAdmin, (req, res) => {
  const { filename, data } = req.body; // data is base64 encoded
  if (!filename || !data) {
    return res.status(400).json({ error: "filename and data required" });
  }
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = path.join(SPRITES_DIR, safeName);
  try {
    const buffer = Buffer.from(data, "base64");
    fs.writeFileSync(filePath, buffer);
    res.json({ success: true, path: `/sprites/${safeName}` });
  } catch (e) {
    res.status(500).json({ error: "Failed to save sprite" });
  }
});

// Admin API: List sprites
app.get("/admin/api/sprites", requireAdmin, (req, res) => {
  try {
    const files = fs
      .readdirSync(SPRITES_DIR)
      .filter((f) => /\.(png|jpg|webp|gif)$/i.test(f));
    res.json(files.map((f) => ({ name: f, path: `/sprites/${f}` })));
  } catch (e) {
    res.json([]);
  }
});

// --- Auth Middleware ---
const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No token provided" });

  const token = authHeader.split(" ")[1];

  try {
    const userReq = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!userReq.ok) throw new Error("Invalid token");

    const user = await userReq.json();
    req.discordUser = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

// --- Game Routes ---

// 1. Token Exchange
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

// 2. Get User State
app.get("/api/state", requireAuth, (req, res) => {
  const userId = req.discordUser.id;
  const data = db.get(userId);
  res.json(data || null);
});

// 3. Save User State
app.post("/api/state", requireAuth, (req, res) => {
  const userId = req.discordUser.id;
  const state = req.body;

  if (state.id !== userId) {
    return res.status(400).json({ error: "User ID mismatch" });
  }

  db.set(userId, state);
  debouncedSaveDb();
  res.json({ success: true });
});

// 4. Get Neighbors (filter self before shuffle)
app.get("/api/neighbors", requireAuth, (req, res) => {
  const keys = Array.from(db.keys()).filter((k) => k !== req.discordUser.id);

  // Shuffle and pick up to 5
  const shuffled = keys.sort(() => 0.5 - Math.random()).slice(0, 5);

  const neighbors = [];
  for (const k of shuffled) {
    const u = db.get(k);
    if (u) {
      neighbors.push({
        id: u.id,
        username: u.username,
        level: u.level,
        discordId: u.id,
        avatarUrl: null,
      });
    }
  }

  res.json(neighbors);
});

// Catch-all for SPA (exclude /admin)
app.get("*", (req, res) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/admin")) {
    return res.status(404).json({ error: "Not found" });
  }
  const indexPath = fs.existsSync(distPath)
    ? path.join(distPath, "index.html")
    : path.join(__dirname, "index.html");
  res.sendFile(indexPath);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin`);
});
