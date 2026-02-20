/**
 * Card Battle Demo Server
 * Showcases the Discord Activities Game Framework
 */
import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8081;

// --------------- Cards Database ---------------
const CARDS = {
  fire_imp: {
    id: "fire_imp",
    name: "Fire Imp",
    element: "fire",
    rarity: "common",
    attack: 4,
    health: 3,
    ability: "Burn",
    emoji: "🔥",
  },
  water_sprite: {
    id: "water_sprite",
    name: "Water Sprite",
    element: "water",
    rarity: "common",
    attack: 2,
    health: 6,
    ability: "Heal",
    emoji: "💧",
  },
  earth_golem: {
    id: "earth_golem",
    name: "Earth Golem",
    element: "earth",
    rarity: "rare",
    attack: 3,
    health: 8,
    ability: "Shield",
    emoji: "🪨",
  },
  wind_fairy: {
    id: "wind_fairy",
    name: "Wind Fairy",
    element: "air",
    rarity: "common",
    attack: 5,
    health: 2,
    ability: "Dodge",
    emoji: "🌪️",
  },
  shadow_bat: {
    id: "shadow_bat",
    name: "Shadow Bat",
    element: "dark",
    rarity: "rare",
    attack: 6,
    health: 4,
    ability: "Lifesteal",
    emoji: "🦇",
  },
  light_angel: {
    id: "light_angel",
    name: "Light Angel",
    element: "light",
    rarity: "legendary",
    attack: 4,
    health: 7,
    ability: "Resurrect",
    emoji: "👼",
  },
  frost_drake: {
    id: "frost_drake",
    name: "Frost Drake",
    element: "water",
    rarity: "legendary",
    attack: 7,
    health: 5,
    ability: "Freeze",
    emoji: "🐉",
  },
  vine_crawler: {
    id: "vine_crawler",
    name: "Vine Crawler",
    element: "earth",
    rarity: "common",
    attack: 3,
    health: 5,
    ability: "Entangle",
    emoji: "🌿",
  },
};

const STARTER_DECK = [
  "fire_imp",
  "water_sprite",
  "earth_golem",
  "wind_fairy",
  "shadow_bat",
];
const AI_DECK = [
  "frost_drake",
  "light_angel",
  "vine_crawler",
  "shadow_bat",
  "fire_imp",
];

// --------------- State ---------------
const players = new Map();

function drawHand(deck, count) {
  const shuffled = [...deck].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((cardId, i) => {
    const c = CARDS[cardId];
    return {
      id: `c_${i}_${Date.now()}`,
      cardId,
      name: c.name,
      element: c.element,
      emoji: c.emoji,
      ability: c.ability,
      currentATK: c.attack,
      currentHP: c.health,
      maxHP: c.health,
      rarity: c.rarity,
    };
  });
}

// --------------- Routes ---------------
app.get("/api/health", (_req, res) =>
  res.json({ status: "ok", players: players.size }),
);
app.get("/api/content/cards", (_req, res) => res.json(CARDS));

app.post("/api/battle/start", (req, res) => {
  const { userId, username } = req.body;
  if (!userId) return res.status(400).json({ error: "userId required" });

  let p = players.get(userId);
  if (!p) {
    p = { id: userId, username, deck: [...STARTER_DECK], wins: 0, losses: 0 };
    players.set(userId, p);
  }

  const battle = {
    playerHand: drawHand(p.deck, 3),
    opponentHand: drawHand(AI_DECK, 3),
    playerHP: 30,
    opponentHP: 30,
    turn: "player",
    turnNumber: 1,
    log: [{ turn: 0, actor: "system", message: "⚔️ Battle begins!" }],
  };
  p.currentBattle = battle;

  res.json({
    success: true,
    battle: {
      ...battle,
      opponentHand: battle.opponentHand.map((c) => ({
        ...c,
        cardId: "hidden",
        name: "???",
        emoji: "❓",
      })),
    },
    stats: { wins: p.wins, losses: p.losses },
  });
});

app.post("/api/battle/play", (req, res) => {
  const { userId, cardIndex } = req.body;
  const p = players.get(userId);
  if (!p?.currentBattle)
    return res.status(400).json({ error: "no active battle" });

  const b = p.currentBattle;
  if (b.turn !== "player" || cardIndex >= b.playerHand.length)
    return res.status(400).json({ error: "invalid" });

  // Player attacks
  const card = b.playerHand[cardIndex];
  let dmg = card.currentATK;
  let abilityMsg = "";

  // Ability effects
  if (card.ability === "Burn") {
    dmg += 1;
    abilityMsg = " (+1 burn)";
  }
  if (card.ability === "Lifesteal") {
    b.playerHP = Math.min(30, b.playerHP + Math.floor(dmg / 2));
    abilityMsg = ` (+${Math.floor(dmg / 2)} healed)`;
  }

  b.opponentHP = Math.max(0, b.opponentHP - dmg);
  b.log.push({
    turn: b.turnNumber,
    actor: "player",
    message: `${card.emoji} ${card.name} attacks for ${dmg}!${abilityMsg}`,
  });

  if (b.opponentHP <= 0) {
    b.log.push({ turn: b.turnNumber, actor: "system", message: "🎉 Victory!" });
    p.wins++;
    p.currentBattle = null;
    return res.json({
      battle: b,
      gameOver: true,
      winner: "player",
      stats: { wins: p.wins, losses: p.losses },
    });
  }

  // AI attacks
  const aiIdx = Math.floor(Math.random() * b.opponentHand.length);
  const ai = b.opponentHand[aiIdx];
  let aiDmg = ai.currentATK;
  let aiAbility = "";
  if (ai.ability === "Freeze") {
    aiDmg += 2;
    aiAbility = " (+2 freeze)";
  }
  if (ai.ability === "Burn") {
    aiDmg += 1;
    aiAbility = " (+1 burn)";
  }

  b.playerHP = Math.max(0, b.playerHP - aiDmg);
  b.log.push({
    turn: b.turnNumber,
    actor: "opponent",
    message: `${ai.emoji} ${ai.name} strikes for ${aiDmg}!${aiAbility}`,
  });

  if (b.playerHP <= 0) {
    b.log.push({
      turn: b.turnNumber,
      actor: "system",
      message: "😞 Defeat...",
    });
    p.losses++;
    p.currentBattle = null;
    return res.json({
      battle: b,
      gameOver: true,
      winner: "opponent",
      stats: { wins: p.wins, losses: p.losses },
    });
  }

  b.turnNumber++;
  res.json({
    battle: {
      ...b,
      opponentHand: b.opponentHand.map((c) => ({
        ...c,
        cardId: "hidden",
        name: "???",
        emoji: "❓",
      })),
    },
    gameOver: false,
    lastAI: { emoji: ai.emoji, name: ai.name, damage: aiDmg },
  });
});

// --------------- Static ---------------
app.use(express.static(path.join(__dirname, "public")));
app.get("*", (_req, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html")),
);

app.listen(PORT, () =>
  console.log(`\n  ⚔️ Card Battle Demo — http://localhost:${PORT}\n`),
);
