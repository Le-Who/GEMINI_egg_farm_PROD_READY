# 🎮 Game Hub — 3-in-1 Discord Activity

> A combined Farm + Trivia + Match-3 + Building Blox game running as a single Discord Embedded App Activity with horizontal screen-swipe navigation.

**v4.1** — UX overhaul: mobile bottom nav bar, Building Blox persistence/pause/touch drag, Match-3 sidebar + readable descriptions, farm mobile buttons.

## Quick Start

```bash
npm install
npm run dev
# → http://localhost:8090
```

## Features

### ⚡ Energy Core (v1.6)

- **Universal Energy**: 20 max energy, regenerates +1 every 2.5 minutes (passive).
- **Game Costs**: Match-3 (-5⚡), Trivia (-3⚡).
- **Quick-Feed Modal** (v1.7): When energy is too low to play, an inline modal lets players feed harvested crops to their pet — restoring +2⚡ each — then jump straight into the game.
- **TopHUD**: Global bar showing Energy/Gold, syncs across all screens.
- **Aurora Energy Pill** (v3.1): Animated aurora borealis gradient fill (teal→purple→green) showing regen progress. Hidden at full energy.

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

### 🌱 Farm (v1.8 → v3.1)

- **8 crops**: Tomato, Corn, Sunflower, Golden Rose, Blueberry, Watermelon, Pumpkin, Wheat.
- **6–12 plots**: Start with 6, buy up to 12 (doubling cost: 200→6400🪙).
- **Glassmorphism Side Panel** (v3.0): Right-side panel with 📦 Inventory / 🌾 Shop tabs.
  - **Inventory tab**: Harvested crops with 💰 Sell and 🍖 Feed buttons.
    - **Sell** (v3.1): `ceil((seedPrice × 0.5) × (growthSec × 0.25))` formula.
    - **Feed Pet** (v3.1): Deducts 1 crop → +2⚡ energy. Blocked at max energy.
  - **Shop tab**: Seed cards with buy bar.
  - Frosted glass UI (`backdrop-filter: blur(16px)`), responsive stacking.
- **Instant Gold Sync** (v3.1): Gold deducted from GameStore immediately on purchase.
- **Harvest Persistence** (v3.1): `syncHarvestedToStore()` ensures items survive reload.
- **Water Timeout** (v3.1): 3s fallback releases watering lock on slow server.
- **All Actions Fire-and-Forget** (v2.0): Plant, harvest, water, buy seeds, buy plot — all instant with version guards.
- **Event Delegation** (v1.9): Single click handler on `#farm-plots` grid.
- **Smart Growth Tick** (v1.9): 500ms interval skips render when no plots growing.
- **Unified Economy**: Uses global Gold (syncs with TopHUD).
- **Offline Progress**: `processOfflineActions()` server-side simulation.

### 🧠 Trivia

- Solo quiz + async **Trivia Duels** (invite codes)
- **Energy Gate**: Requires 3 energy to start → quick-feed modal if insufficient.
- **Duel Lobby** & **Voice Chat Invite**.
- **Gold Rewards**: Earn gold for winning quizzes.

### 🧱 Building Blox (v4.0 → v4.1)

- **10×10 grid block puzzle**: Place Tetris-like pieces, clear rows + columns for score.
- **12 piece shapes** (1-cell dot through 5-cell pentomino) with distinct colors.
- **Pause Overlay** (v4.1): Frosted-glass overlay with New Game / Continue / End Game buttons.
- **localStorage Persistence** (v4.1): Board, tray, score, high score saved on every placement.
- **Ghost Preview**: Board-level `mousemove` with center-of-mass offset. No per-cell gap flicker.
- **Touch Drag-and-Drop** (v4.1): Drag pieces from tray to board with floating preview.
- **Swipe Blocking** (v4.1): `HUB.swipeBlocked` prevents accidental navigation during active game.
- **Energy cost**: 4⚡ per game.

### 💎 Match-3 (v1.5 → v4.1)

- **3 Game Modes**:
  - 💎 **Classic**: 30 moves, standard scoring.
  - ⏱️ **Time Attack**: 90 seconds, unlimited moves, score ×1.5.
  - 🎯 **Star Drop**: Drop 3 reward tokens (💰🌾⚡) to bottom row in 30 moves. +20🪙 bonus for all 3.
- **Persistent Sidebar** (v4.1): Vertical mode cards to the left of the board on desktop (>680px). Inline horizontal cards on mobile.
- **Mode Switch During Play** (v4.1): Non-active modes clickable (with toast feedback).
- **Readable Descriptions** (v4.1): 0.68rem text (“30 moves to score big”, “Drop tokens to bottom for loot”).
- **Client-side engine** with server validation.
- **Swap Slide Animation** (v1.8): Gems visually glide into each other’s positions.
- **Energy Gate**: 5⚡ to start → quick-feed modal if insufficient.
- **Slide-in Leaderboard**: Responsive side-panel.
- **Progressive Gold Rewards**: `calcGoldReward(score)` — gold scales with score tiers.

### 📱 Mobile Navigation (v4.1)

- **Bottom Nav Bar**: 60px tab bar with emoji icons + labels (Trivia, Blox, Farm, Match-3).
- Touch devices only; desktop retains arrow/keyboard navigation.
- Safe-area padding for notched phones.
- `HUB.swipeBlocked` integration for Building Blox.

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
| `POST` | `/api/farm/sell-crop`  | Sell harvested crop                        |
| `POST` | `/api/game/state`      | Get Match-3 state                          |
| `POST` | `/api/game/start`      | Start Match-3 (-5 Energy)                  |
| `POST` | `/api/blox/start`      | Start Blox (-4 Energy)                     |
| `POST` | `/api/blox/end`        | End Blox (gold reward)                     |
| `POST` | `/api/trivia/start`    | Start Trivia (-3 Energy)                   |
| `GET`  | `/api/leaderboard`     | Global leaderboard                         |

## Project Structure

```
game-hub/
├── server.js            # Express backend (Game logic + Discord auth)
├── game-logic.js        # Extracted pure game logic (testable)
├── storage.js           # GCS + local file persistence
├── public/
│   ├── index.html       # 4-screen slider layout + energy modal + mobile nav bar
│   ├── css/
│   │   ├── base.css     # Design tokens, scrollbar fixes, nav-bar styles
│   │   ├── blox.css     # Building Blox board, tray, pause overlay, drag preview
│   │   ├── hud.css      # TopHUD resource bar
│   │   ├── pet.css      # Pet overlay + smart docking
│   │   └── …
│   └── js/
│       ├── store.js     # GameStore (Zustand-pattern state manager)
│       ├── shared.js    # Init, Navigation, bottom nav-bar, swipeBlocked
│       ├── blox.js      # Building Blox (persistence, pause, touch drag, ghost)
│       ├── hud.js       # Resources management + Quick-Feed Modal
│       ├── pet.js       # Pet behaviors, dock mode & interaction
│       ├── farm.js      # Farm logic + Welcome Back modal
│       └── …
├── tests/
│   ├── unit.test.js     # 49 unit tests (game logic)
│   ├── api.test.js      # 24 API integration tests
│   ├── blox.test.js     # 26 Building Blox tests
│   ├── match3.test.js   # 12 tile clearing tests
│   ├── ux.test.js       # 29 UX diagnostic tests
│   ├── gcp.test.js      # 20 GCP resilience tests
│   └── perf.test.js     # 7 performance benchmarks
└── Dockerfile           # Cloud Run deployment
```

## 🧪 Testing

```bash
npm test          # All 167 tests
npm run test:perf # Performance benchmarks only
```

| Type     | Tests | Coverage                                                                             |
| -------- | ----: | ------------------------------------------------------------------------------------ |
| **Unit** |    49 | Player factory, energy regen, offline simulation, farm growth, match-3 board, trivia |
| **API**  |    24 | All REST endpoints (farm, pet, trivia, match-3, blox, health)                        |
| **Blox** |    26 | Piece shapes, placement, line clearing, scoring, game-over, reward                   |
| **M3**   |    12 | findMatches, resolveBoard, gravity, cascade, drop-type exclusion                     |
| **UX**   |    29 | Pet flicker invariants, zone bounds, growth ticks, race conditions, version guards   |
| **GCP**  |    20 | Latency (<200ms), concurrency, payload (<16KB), save stress, stale reconnect         |
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
