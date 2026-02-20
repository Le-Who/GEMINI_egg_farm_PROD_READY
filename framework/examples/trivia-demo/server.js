/**
 * Trivia Quiz Demo Server
 * Showcases the Discord Activities Game Framework
 */
import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8082;

// --------------- Questions Database ---------------
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

// --------------- State ---------------
const players = new Map();

app.get("/api/health", (_req, res) =>
  res.json({
    status: "ok",
    players: players.size,
    questions: QUESTIONS.length,
  }),
);

app.post("/api/trivia/start", (req, res) => {
  const { userId, username, count = 5, difficulty } = req.body;
  if (!userId) return res.status(400).json({ error: "userId required" });

  let pool = [...QUESTIONS];
  if (difficulty && difficulty !== "all")
    pool = pool.filter((q) => q.difficulty === difficulty);
  const shuffled = pool
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.min(count, pool.length));

  let p = players.get(userId);
  if (!p) {
    p = {
      id: userId,
      username,
      totalScore: 0,
      totalCorrect: 0,
      totalPlayed: 0,
      bestStreak: 0,
    };
    players.set(userId, p);
  }

  p.session = {
    questions: shuffled,
    index: 0,
    answers: [],
    score: 0,
    streak: 0,
    startedAt: Date.now(),
  };

  const first = shuffled[0];
  const answers = [first.correctAnswer, ...first.wrongAnswers].sort(
    () => Math.random() - 0.5,
  );
  res.json({
    success: true,
    stats: {
      totalScore: p.totalScore,
      bestStreak: p.bestStreak,
      totalPlayed: p.totalPlayed,
    },
    question: {
      question: first.question,
      answers,
      category: first.category,
      difficulty: first.difficulty,
      points: first.points,
      timeLimit: first.timeLimit,
      index: 0,
      total: shuffled.length,
    },
  });
});

app.post("/api/trivia/answer", (req, res) => {
  const { userId, answer, timeMs } = req.body;
  const p = players.get(userId);
  if (!p?.session) return res.status(400).json({ error: "no session" });

  const s = p.session;
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
    p.totalScore += s.score;
    p.totalCorrect += s.answers.filter((a) => a.correct).length;
    p.totalPlayed++;
    p.bestStreak = Math.max(p.bestStreak, s.streak);
    p.session = null;
  }

  let nextQuestion = null;
  if (!isComplete) {
    const next = s.questions[s.index];
    nextQuestion = {
      question: next.question,
      answers: [next.correctAnswer, ...next.wrongAnswers].sort(
        () => Math.random() - 0.5,
      ),
      category: next.category,
      difficulty: next.difficulty,
      points: next.points,
      timeLimit: next.timeLimit,
      index: s.index,
      total: s.questions.length,
    };
  }

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
          totalScore: p.totalScore,
          bestStreak: p.bestStreak,
          totalPlayed: p.totalPlayed,
          totalCorrect: p.totalCorrect,
        }
      : undefined,
  });
});

app.get("/api/leaderboard", (_req, res) => {
  const lb = [...players.values()]
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 10)
    .map((p) => ({
      username: p.username,
      totalScore: p.totalScore,
      bestStreak: p.bestStreak,
    }));
  res.json(lb);
});

// --------------- Static ---------------
app.use(express.static(path.join(__dirname, "public")));
app.get("*", (_req, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html")),
);

app.listen(PORT, () =>
  console.log(`\n  🧠 Trivia Demo — http://localhost:${PORT}\n`),
);
