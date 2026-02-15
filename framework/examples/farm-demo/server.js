/**
 * Farm Sim Demo Server
 * Showcases the Discord Activities Game Framework
 */
import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8083;

// --------------- Content ---------------
const CROPS = {
  strawberry: {
    id: "strawberry",
    name: "Strawberry",
    emoji: "🍓",
    growthTime: 15000,
    sellPrice: 15,
    seedPrice: 5,
    xp: 5,
  },
  tomato: {
    id: "tomato",
    name: "Tomato",
    emoji: "🍅",
    growthTime: 30000,
    sellPrice: 30,
    seedPrice: 10,
    xp: 10,
  },
  corn: {
    id: "corn",
    name: "Corn",
    emoji: "🌽",
    growthTime: 45000,
    sellPrice: 50,
    seedPrice: 20,
    xp: 15,
  },
  sunflower: {
    id: "sunflower",
    name: "Sunflower",
    emoji: "🌻",
    growthTime: 60000,
    sellPrice: 80,
    seedPrice: 35,
    xp: 25,
  },
  golden: {
    id: "golden",
    name: "Golden Rose",
    emoji: "🌹",
    growthTime: 90000,
    sellPrice: 150,
    seedPrice: 60,
    xp: 50,
  },
};

const ITEMS = {
  planter: {
    id: "planter",
    name: "Planter",
    emoji: "🪴",
    price: 50,
    description: "Grow crops",
  },
  fence: {
    id: "fence",
    name: "Wooden Fence",
    emoji: "🪵",
    price: 20,
    description: "Decoration",
  },
  lamp: {
    id: "lamp",
    name: "Garden Lamp",
    emoji: "🏮",
    price: 35,
    description: "Decoration",
  },
  bench: {
    id: "bench",
    name: "Park Bench",
    emoji: "🪑",
    price: 40,
    description: "Decoration",
  },
  fountain: {
    id: "fountain",
    name: "Fountain",
    emoji: "⛲",
    price: 120,
    description: "Premium deco",
  },
};

const PLOTS = 6;

// --------------- State ---------------
const players = new Map();

function defaultState() {
  return {
    coins: 200,
    xp: 0,
    level: 1,
    plots: Array.from({ length: PLOTS }, (_, i) => ({
      id: i,
      crop: null,
      plantedAt: null,
      watered: false,
    })),
    inventory: { strawberry: 5, planter: 2 },
    placedItems: [],
  };
}

function getGrowthPct(plot) {
  if (!plot.crop || !plot.plantedAt) return 0;
  const cfg = CROPS[plot.crop];
  if (!cfg) return 0;
  const elapsed = Date.now() - plot.plantedAt;
  const time = plot.watered ? cfg.growthTime * 0.7 : cfg.growthTime;
  return Math.min(1, elapsed / time);
}

// --------------- API ---------------
app.get("/api/health", (_req, res) =>
  res.json({ status: "ok", players: players.size }),
);
app.get("/api/content/crops", (_req, res) => res.json(CROPS));
app.get("/api/content/items", (_req, res) => res.json(ITEMS));

app.post("/api/farm/state", (req, res) => {
  const { userId, username } = req.body;
  if (!userId) return res.status(400).json({ error: "userId required" });
  let p = players.get(userId);
  if (!p) {
    p = { ...defaultState(), id: userId, username };
    players.set(userId, p);
  }
  // Attach growth percentages
  const plots = p.plots.map((pl) => ({ ...pl, growth: getGrowthPct(pl) }));
  res.json({ ...p, plots });
});

app.post("/api/farm/plant", (req, res) => {
  const { userId, plotId, cropId } = req.body;
  const p = players.get(userId);
  if (!p) return res.status(400).json({ error: "no player" });
  if (!CROPS[cropId]) return res.status(400).json({ error: "unknown crop" });
  const plot = p.plots[plotId];
  if (!plot || plot.crop)
    return res.status(400).json({ error: "plot occupied" });
  const seeds = p.inventory[cropId] || 0;
  if (seeds <= 0) return res.status(400).json({ error: "no seeds" });

  p.inventory[cropId] = seeds - 1;
  plot.crop = cropId;
  plot.plantedAt = Date.now();
  plot.watered = false;

  const plots = p.plots.map((pl) => ({ ...pl, growth: getGrowthPct(pl) }));
  res.json({ success: true, plots, inventory: p.inventory, coins: p.coins });
});

app.post("/api/farm/water", (req, res) => {
  const { userId, plotId } = req.body;
  const p = players.get(userId);
  if (!p) return res.status(400).json({ error: "no player" });
  const plot = p.plots[plotId];
  if (!plot || !plot.crop || plot.watered)
    return res.status(400).json({ error: "cannot water" });
  plot.watered = true;
  const plots = p.plots.map((pl) => ({ ...pl, growth: getGrowthPct(pl) }));
  res.json({ success: true, plots });
});

app.post("/api/farm/harvest", (req, res) => {
  const { userId, plotId } = req.body;
  const p = players.get(userId);
  if (!p) return res.status(400).json({ error: "no player" });
  const plot = p.plots[plotId];
  if (!plot || !plot.crop)
    return res.status(400).json({ error: "nothing to harvest" });
  if (getGrowthPct(plot) < 1)
    return res.status(400).json({ error: "not ready" });
  const cfg = CROPS[plot.crop];
  p.coins += cfg.sellPrice;
  p.xp += cfg.xp;
  // Level up every 100 XP
  const newLevel = Math.floor(p.xp / 100) + 1;
  const leveledUp = newLevel > p.level;
  p.level = newLevel;
  plot.crop = null;
  plot.plantedAt = null;
  plot.watered = false;
  const plots = p.plots.map((pl) => ({ ...pl, growth: getGrowthPct(pl) }));
  res.json({
    success: true,
    reward: { coins: cfg.sellPrice, xp: cfg.xp, crop: cfg.emoji },
    plots,
    coins: p.coins,
    xp: p.xp,
    level: p.level,
    leveledUp,
  });
});

app.post("/api/farm/buy-seeds", (req, res) => {
  const { userId, cropId, amount = 1 } = req.body;
  const p = players.get(userId);
  if (!p) return res.status(400).json({ error: "no player" });
  const cfg = CROPS[cropId];
  if (!cfg) return res.status(400).json({ error: "unknown crop" });
  const cost = cfg.seedPrice * amount;
  if (p.coins < cost)
    return res.status(400).json({ error: "not enough coins" });
  p.coins -= cost;
  p.inventory[cropId] = (p.inventory[cropId] || 0) + amount;
  res.json({ success: true, coins: p.coins, inventory: p.inventory });
});

// --------------- Static ---------------
app.use(express.static(path.join(__dirname, "public")));
app.get("*", (_req, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html")),
);

app.listen(PORT, () =>
  console.log(`\n  🌱 Farm Demo — http://localhost:${PORT}\n`),
);
