/**
 * {{GAME_TITLE}} — Trivia Server
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
const questionsPath = path.join(__dirname, "data", "content", "questions.json");
let questions = [];
try {
  questions = JSON.parse(fs.readFileSync(questionsPath, "utf-8"));
} catch {}

// --------------- State (in-memory) ---------------
const players = new Map();

// --------------- Routes ---------------
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", players: players.size });
});

app.get("/api/content/questions", (_req, res) => {
  res.json(questions);
});

app.get("/api/state/:userId", (req, res) => {
  const state = players.get(req.params.userId);
  if (!state) return res.status(404).json({ error: "not found" });
  res.json(state);
});

// Start a new trivia session
app.post("/api/trivia/start", (req, res) => {
  const { userId, username, count = 5, difficulty } = req.body;
  if (!userId) return res.status(400).json({ error: "userId required" });

  let pool = [...questions];
  if (difficulty) pool = pool.filter((q) => q.difficulty === difficulty);
  const shuffled = pool.sort(() => Math.random() - 0.5).slice(0, count);

  const session = {
    questions: shuffled,
    currentIndex: 0,
    answers: [],
    startedAt: Date.now(),
    score: 0,
  };

  let player = players.get(userId);
  if (!player) {
    player = {
      id: userId,
      username,
      score: 0,
      totalCorrect: 0,
      totalQuestions: 0,
      streak: 0,
      bestStreak: 0,
    };
    players.set(userId, player);
  }
  player.currentSession = session;

  // Return first question (hide correct answer)
  const first = shuffled[0];
  const answers = [first.correctAnswer, ...first.wrongAnswers].sort(
    () => Math.random() - 0.5,
  );
  res.json({
    success: true,
    question: {
      question: first.question,
      answers,
      category: first.category,
      difficulty: first.difficulty,
      index: 0,
      total: shuffled.length,
    },
  });
});

// Answer a question
app.post("/api/trivia/answer", (req, res) => {
  const { userId, answer, timeMs } = req.body;
  const player = players.get(userId);
  if (!player?.currentSession)
    return res.status(400).json({ error: "no active session" });

  const session = player.currentSession;
  const q = session.questions[session.currentIndex];
  if (!q) return res.status(400).json({ error: "session complete" });

  const correct = answer === q.correctAnswer;
  const timeBonus = correct
    ? Math.max(0, Math.floor((q.timeLimit * 1000 - (timeMs || 0)) / 100))
    : 0;
  const points = correct ? q.points + timeBonus : 0;

  session.answers.push({ answer, correct, timeMs, points });
  session.score += points;
  session.currentIndex++;

  const isComplete = session.currentIndex >= session.questions.length;

  if (isComplete) {
    const correctCount = session.answers.filter((a) => a.correct).length;
    player.score += session.score;
    player.totalCorrect += correctCount;
    player.totalQuestions += session.answers.length;
    player.streak =
      correctCount === session.questions.length ? player.streak + 1 : 0;
    player.bestStreak = Math.max(player.bestStreak, player.streak);
    player.currentSession = null;
  }

  // Next question
  let nextQuestion = null;
  if (!isComplete) {
    const next = session.questions[session.currentIndex];
    const answers = [next.correctAnswer, ...next.wrongAnswers].sort(
      () => Math.random() - 0.5,
    );
    nextQuestion = {
      question: next.question,
      answers,
      category: next.category,
      difficulty: next.difficulty,
      index: session.currentIndex,
      total: session.questions.length,
    };
  }

  res.json({
    correct,
    points,
    correctAnswer: q.correctAnswer,
    isComplete,
    sessionScore: session.score,
    nextQuestion,
    playerStats: isComplete
      ? {
          score: player.score,
          totalCorrect: player.totalCorrect,
          streak: player.streak,
          bestStreak: player.bestStreak,
        }
      : undefined,
  });
});

// Leaderboard
app.get("/api/leaderboard", (_req, res) => {
  const leaders = [...players.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((p) => ({
      username: p.username,
      score: p.score,
      totalCorrect: p.totalCorrect,
    }));
  res.json(leaders);
});

// --------------- Static ---------------
const distPath = path.join(__dirname, "dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
}

app.listen(PORT, () => {
  console.log(`🎮 {{GAME_TITLE}} server running on http://localhost:${PORT}`);
  console.log(`   Questions loaded: ${questions.length}`);
});
