# 🎮 Game Hub — 3-in-1 Discord Activity

> A combined Farm + Trivia + Match-3 game running as a single Discord Embedded App Activity with horizontal screen-swipe navigation.

**v1.7** — Smart Pet Docking, Offline Simulation, Quick-Feed Energy Modal, Welcome Back Screen.

## Quick Start

```bash
npm install
npm run dev
# → http://localhost:8090
```

## Features

### ⚡ Energy Core (v1.6)

- **Universal Energy**: 20 max energy, regenerates +1 every 5 minutes (passive).
- **Game Costs**: Match-3 (-5⚡), Trivia (-3⚡).
- **Quick-Feed Modal** (v1.7): When energy is too low to play, an inline modal lets players feed harvested crops to their pet — restoring +2⚡ each — then jump straight into the game via a **PLAY NOW** button. Replaces old toast notifications.
- **TopHUD**: Global bar showing Energy/Gold, syncs across all screens.

### 🐾 Living Pet (v1.6 → v1.7)

- **Pet Companion**: A virtual pet that lives on visiting players' screens.
- **Interactions**: Click to pet (❤️), feed crops to restore Energy (+2⚡) and gain XP.
- **States**: IDLE, ROAM, SLEEP, HAPPY (state machine-driven).
- **Smart Docking** (v1.7): Pet dynamically repositions based on active screen:
  - **Ground Mode** (Farm): Full-width at bottom, free roaming enabled.
  - **Perch Mode** (Match-3/Trivia): Compact top-right corner, 70% scale, gentle bob animation, roaming disabled.
  - CSS transitions + jump animation during dock changes.
- **Offline Simulation** (v1.7): While you're away, your pet autonomously:
  - 🌾 Harvests ripe crops (1⚡ per crop)
  - 🌱 Plants random seeds (2⚡ per plant, partial growth applied)
  - 💧 Waters unwatered crops (free, ability-gated)
  - Returns a **Welcome Back** modal summarizing all offline activity.
- **Persistence**: Pet stats (Level, XP, Happiness) saved to server.

### 🏛 State Management (Refactored)

- **GameStore**: A robust, **Zustand-inspired** state manager pattern (`public/js/store.js`).
- **Slices**: State divided into modular slices (`resources`, `farm`, `pet`, `match3`).
- **Optimistic Updates**: UI updates instantly; server sync happens in background.
- **Decoupled**: HUD and components subscribe to specific slices, reducing coupling.

### 🌱 Farm

- 6 plots, seed shop, planting/watering/harvest cycle
- **Unified Economy**: Uses global Gold (syncs with TopHUD).
- **Offline Progress**: `processOfflineActions()` server-side simulation replaces simple auto-harvest.
- **Skeleton loading** & **Parallel fetch** for fast UX.

### 🧠 Trivia

- Solo quiz + async **Trivia Duels** (invite codes)
- **Energy Gate**: Requires 3 energy to start → quick-feed modal if insufficient.
- **Duel Lobby** & **Voice Chat Invite**.
- **Gold Rewards**: Earn gold for winning quizzes.

### 💎 Match-3

- **Client-side engine** with server validation.
- **Energy Gate**: Requires 5 energy to start → quick-feed modal if insufficient.
- **Slide-in Leaderboard**: Responsive side-panel (fixed on narrow screens, glassmorphic backdrop).
- **Gold Rewards**: Earn gold based on score thresholds.

### 🖥 Responsive Layout

- **Scrollbar Hidden**: Global overflow fix for Discord iframe.
- **Slide-in Panels**: Leaderboard adapts to narrow viewports.
- **Safe Areas**: Padding adjusted for TopHUD.

## API Endpoints

| Method | Path                   | Description                                |
| ------ | ---------------------- | ------------------------------------------ |
| `GET`  | `/api/resources/state` | Get global resources (Gold + Energy)       |
| `POST` | `/api/pet/state`       | Get pet state                              |
| `POST` | `/api/pet/feed`        | Feed pet (Cost: Crop, Reward: Energy + XP) |
| `POST` | `/api/farm/state`      | Get farm state + offline simulation report |
| `POST` | `/api/game/state`      | Get Match-3 state                          |
| `POST` | `/api/game/start`      | Start Match-3 (-5 Energy)                  |
| `POST` | `/api/trivia/start`    | Start Trivia (-3 Energy)                   |
| `GET`  | `/api/leaderboard`     | Global leaderboard                         |

## Project Structure

```
game-hub/
├── server.js            # Express backend (Game logic + Discord auth)
├── game-logic.js        # Extracted pure game logic (testable)
├── storage.js           # GCS + local file persistence
├── public/
│   ├── index.html       # 3-screen slider layout + energy modal
│   ├── css/
│   │   ├── base.css     # Design tokens, scrollbar fixes, feed-item styles
│   │   ├── hud.css      # TopHUD resource bar
│   │   ├── pet.css      # Pet overlay + smart docking (ground/perch)
│   │   └── ...
│   └── js/
│       ├── store.js     # GameStore (Zustand-pattern state manager)
│       ├── shared.js    # Init, Navigation & Pet Dock orchestration
│       ├── hud.js       # Resources management + Quick-Feed Modal
│       ├── pet.js       # Pet behaviors, dock mode & interaction
│       ├── farm.js      # Farm logic + Welcome Back modal
│       └── ...
├── tests/
│   ├── unit.test.js     # 49 unit tests (game logic)
│   ├── api.test.js      # 24 API integration tests
│   └── perf.test.js     # 7 performance benchmarks
└── Dockerfile           # Cloud Run deployment
```

## 🧪 Testing

```bash
npm test          # All 80 tests (unit + API + perf)
npm run test:perf # Performance benchmarks only
```

| Type     | Tests | Coverage                                                                             |
| -------- | ----: | ------------------------------------------------------------------------------------ |
| **Unit** |    49 | Player factory, energy regen, offline simulation, farm growth, match-3 board, trivia |
| **API**  |    24 | All REST endpoints (farm, pet, trivia, match-3, health)                              |
| **Perf** |     7 | Board generation, match detection, offline processing                                |

Uses Node.js built-in `node:test` — zero test dependencies.

## Environment Variables

| Variable                | Required | Description                |
| ----------------------- | -------- | -------------------------- |
| `DISCORD_CLIENT_ID`     | ✅       | Discord app client ID      |
| `DISCORD_CLIENT_SECRET` | ✅       | Discord app secret         |
| `GCS_BUCKET`            | ❌       | GCS bucket for persistence |

## Deployment

```bash
# Google Cloud Run (build + deploy in one step)
gcloud run deploy game-hub \
  --source . \
  --region europe-west4 \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars "DISCORD_CLIENT_ID=...,DISCORD_CLIENT_SECRET=...,DISCORD_REDIRECT_URI=...,GCS_BUCKET=..."
```
