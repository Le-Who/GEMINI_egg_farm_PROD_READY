# {{GAME_TITLE}}

A multiplayer trivia quiz game for Discord Activities.

## Quick Start

```bash
npm install
npm run dev
```

## Features

- ❓ Multiple categories & difficulties
- ⏱ Time-based scoring (faster = more points)
- 🔥 Answer streaks
- 🏆 Leaderboard

## Adding Questions

Edit `data/content/questions.json` or use the admin panel to add new questions.

Each question needs: `category`, `difficulty`, `question`, `correctAnswer`, `wrongAnswers` (array of 3).
