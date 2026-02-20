/**
 * {{GAME_TITLE}} — Farm Game Server
 *
 * Express server with farm-specific routes built on BaseServer.
 */

import dotenv from "dotenv";
import {
  BaseServer,
  StateManager,
  ContentManager,
  MemoryAdapter,
  LocalFileAdapter,
  loadGameConfigWithEnv,
  EventBus,
} from "@discord-activities/core";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configRaw = JSON.parse(
  fs.readFileSync(path.join(__dirname, "game.config.json"), "utf-8"),
);
const config = loadGameConfigWithEnv(configRaw);

// Persistence
const persistence =
  config.persistence === "local-file"
    ? new LocalFileAdapter(path.join(__dirname, "data", "db.json"))
    : new MemoryAdapter();

const eventBus = new EventBus();

// State
const stateManager = new StateManager(
  persistence,
  {
    coins: 500,
    gems: 10,
    xp: 0,
    level: 1,
    inventory: { planter_basic: 2 },
    rooms: {
      interior: { type: "interior", items: [], unlocked: true },
      garden: { type: "garden", items: [], unlocked: false },
    },
    currentRoom: "interior",
    pets: [],
    equippedPetId: null,
    tutorialStep: 0,
    completedTutorial: false,
  },
  eventBus,
);

// Content
const contentManager = new ContentManager({ eventBus });
const contentDir = path.join(__dirname, "data", "content");
if (fs.existsSync(contentDir)) {
  const contentData = {};
  for (const file of fs.readdirSync(contentDir)) {
    if (file.endsWith(".json")) {
      const key = file.replace(".json", "");
      contentData[key] = JSON.parse(
        fs.readFileSync(path.join(contentDir, file), "utf-8"),
      );
    }
  }
  contentManager.loadFromData(contentData);
}

// Server
const server = new BaseServer({
  config: config.server,
  stateManager,
  contentManager,
  discordClientId: config.discord.clientId,
});

// Farm-specific routes
const auth = server.getAuthMiddleware();

server.app.post("/api/farm/plant", auth, (req, res) => {
  const user = req.discordUser;
  const { planterId, cropId } = req.body;
  const state = stateManager.get(user.id, user.username);
  // Plant logic here
  res.json({ success: true, state });
});

server.app.post("/api/farm/harvest", auth, (req, res) => {
  const user = req.discordUser;
  const { x, y } = req.body;
  const state = stateManager.get(user.id, user.username);
  // Harvest logic here
  res.json({ success: true, state });
});

// Static files + SPA
const distPath = path.join(__dirname, "dist");
server.serveStatic(distPath);
server.addSPACatchAll(
  fs.existsSync(distPath)
    ? path.join(distPath, "index.html")
    : path.join(__dirname, "index.html"),
);

// Start
async function main() {
  await stateManager.init();
  await server.start();
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
