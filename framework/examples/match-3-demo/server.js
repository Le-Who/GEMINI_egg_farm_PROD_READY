/**
 * Match-3 Demo Server
 * Showcases the Discord Activities Game Framework
 */
import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
const GEM_TYPES = ["fire", "water", "earth", "air", "light", "dark"];
const BOARD_SIZE = 8;

// --------------- State ---------------
const players = new Map();

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

// --------------- API ---------------
app.get("/api/health", (_req, res) =>
  res.json({ status: "ok", players: players.size }),
);

app.post("/api/game/start", (req, res) => {
  const { userId, username } = req.body;
  if (!userId) return res.status(400).json({ error: "userId required" });

  const game = { board: generateBoard(), score: 0, movesLeft: 30, combo: 0 };
  let player = players.get(userId);
  if (!player) {
    player = { id: userId, username, highScore: 0, totalGames: 0 };
    players.set(userId, player);
  }
  player.currentGame = game;
  player.totalGames++;
  res.json({ success: true, game, highScore: player.highScore });
});

app.post("/api/game/move", (req, res) => {
  const { userId, fromX, fromY, toX, toY } = req.body;
  const player = players.get(userId);
  if (!player?.currentGame)
    return res.status(400).json({ error: "no active game" });

  const game = player.currentGame;
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
    combo = 0,
    allMatched = [];
  while (matches.length > 0) {
    combo++;
    for (const m of matches) {
      totalPoints += m.gems.length * 10 * Math.min(combo, 5);
      for (const g of m.gems) {
        allMatched.push({ ...g, type: board[g.y][g.x] });
        board[g.y][g.x] = null;
      }
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
    player.highScore = Math.max(player.highScore, game.score);
    player.currentGame = null;
    return res.json({
      valid: true,
      game: { ...game, isGameOver: true },
      points: totalPoints,
      combo,
      highScore: player.highScore,
    });
  }
  res.json({ valid: true, game, points: totalPoints, combo });
});

app.get("/api/leaderboard", (_req, res) => {
  const leaders = [...players.values()]
    .sort((a, b) => b.highScore - a.highScore)
    .slice(0, 10)
    .map((p) => ({ username: p.username, highScore: p.highScore }));
  res.json(leaders);
});

// --------------- Static ---------------
app.use(express.static(path.join(__dirname, "public")));
app.get("*", (_req, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html")),
);

app.listen(PORT, () => {
  console.log(`\n  💎 Match-3 Demo — http://localhost:${PORT}\n`);
});
