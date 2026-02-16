# 🎮 Game Hub — 3-in-1 Discord Activity

> A combined Farm + Trivia + Match-3 game running as a single Discord Embedded App Activity with horizontal screen-swipe navigation.

**v1.6** — Energy System (Energy Core), Living Pet, Zustand-style State Management, Leaderboard Slide-in, Scrollbar Fixes.

## Quick Start

```bash
npm install
npm run dev
# → http://localhost:8090
```

## features

### ⚡ Energy Core (New in v1.6)

- **Universal Energy**: 20 max energy, regenerates +1 every 5 minutes (passive).
- **Game Costs**: Match-3 (-5⚡), Trivia (-3⚡).
- **Gatekeeping**: "New Game" buttons disabled if insufficient energy.
- **TopHUD**: Global bar showing Energy/Gold, syncs across all screens.

### 🐾 Living Pet (New in v1.6)

- **Pet Companion**: A virtual pet that lives on visiting players' screens.
- **Interactions**: Click to pet (❤️), feed crops to restore Energy (+2⚡) and gain XP.
- **States**: IDLE, ROAM, SLEEP, HAPPY (state machine-driven).
- **Persistence**: Pet stats (Level, XP, Happiness) saved to server.

### 🏛 State Management (Refactored)

- **GameStore**: A robust, **Zustand-inspired** state manager pattern (`public/js/store.js`).
- **Slices**: State divided into modular slices (`resources`, `farm`, `pet`, `match3`).
- **Optimistic Updates**: UI updates instantly; server sync happens in background.
- **Decoupled**: HUD and components subscribe to specific slices, reducing coupling.

### 🌱 Farm

- 6 plots, seed shop, planting/watering/harvest cycle
- **Unified Economy**: Uses global Gold (syncs with TopHUD).
- **Harvest Notifications**: Auto-harvest notices from Pet Butler ability.
- **Skeleton loading** & **Parallel fetch** for fast UX.

### 🧠 Trivia

- Solo quiz + async **Trivia Duels** (invite codes)
- **Energy Gate**: Requires 3 energy to start.
- **Duel Lobby** & **Voice Chat Invite**.
- **Gold Rewards**: Earn gold for winning quizzes.

### 💎 Match-3

- **Client-side engine** with server validation.
- **Energy Gate**: Requires 5 energy to start.
- **Slide-in Leaderboard**: Responsive side-panel (fixed on narrow screens, glassmorphic backdrop).
- **Gold Rewards**: Earn gold based on score thresholds.

### 🖥 Responsive Layout (v1.6 Fixes)

- **Scrollbar Hidden**: Global overflow fix for Discord iframe.
- **Slide-in Panels**: Leaderboard adapts to narrow viewports.
- **Safe Areas**: Padding adjusted for TopHUD.

## API Endpoints

| Method | Path                   | Description                                |
| ------ | ---------------------- | ------------------------------------------ |
| `GET`  | `/api/resources/state` | Get global resources (Gold + Energy)       |
| `POST` | `/api/pet/state`       | Get pet state                              |
| `POST` | `/api/pet/feed`        | Feed pet (Cost: Crop, Reward: Energy + XP) |
| `POST` | `/api/farm/state`      | Get farm state                             |
| `POST` | `/api/game/state`      | Get Match-3 state                          |
| `POST` | `/api/game/start`      | Start Match-3 (-5 Energy)                  |
| `POST` | `/api/trivia/start`    | Start Trivia (-3 Energy)                   |
| `GET`  | `/api/leaderboard`     | Global leaderboard                         |

## Project Structure

```
game-hub/
├── server.js            # Express backend (Game logic + Discord auth)
├── public/
    ├── index.html       # 3-screen slider layout (v1.6)
    ├── css/
    │   ├── base.css     # Design tokens, scrollbar fixes
    │   ├── hud.css      # TopHUD resource bar
    │   ├── pet.css      # Pet overlay styles
    │   └── ...
    └── js/
        ├── store.js     # GameStore (Zustand-pattern state manager)
        ├── shared.js    # Init & Navigation
        ├── hud.js       # Resources management
        ├── pet.js       # Pet behaviors & interaction
        └── ...
```

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
