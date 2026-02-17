# 🎮 Game Hub — 3-in-1 Discord Activity

> A combined Farm + Trivia + Match-3 game running as a single Discord Embedded App Activity with horizontal screen-swipe navigation.

**v3.0** — Game Modes, Farm Panel, Pet Polish. Hotfix: overlay panel (no layout shift), per-plot planting, server-truth energy sync, mode selector fix, regen fill inside energy pill.

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
- **Quick-Feed Modal** (v1.7): When energy is too low to play, an inline modal lets players feed harvested crops to their pet — restoring +2⚡ each — then jump straight into the game.
- **TopHUD**: Global bar showing Energy/Gold, syncs across all screens.
- **Regen Progress Bar** (v3.0): Thin micro-fill bar inside the energy indicator showing progress toward the next +1⚡ tick (fills 0→100% over 5 minutes). Hidden at full energy.

### 🐾 Living Pet (v1.6 → v3.0)

- **Pet Companion**: A virtual pet that lives on visiting players' screens.
- **Interactions**: Click to pet (❤️), feed crops to restore Energy (+2⚡) and gain XP.
- **States**: IDLE, ROAM, SLEEP, HAPPY (state machine-driven).
- **Lively Behavior** (v3.0): 80% ROAM, 15% IDLE, 5% SLEEP (was 65/25/10). Faster tempo (3-7s, was 4-11s). Shorter sleep (12s, was 30s).
- **PC Flicker Fix** (v3.0): `contain: content` + `translateZ(0)` on `.pet-sprite` — stops desktop emoji re-rasterization.
- **Smart Docking** (v1.7 → v1.8): Pet dynamically repositions based on active screen:
  - **Ground Mode** (Farm): Full-width at bottom, free roaming enabled.
  - **Game Mode** (Match-3/Trivia): Roams within stats-bar panel bounds.
  - `.pet-roaming` class applied only during walks (prevents CSS transition flicker).
  - `.pet-transitioning` 0.5s class-based animation for screen switches.
- **Zero-Flicker Animations** (v2.0 → v2.1):
  - **CSS class-based states** (`.state-idle`, `.state-roam`, etc.) — synchronous class swap, no rAF animation reset.
  - **Direction persistence**: `scaleX(var(--pet-dir))` in ALL keyframes.
  - `animation-fill-mode: both` on all keyframes prevents 0%-keyframe flash.
- **Silent Auto-Water** (v2.1): Bubble-only feedback, no HAPPY→IDLE animation pop.
- **Cached Panel** (v2.1): Feed buttons use GameStore cache — zero phantom API calls.
- **Fire-and-Forget Feed** (v2.1): `feedPet()` instant reaction, server sync in background.
- **Offline Simulation** (v1.7): While you're away, your pet autonomously harvests, plants, waters.
- **Persistence**: Pet stats (Level, XP, Happiness) saved to server.

### 🏛 State Management (v2.2)

- **GameStore**: A robust, **Zustand-inspired** state manager pattern (`public/js/store.js`).
- **Slices**: State divided into modular slices (`resources`, `farm`, `pet`, `match3`).
- **Optimistic Updates**: UI updates instantly; server sync happens in background.
- **Decoupled**: HUD and components subscribe to specific slices, reducing coupling.
- **Smart Merge** (v2.2): `syncFromServer()` preserves local regen energy — no energy rollback.
- **Deep-Clone Farm State** (v2.2): `syncFromStore()` deep-clones plots/harvested — no shared refs.
- **Unified `__harvested`** (v2.2): All harvested crop reads from `resources.__harvested` slice.
- **CropsCache TTL** (v2.2): `localStorage('hub_crops_cache')` wrapped with 24h TTL.
- **CropsCache Hash** (v3.0): Server returns `__hash` field — instant cache invalidation on config changes.

### 🌱 Farm (v1.8 → v3.0)

- **8 crops**: Tomato, Corn, Sunflower, Golden Rose, Blueberry, Watermelon, Pumpkin, Wheat.
- **6–12 plots**: Start with 6, buy up to 12 (doubling cost: 200→6400🪙).
- **Glassmorphism Side Panel** (v3.0): Right-side panel with 📦 Inventory / 🌾 Shop tabs.
  - **Inventory tab**: Harvested crops grouped by type with emoji, name, sell price, and quantity.
  - **Shop tab**: Seed cards with buy bar (replaces old inline shop).
  - Frosted glass UI (`backdrop-filter: blur(16px)`), responsive stacking on narrow screens.
- **All Actions Fire-and-Forget** (v2.0): Plant, harvest, water, buy seeds, buy plot — all instant with version guards.
  - **Harvest Toast** (v3.0): Now uses 🪙 currency symbol.
- **Event Delegation** (v1.9): Single click handler on `#farm-plots` grid.
- **Smart Growth Tick** (v1.9): 500ms interval skips render when no plots growing.
- **Unified Economy**: Uses global Gold (syncs with TopHUD).
- **Offline Progress**: `processOfflineActions()` server-side simulation.

### 🧠 Trivia

- Solo quiz + async **Trivia Duels** (invite codes)
- **Energy Gate**: Requires 3 energy to start → quick-feed modal if insufficient.
- **Duel Lobby** & **Voice Chat Invite**.
- **Gold Rewards**: Earn gold for winning quizzes.

### 💎 Match-3 (v1.5 → v3.0)

- **3 Game Modes** (v3.0):
  - 💎 **Classic**: 30 moves, standard scoring.
  - ⏱️ **Time Attack**: 90 seconds, unlimited moves, score ×1.5 for reward calculation.
  - 🎯 **Star Drop**: Drop 3 🌟 objects to the bottom in 20 moves. Rewards: 100🪙 base + 50🪙/star + 250🪙 bonus for all 3.
- **Mode Selector**: Glassmorphism card UI before game start.
- **Client-side engine** with server validation.
- **Swap Slide Animation** (v1.8): Gems visually glide into each other's positions.
- **Energy Gate**: Requires 5 energy to start → quick-feed modal if insufficient.
- **Slide-in Leaderboard**: Responsive side-panel (fixed on narrow screens).
- **Progressive Gold Rewards** (v2.1): `calcGoldReward(score)` — gold scales with score tiers.
- **Live 🪙 Display** (v2.1): Reward stat in stats bar updates in real-time (mode-aware).

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
