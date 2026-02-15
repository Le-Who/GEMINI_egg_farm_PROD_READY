/**
 * ═══════════════════════════════════════════════════════
 *  Game Hub — Unified Server (Production-Ready)
 *  Farm + Trivia (Solo & Duel) + Match-3 (with Leaderboard)
 *  Discord OAuth2 · GCS Persistence · Dual-Mode Auth
 * ═══════════════════════════════════════════════════════
 */
import "dotenv/config";
import express from "express";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initStorage, gcsRead, gcsWrite, getBucket } from "./storage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8090;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID || "";
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || "";
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || "";
const GCS_BUCKET = process.env.GCS_BUCKET || "";
const DISCORD_ENABLED = !!(CLIENT_ID && CLIENT_SECRET);

// Initialize GCS (no-op if GCS_BUCKET is empty)
initStorage(GCS_BUCKET);

/* ═══════════════════════════════════════════════════
 *  SHARED STATE
 * ═══════════════════════════════════════════════════ */
const players = new Map(); // userId -> { farm, trivia, match3 }
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const LOCAL_DB_PATH = path.join(DATA_DIR, "hub-db.json");

/* ─── Persistence ─── */
async function loadDb() {
  // Try GCS first
  const gcsData = await gcsRead("hub-db.json");
  if (gcsData) {
    try {
      const parsed = JSON.parse(gcsData);
      for (const [k, v] of Object.entries(parsed)) players.set(k, v);
      console.log(`  DB loaded from GCS: ${players.size} players`);
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
      for (const [k, v] of Object.entries(data)) players.set(k, v);
      console.log(`  DB loaded from local file: ${players.size} players`);
      return;
    }
  } catch (e) {
    console.error("Local DB load error:", e);
  }
  console.log("  DB: starting fresh (no existing data found)");
}

async function saveDb() {
  const obj = Object.fromEntries(players);
  const json = JSON.stringify(obj, null, 2);
  await gcsWrite("hub-db.json", json);
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
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

/* ─── Graceful Shutdown ─── */
const gracefulShutdown = async () => {
  console.log("\n  Saving DB before shutdown...");
  if (saveTimeout) clearTimeout(saveTimeout);
  await saveDb();
  process.exit(0);
};
process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

/* ─── Discord Auth (dual-mode) ─── */
const requireAuth = async (req, res, next) => {
  if (!DISCORD_ENABLED) return next(); // demo mode — skip auth
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No token provided" });
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

/**
 * resolveUser — extracts userId/username from either Discord auth or request body.
 * In production (Discord enabled): uses req.discordUser from requireAuth.
 * In demo mode: uses req.body.userId / req.body.username.
 */
function resolveUser(req) {
  if (req.discordUser) {
    return {
      userId: req.discordUser.id,
      username: req.discordUser.username || "Player",
    };
  }
  return { userId: req.body.userId, username: req.body.username || "Player" };
}

/* ─── Public Config (exposes non-secret settings to frontend) ─── */
app.get("/api/config", (_req, res) => {
  res.json({
    clientId: CLIENT_ID || "",
    discordEnabled: DISCORD_ENABLED,
  });
});

app.get("/api/config/discord", (_req, res) => {
  res.json({ clientId: CLIENT_ID });
});

/* ─── Discord Token Exchange ─── */
app.post("/api/token", async (req, res) => {
  if (!DISCORD_ENABLED)
    return res.status(501).json({ error: "Discord not configured" });
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

function getPlayer(userId, username) {
  let p = players.get(userId);
  if (!p) {
    p = {
      id: userId,
      username: username || "Player",
      // Farm state
      farm: {
        coins: 200,
        xp: 0,
        level: 1,
        plots: Array.from({ length: 6 }, (_, i) => ({
          id: i,
          crop: null,
          plantedAt: null,
          watered: false,
        })),
        inventory: { strawberry: 5, planter: 2 },
      },
      // Trivia stats (persistent across sessions)
      trivia: {
        totalScore: 0,
        totalCorrect: 0,
        totalPlayed: 0,
        bestStreak: 0,
        session: null,
      },
      // Match-3 stats
      match3: {
        highScore: 0,
        totalGames: 0,
        currentGame: null,
      },
    };
    players.set(userId, p);
  }
  if (username) p.username = username;
  return p;
}

/* ═══════════════════════════════════════════════════
 *  HEALTH
 * ═══════════════════════════════════════════════════ */
app.get("/api/health", (_req, res) =>
  res.json({
    status: "ok",
    players: players.size,
    duels: duelRooms.size,
    uptime: Math.floor(process.uptime()),
    gcs: !!getBucket(),
    discord: DISCORD_ENABLED,
  }),
);

/* ═══════════════════════════════════════════════════
 *  FARM MODULE
 * ═══════════════════════════════════════════════════ */
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

function getGrowthPct(plot) {
  if (!plot.crop || !plot.plantedAt) return 0;
  const cfg = CROPS[plot.crop];
  if (!cfg) return 0;
  const elapsed = Date.now() - plot.plantedAt;
  const time = plot.watered ? cfg.growthTime * 0.7 : cfg.growthTime;
  return Math.min(1, elapsed / time);
}

function farmPlotsWithGrowth(farm) {
  return farm.plots.map((pl) => ({ ...pl, growth: getGrowthPct(pl) }));
}

app.get("/api/content/crops", (_req, res) => res.json(CROPS));

app.post("/api/farm/state", requireAuth, (req, res) => {
  const { userId, username } = resolveUser(req);
  if (!userId) return res.status(400).json({ error: "userId required" });
  const p = getPlayer(userId, username);
  res.json({ ...p.farm, plots: farmPlotsWithGrowth(p.farm) });
});

app.post("/api/farm/plant", requireAuth, (req, res) => {
  const { userId } = resolveUser(req);
  const { plotId, cropId } = req.body;
  const p = getPlayer(userId);
  if (!CROPS[cropId]) return res.status(400).json({ error: "unknown crop" });
  const plot = p.farm.plots[plotId];
  if (!plot || plot.crop)
    return res.status(400).json({ error: "plot occupied" });
  const seeds = p.farm.inventory[cropId] || 0;
  if (seeds <= 0) return res.status(400).json({ error: "no seeds" });

  p.farm.inventory[cropId] = seeds - 1;
  plot.crop = cropId;
  plot.plantedAt = Date.now();
  plot.watered = false;
  debouncedSaveDb();

  res.json({
    success: true,
    plots: farmPlotsWithGrowth(p.farm),
    inventory: p.farm.inventory,
    coins: p.farm.coins,
  });
});

app.post("/api/farm/water", requireAuth, (req, res) => {
  const { userId } = resolveUser(req);
  const { plotId } = req.body;
  const p = getPlayer(userId);
  const plot = p.farm.plots[plotId];
  if (!plot || !plot.crop || plot.watered)
    return res.status(400).json({ error: "cannot water" });
  plot.watered = true;
  debouncedSaveDb();
  res.json({ success: true, plots: farmPlotsWithGrowth(p.farm) });
});

app.post("/api/farm/harvest", requireAuth, (req, res) => {
  const { userId } = resolveUser(req);
  const { plotId } = req.body;
  const p = getPlayer(userId);
  const plot = p.farm.plots[plotId];
  if (!plot || !plot.crop)
    return res.status(400).json({ error: "nothing to harvest" });
  if (getGrowthPct(plot) < 1)
    return res.status(400).json({ error: "not ready" });
  const cfg = CROPS[plot.crop];
  p.farm.coins += cfg.sellPrice;
  p.farm.xp += cfg.xp;
  const newLevel = Math.floor(p.farm.xp / 100) + 1;
  const leveledUp = newLevel > p.farm.level;
  p.farm.level = newLevel;
  plot.crop = null;
  plot.plantedAt = null;
  plot.watered = false;
  debouncedSaveDb();
  res.json({
    success: true,
    reward: { coins: cfg.sellPrice, xp: cfg.xp, crop: cfg.emoji },
    plots: farmPlotsWithGrowth(p.farm),
    coins: p.farm.coins,
    xp: p.farm.xp,
    level: p.farm.level,
    leveledUp,
  });
});

app.post("/api/farm/buy-seeds", requireAuth, (req, res) => {
  const { userId } = resolveUser(req);
  const { cropId, amount = 1 } = req.body;
  const p = getPlayer(userId);
  const cfg = CROPS[cropId];
  if (!cfg) return res.status(400).json({ error: "unknown crop" });
  const cost = cfg.seedPrice * amount;
  if (p.farm.coins < cost)
    return res.status(400).json({ error: "not enough coins" });
  p.farm.coins -= cost;
  p.farm.inventory[cropId] = (p.farm.inventory[cropId] || 0) + amount;
  debouncedSaveDb();
  res.json({ success: true, coins: p.farm.coins, inventory: p.farm.inventory });
});

/* ═══════════════════════════════════════════════════
 *  TRIVIA MODULE — Solo
 * ═══════════════════════════════════════════════════ */
const QUESTIONS = [
  {
    id: 1,
    question:
      "What programming language was created by Brendan Eich in 10 days?",
    correctAnswer: "JavaScript",
    wrongAnswers: ["Python", "Ruby", "PHP"],
    category: "Technology",
    difficulty: "easy",
    points: 10,
    timeLimit: 15,
  },
  {
    id: 2,
    question: "What does HTML stand for?",
    correctAnswer: "HyperText Markup Language",
    wrongAnswers: [
      "High Tech Modern Language",
      "Hyper Transfer Markup Language",
      "Home Tool Markup Language",
    ],
    category: "Technology",
    difficulty: "easy",
    points: 10,
    timeLimit: 15,
  },
  {
    id: 3,
    question: "Which planet is known as the Red Planet?",
    correctAnswer: "Mars",
    wrongAnswers: ["Venus", "Jupiter", "Mercury"],
    category: "Science",
    difficulty: "easy",
    points: 10,
    timeLimit: 15,
  },
  {
    id: 4,
    question: "What data structure uses LIFO ordering?",
    correctAnswer: "Stack",
    wrongAnswers: ["Queue", "Array", "Linked List"],
    category: "Technology",
    difficulty: "medium",
    points: 20,
    timeLimit: 20,
  },
  {
    id: 5,
    question: "What is the chemical symbol for gold?",
    correctAnswer: "Au",
    wrongAnswers: ["Ag", "Fe", "Gd"],
    category: "Science",
    difficulty: "medium",
    points: 20,
    timeLimit: 20,
  },
  {
    id: 6,
    question: "Which sorting algorithm has the best average time complexity?",
    correctAnswer: "Merge Sort O(n log n)",
    wrongAnswers: [
      "Bubble Sort O(n²)",
      "Insertion Sort O(n²)",
      "Selection Sort O(n²)",
    ],
    category: "Technology",
    difficulty: "hard",
    points: 30,
    timeLimit: 25,
  },
  {
    id: 7,
    question: "What is the speed of light in vacuum (km/s)?",
    correctAnswer: "299,792",
    wrongAnswers: ["199,792", "399,792", "249,792"],
    category: "Science",
    difficulty: "hard",
    points: 30,
    timeLimit: 25,
  },
  {
    id: 8,
    question: "Who invented the World Wide Web?",
    correctAnswer: "Tim Berners-Lee",
    wrongAnswers: ["Vint Cerf", "Steve Jobs", "Bill Gates"],
    category: "Technology",
    difficulty: "medium",
    points: 20,
    timeLimit: 20,
  },
  {
    id: 9,
    question: "What is the largest organ in the human body?",
    correctAnswer: "Skin",
    wrongAnswers: ["Liver", "Brain", "Heart"],
    category: "Science",
    difficulty: "easy",
    points: 10,
    timeLimit: 15,
  },
  {
    id: 10,
    question: "In what year was the first iPhone released?",
    correctAnswer: "2007",
    wrongAnswers: ["2005", "2008", "2010"],
    category: "Technology",
    difficulty: "medium",
    points: 20,
    timeLimit: 20,
  },
  {
    id: 11,
    question: "What gas do plants absorb from the atmosphere?",
    correctAnswer: "Carbon Dioxide",
    wrongAnswers: ["Oxygen", "Nitrogen", "Hydrogen"],
    category: "Science",
    difficulty: "easy",
    points: 10,
    timeLimit: 15,
  },
  {
    id: 12,
    question: "What does API stand for?",
    correctAnswer: "Application Programming Interface",
    wrongAnswers: [
      "Advanced Program Integration",
      "Automated Process Interface",
      "Application Process Interaction",
    ],
    category: "Technology",
    difficulty: "easy",
    points: 10,
    timeLimit: 15,
  },
];

function pickQuestions(count = 5, difficulty = "all") {
  let pool = [...QUESTIONS];
  if (difficulty && difficulty !== "all")
    pool = pool.filter((q) => q.difficulty === difficulty);
  return pool
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.min(count, pool.length));
}

function makeClientQuestion(q, index, total) {
  const answers = [q.correctAnswer, ...q.wrongAnswers].sort(
    () => Math.random() - 0.5,
  );
  return {
    question: q.question,
    answers,
    category: q.category,
    difficulty: q.difficulty,
    points: q.points,
    timeLimit: q.timeLimit,
    index,
    total,
  };
}

app.post("/api/trivia/start", requireAuth, (req, res) => {
  const { userId, username } = resolveUser(req);
  const { count = 5, difficulty } = req.body;
  if (!userId) return res.status(400).json({ error: "userId required" });
  const p = getPlayer(userId, username);

  const questions = pickQuestions(count, difficulty);
  p.trivia.session = {
    questions,
    index: 0,
    answers: [],
    score: 0,
    streak: 0,
    startedAt: Date.now(),
  };

  res.json({
    success: true,
    stats: {
      totalScore: p.trivia.totalScore,
      bestStreak: p.trivia.bestStreak,
      totalPlayed: p.trivia.totalPlayed,
    },
    question: makeClientQuestion(questions[0], 0, questions.length),
  });
});

app.post("/api/trivia/answer", requireAuth, (req, res) => {
  const { userId } = resolveUser(req);
  const { answer, timeMs } = req.body;
  const p = getPlayer(userId);
  const s = p.trivia.session;
  if (!s) return res.status(400).json({ error: "no session" });
  const q = s.questions[s.index];
  if (!q) return res.status(400).json({ error: "done" });

  const correct = answer === q.correctAnswer;
  const timeBonus = correct
    ? Math.max(0, Math.floor((q.timeLimit * 1000 - (timeMs || 0)) / 100))
    : 0;
  const points = correct ? q.points + timeBonus : 0;

  s.answers.push({ answer, correct, points, timeMs });
  s.score += points;
  s.streak = correct ? s.streak + 1 : 0;
  s.index++;

  const isComplete = s.index >= s.questions.length;
  if (isComplete) {
    p.trivia.totalScore += s.score;
    p.trivia.totalCorrect += s.answers.filter((a) => a.correct).length;
    p.trivia.totalPlayed++;
    p.trivia.bestStreak = Math.max(p.trivia.bestStreak, s.streak);
    p.trivia.session = null;
    debouncedSaveDb();
  }

  let nextQuestion = null;
  if (!isComplete)
    nextQuestion = makeClientQuestion(
      s.questions[s.index],
      s.index,
      s.questions.length,
    );

  res.json({
    correct,
    points,
    timeBonus,
    correctAnswer: q.correctAnswer,
    sessionScore: s.score,
    streak: s.streak,
    isComplete,
    nextQuestion,
    stats: isComplete
      ? {
          totalScore: p.trivia.totalScore,
          bestStreak: p.trivia.bestStreak,
          totalPlayed: p.trivia.totalPlayed,
          totalCorrect: p.trivia.totalCorrect,
        }
      : undefined,
  });
});

/* ═══════════════════════════════════════════════════
 *  TRIVIA MODULE — Duel System
 * ═══════════════════════════════════════════════════ */
const duelRooms = new Map(); // roomId -> duel state

function generateCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

app.post("/api/trivia/duel/create", requireAuth, (req, res) => {
  const { userId, username } = resolveUser(req);
  const { count = 5, difficulty } = req.body;
  if (!userId) return res.status(400).json({ error: "userId required" });
  const p = getPlayer(userId, username);

  const roomId = generateCode();
  const inviteCode = roomId; // Same for simplicity in demo
  const questions = pickQuestions(count, difficulty);

  duelRooms.set(roomId, {
    roomId,
    inviteCode,
    questions,
    players: {
      [userId]: {
        userId,
        username: p.username,
        answers: [],
        score: 0,
        streak: 0,
        finished: false,
        startedAt: null,
      },
    },
    createdAt: Date.now(),
    status: "waiting", // waiting -> active -> finished
  });

  res.json({
    success: true,
    roomId,
    inviteCode,
    questionCount: questions.length,
  });
});

app.post("/api/trivia/duel/join", requireAuth, (req, res) => {
  const { userId, username } = resolveUser(req);
  const { inviteCode } = req.body;
  if (!userId || !inviteCode)
    return res.status(400).json({ error: "userId and inviteCode required" });

  const room = duelRooms.get(inviteCode.toUpperCase());
  if (!room) return res.status(404).json({ error: "Room not found" });
  if (room.status === "finished")
    return res.status(400).json({ error: "Duel already finished" });
  if (Object.keys(room.players).length >= 2 && !room.players[userId])
    return res.status(400).json({ error: "Room is full" });

  const p = getPlayer(userId, username);
  if (!room.players[userId]) {
    room.players[userId] = {
      userId,
      username: p.username,
      answers: [],
      score: 0,
      streak: 0,
      finished: false,
      startedAt: null,
    };
  }

  // Auto-start when 2 players joined
  if (Object.keys(room.players).length >= 2) room.status = "active";

  const playerNames = Object.values(room.players).map((pl) => pl.username);
  res.json({
    success: true,
    roomId: room.roomId,
    status: room.status,
    players: playerNames,
    questionCount: room.questions.length,
  });
});

app.post("/api/trivia/duel/start", requireAuth, (req, res) => {
  const { userId } = resolveUser(req);
  const { roomId } = req.body;
  const room = duelRooms.get(roomId);
  if (!room) return res.status(404).json({ error: "Room not found" });
  if (!room.players[userId])
    return res.status(403).json({ error: "Not in this room" });
  if (room.players[userId].finished)
    return res.status(400).json({ error: "Already finished" });

  room.players[userId].startedAt = Date.now();
  const first = room.questions[0];
  res.json({
    success: true,
    question: makeClientQuestion(first, 0, room.questions.length),
    opponent:
      Object.values(room.players)
        .filter((pl) => pl.userId !== userId)
        .map((pl) => pl.username)[0] || "Waiting...",
  });
});

app.post("/api/trivia/duel/answer", requireAuth, (req, res) => {
  const { userId } = resolveUser(req);
  const { roomId, answer, timeMs } = req.body;
  const room = duelRooms.get(roomId);
  if (!room) return res.status(404).json({ error: "Room not found" });
  const dp = room.players[userId];
  if (!dp) return res.status(403).json({ error: "Not in this room" });
  if (dp.finished) return res.status(400).json({ error: "Already finished" });

  const qIndex = dp.answers.length;
  const q = room.questions[qIndex];
  if (!q) return res.status(400).json({ error: "No more questions" });

  const correct = answer === q.correctAnswer;
  const timeBonus = correct
    ? Math.max(0, Math.floor((q.timeLimit * 1000 - (timeMs || 0)) / 100))
    : 0;
  const points = correct ? q.points + timeBonus : 0;

  dp.answers.push({ answer, correct, points, timeMs });
  dp.score += points;
  dp.streak = correct ? dp.streak + 1 : 0;

  const isComplete = dp.answers.length >= room.questions.length;
  if (isComplete) {
    dp.finished = true;
    dp.finishedAt = Date.now();
    // Check if both finished
    const allDone = Object.values(room.players).every((pl) => pl.finished);
    if (allDone) room.status = "finished";
  }

  let nextQuestion = null;
  if (!isComplete)
    nextQuestion = makeClientQuestion(
      room.questions[qIndex + 1],
      qIndex + 1,
      room.questions.length,
    );

  res.json({
    correct,
    points,
    timeBonus,
    correctAnswer: q.correctAnswer,
    sessionScore: dp.score,
    streak: dp.streak,
    isComplete,
    nextQuestion,
  });
});

app.get("/api/trivia/duel/status/:roomId", (req, res) => {
  const room = duelRooms.get(req.params.roomId);
  if (!room) return res.status(404).json({ error: "Room not found" });

  const playersInfo = Object.values(room.players).map((pl) => ({
    username: pl.username,
    finished: pl.finished,
    score: pl.finished ? pl.score : undefined,
    correctCount: pl.finished
      ? pl.answers.filter((a) => a.correct).length
      : undefined,
    totalQuestions: room.questions.length,
  }));

  let winner = null;
  if (room.status === "finished") {
    const sorted = Object.values(room.players).sort(
      (a, b) => b.score - a.score,
    );
    winner =
      sorted[0].score > sorted[1]?.score
        ? sorted[0].username
        : sorted[0].score === sorted[1]?.score
          ? "Tie"
          : sorted[0].username;
  }

  res.json({
    roomId: room.roomId,
    status: room.status,
    players: playersInfo,
    winner,
  });
});

/* ═══════════════════════════════════════════════════
 *  MATCH-3 MODULE
 * ═══════════════════════════════════════════════════ */
const GEM_TYPES = ["fire", "water", "earth", "air", "light", "dark"];
const BOARD_SIZE = 8;

function randomGem() {
  return GEM_TYPES[Math.floor(Math.random() * GEM_TYPES.length)];
}

function generateBoard() {
  const board = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    board[y] = [];
    for (let x = 0; x < BOARD_SIZE; x++) {
      let gem;
      do {
        gem = randomGem();
      } while (
        (x >= 2 && board[y][x - 1] === gem && board[y][x - 2] === gem) ||
        (y >= 2 && board[y - 1]?.[x] === gem && board[y - 2]?.[x] === gem)
      );
      board[y][x] = gem;
    }
  }
  return board;
}

function findMatches(board) {
  const matches = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE - 2; x++) {
      if (
        board[y][x] &&
        board[y][x] === board[y][x + 1] &&
        board[y][x] === board[y][x + 2]
      ) {
        let end = x;
        while (end < BOARD_SIZE && board[y][end] === board[y][x]) end++;
        matches.push({
          type: board[y][x],
          gems: Array.from({ length: end - x }, (_, i) => ({ x: x + i, y })),
        });
        x = end - 1;
      }
    }
  }
  for (let x = 0; x < BOARD_SIZE; x++) {
    for (let y = 0; y < BOARD_SIZE - 2; y++) {
      if (
        board[y][x] &&
        board[y][x] === board[y + 1][x] &&
        board[y][x] === board[y + 2][x]
      ) {
        let end = y;
        while (end < BOARD_SIZE && board[end][x] === board[y][x]) end++;
        matches.push({
          type: board[y][x],
          gems: Array.from({ length: end - y }, (_, i) => ({ x, y: y + i })),
        });
        y = end - 1;
      }
    }
  }
  return matches;
}

app.post("/api/game/start", requireAuth, (req, res) => {
  const { userId, username } = resolveUser(req);
  if (!userId) return res.status(400).json({ error: "userId required" });
  const p = getPlayer(userId, username);

  const game = { board: generateBoard(), score: 0, movesLeft: 30, combo: 0 };
  p.match3.currentGame = game;
  p.match3.totalGames++;
  debouncedSaveDb();
  res.json({ success: true, game, highScore: p.match3.highScore });
});

app.post("/api/game/move", requireAuth, (req, res) => {
  const { userId } = resolveUser(req);
  const { fromX, fromY, toX, toY } = req.body;
  const p = getPlayer(userId);
  if (!p.match3.currentGame)
    return res.status(400).json({ error: "no active game" });

  const game = p.match3.currentGame;
  const board = game.board.map((r) => [...r]);

  if (Math.abs(fromX - toX) + Math.abs(fromY - toY) !== 1)
    return res.status(400).json({ error: "not adjacent" });

  [board[fromY][fromX], board[toY][toX]] = [
    board[toY][toX],
    board[fromY][fromX],
  ];
  let matches = findMatches(board);
  if (matches.length === 0) return res.json({ valid: false });

  let totalPoints = 0,
    combo = 0;
  while (matches.length > 0) {
    combo++;
    for (const m of matches) {
      totalPoints += m.gems.length * 10 * Math.min(combo, 5);
      for (const g of m.gems) board[g.y][g.x] = null;
    }
    for (let x = 0; x < BOARD_SIZE; x++) {
      let wy = BOARD_SIZE - 1;
      for (let y = BOARD_SIZE - 1; y >= 0; y--) {
        if (board[y][x]) {
          board[wy][x] = board[y][x];
          if (wy !== y) board[y][x] = null;
          wy--;
        }
      }
      for (let y = wy; y >= 0; y--) board[y][x] = randomGem();
    }
    matches = findMatches(board);
  }

  game.board = board;
  game.score += totalPoints;
  game.movesLeft--;
  game.combo = combo;

  if (game.movesLeft <= 0) {
    p.match3.highScore = Math.max(p.match3.highScore, game.score);
    p.match3.currentGame = null;
    debouncedSaveDb();
    return res.json({
      valid: true,
      game: { ...game, isGameOver: true },
      points: totalPoints,
      combo,
      highScore: p.match3.highScore,
    });
  }
  res.json({ valid: true, game, points: totalPoints, combo });
});

/* ─── Leaderboard (enhanced with scope) ─── */
app.get("/api/leaderboard", (req, res) => {
  const { scope, roomId } = req.query;
  let entries = [...players.values()];

  // In a real Discord Activity, roomId would filter by voice channel participants.
  // For the demo, we simulate "room" by grouping players who share a roomId prefix.
  if (scope === "room" && roomId) {
    // Demo: filter players whose id starts with the roomId prefix
    // In production: query Discord SDK for voice channel participants
    entries = entries.filter(
      (p) => p.id.startsWith(roomId) || entries.length <= 5,
    );
  }

  const leaders = entries
    .filter((p) => p.match3.highScore > 0)
    .sort((a, b) => b.match3.highScore - a.match3.highScore)
    .slice(0, 15)
    .map((p, i) => ({
      rank: i + 1,
      username: p.username,
      highScore: p.match3.highScore,
      totalGames: p.match3.totalGames,
    }));

  res.json(leaders);
});

/*
 * Serve /js/discord-sdk.js dynamically: prepend client_id config
 * before the SDK bundle so it's available when the IIFE runs.
 * This is CSP-safe (external same-origin script) and eliminates
 * any race conditions with separate config scripts.
 */
let sdkBundleCache = null;
app.get("/js/discord-sdk.js", (_req, res) => {
  if (!sdkBundleCache) {
    sdkBundleCache = fs.readFileSync(
      path.join(__dirname, "public", "js", "discord-sdk-bundle.js"),
      "utf-8",
    );
  }
  const prefix = `window.__DISCORD_CLIENT_ID=${JSON.stringify(CLIENT_ID || "")};\n`;
  res
    .type("application/javascript")
    .set("Cache-Control", "no-cache")
    .send(prefix + sdkBundleCache);
});

app.use(express.static(path.join(__dirname, "public")));
app.get("*", (_req, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html")),
);

/* ═══════════════════════════════════════════════════
 *  STARTUP
 * ═══════════════════════════════════════════════════ */
async function start() {
  await loadDb();
  app.listen(PORT, () => {
    console.log(`\n  🎮 Game Hub — http://localhost:${PORT}`);
    console.log(`     Farm 🌱 | Trivia 🧠 | Match-3 💎`);
    console.log(
      `     Discord: ${DISCORD_ENABLED ? "✅ enabled" : "⚠️  demo mode (no creds)"}`,
    );
    console.log(
      `     Storage: ${getBucket() ? "☁️  GCS" : "💾 local (ephemeral)"}`,
    );
    console.log(`     Duel system active | Leaderboard enabled\n`);
  });
}

start().catch((e) => {
  console.error("Fatal startup error:", e);
  process.exit(1);
});
