/**
 * {{GAME_TITLE}} — Card Battle Server
 */
import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

// --------------- Content ---------------
const cardsPath = path.join(__dirname, "data", "content", "cards.json");
let cards = {};
try {
  cards = JSON.parse(fs.readFileSync(cardsPath, "utf-8"));
} catch {}

// --------------- State (in-memory) ---------------
const players = new Map();

const starterDeck = [
  "fire_imp",
  "water_sprite",
  "earth_golem",
  "wind_fairy",
  "shadow_bat",
];

function drawHand(deck, count) {
  const shuffled = [...deck].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((cardId, i) => {
    const cfg = cards[cardId];
    return {
      id: `c_${i}_${Date.now()}`,
      cardId,
      currentATK: cfg?.attack ?? 3,
      currentHP: cfg?.health ?? 5,
    };
  });
}

// --------------- Routes ---------------
app.get("/api/health", (_req, res) =>
  res.json({ status: "ok", players: players.size }),
);
app.get("/api/content/cards", (_req, res) => res.json(cards));

app.post("/api/battle/start", (req, res) => {
  const { userId, username } = req.body;
  if (!userId) return res.status(400).json({ error: "userId required" });

  let player = players.get(userId);
  if (!player) {
    player = {
      id: userId,
      username,
      coins: 100,
      deck: [...starterDeck],
      collection: [...starterDeck],
      wins: 0,
      losses: 0,
    };
    players.set(userId, player);
  }

  const battle = {
    playerHand: drawHand(player.deck, 3),
    opponentHand: drawHand(starterDeck, 3),
    playerHP: 30,
    opponentHP: 30,
    turn: "player",
    turnNumber: 1,
    log: [
      { turn: 0, actor: "player", action: "start", message: "Battle started!" },
    ],
  };
  player.currentBattle = battle;
  res.json({
    success: true,
    battle: {
      ...battle,
      opponentHand: battle.opponentHand.map((c) => ({
        ...c,
        cardId: "hidden",
      })),
    },
  });
});

app.post("/api/battle/play", (req, res) => {
  const { userId, cardIndex } = req.body;
  const player = players.get(userId);
  if (!player?.currentBattle)
    return res.status(400).json({ error: "no active battle" });

  const battle = player.currentBattle;
  if (battle.turn !== "player" || cardIndex >= battle.playerHand.length)
    return res.status(400).json({ error: "invalid move" });

  const card = battle.playerHand[cardIndex];
  const cfg = cards[card.cardId];
  battle.opponentHP = Math.max(0, battle.opponentHP - card.currentATK);
  battle.log.push({
    turn: battle.turnNumber,
    actor: "player",
    action: "attack",
    damage: card.currentATK,
    message: `${cfg?.name ?? card.cardId} attacks for ${card.currentATK}!`,
  });

  if (battle.opponentHP <= 0) {
    battle.log.push({
      turn: battle.turnNumber,
      actor: "player",
      action: "win",
      message: "Victory! 🎉",
    });
    player.wins++;
    player.currentBattle = null;
    return res.json({ battle, gameOver: true, winner: "player" });
  }

  // AI turn
  const aiIdx = Math.floor(Math.random() * battle.opponentHand.length);
  const aiCard = battle.opponentHand[aiIdx];
  const aiCfg = cards[aiCard.cardId];
  battle.playerHP = Math.max(0, battle.playerHP - aiCard.currentATK);
  battle.log.push({
    turn: battle.turnNumber,
    actor: "opponent",
    action: "attack",
    damage: aiCard.currentATK,
    message: `${aiCfg?.name ?? aiCard.cardId} attacks for ${aiCard.currentATK}!`,
  });

  if (battle.playerHP <= 0) {
    battle.log.push({
      turn: battle.turnNumber,
      actor: "opponent",
      action: "win",
      message: "Defeat 😞",
    });
    player.losses++;
    player.currentBattle = null;
    return res.json({ battle, gameOver: true, winner: "opponent" });
  }

  battle.turnNumber++;
  res.json({
    battle: {
      ...battle,
      opponentHand: battle.opponentHand.map((c) => ({
        ...c,
        cardId: "hidden",
      })),
    },
    gameOver: false,
  });
});

// --------------- Static ---------------
const distPath = path.join(__dirname, "dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
}

app.listen(PORT, () => {
  console.log(`🎮 {{GAME_TITLE}} server running on http://localhost:${PORT}`);
  console.log(`   Cards loaded: ${Object.keys(cards).length}`);
});
