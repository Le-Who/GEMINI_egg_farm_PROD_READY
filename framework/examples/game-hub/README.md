# 🎮 Game Hub — 3-in-1 Discord Activity

> A combined Farm + Trivia + Match-3 game running as a single Discord Embedded App Activity with horizontal screen-swipe navigation.

**v1.3** — Content-hash cache busting, duel lobby ready-up, local growth timers, voice invite, farm notifications

## Quick Start

```bash
npm install
npm run dev
# → http://localhost:8090
```

## Features

### 🌱 Farm

- 6 plots, seed shop, planting/watering/harvest cycle
- **Skeleton loading** — shimmer UI while data loads
- **Parallel fetch** — crops + state loaded via `Promise.all`, crops prefetched during Discord auth
- **Client-side seed validation** — prevents planting with 0 seeds, friendly toast messages, dimmed empty seed cards
- **Local growth timer** — client-side growth calculation for instant responsiveness; lazy server sync every 30s
- **Tiered watering bonus** — slow crops (sunflower, golden) get up to 45% time reduction, fast crops 30%
- **Harvest notifications** — pulsing gold badge on nav-dot + floating badge when plants are ready on another screen

### 🧠 Trivia

- Solo quiz + async **Trivia Duels** (invite codes)
- Difficulty tiers, streak/combo scoring
- **Duel Lobby** — both players must press "Ready" before game starts (60s auto-start timeout)
- **Voice Chat Invite** — 🎙️ button to share duel code with voice channel participants (SDK + clipboard fallback)

### 💎 Match-3

- **Client-side engine** — swap/match/gravity/fill computed locally for instant response
- **Game state persistence** — `POST /api/game/state` restores in-progress games on re-entry
- **Smooth animations** — reduced cascade delays (450ms total vs. 630ms), CSS pop/fall classes
- Server validation via fire-and-forget sync
- Leaderboard (global + room-scoped)
- **Reliable score saving** — dedicated `/api/game/end` endpoint ensures highScore persistence

### 🖥 Responsive Layout

- `100dvh` viewport units with `100vh` fallback
- `@media` breakpoints for `<600px` height and `<400px` width
- Dynamic match-3 cell sizing based on both viewport width and height

### 🔧 Infrastructure

- **Content-hash cache busting** — MD5-based asset hashes auto-injected into HTML at server start
- **Aggressive cache headers** — `Cache-Control`, `Surrogate-Control`, `Pragma` prevent stale assets in Discord proxy

## API Endpoints

| Method | Path                      | Description                   |
| ------ | ------------------------- | ----------------------------- |
| `POST` | `/api/farm/state`         | Get farm state                |
| `POST` | `/api/farm/plant`         | Plant a seed                  |
| `POST` | `/api/farm/water`         | Water a plot                  |
| `POST` | `/api/farm/harvest`       | Harvest a crop                |
| `POST` | `/api/farm/buy-seeds`     | Buy seeds                     |
| `POST` | `/api/content/crops`      | Get crop definitions          |
| `POST` | `/api/trivia/start`       | Start solo trivia             |
| `POST` | `/api/trivia/answer`      | Answer trivia question        |
| `POST` | `/api/trivia/duel/create` | Create duel room              |
| `POST` | `/api/trivia/duel/join`   | Join duel room                |
| `POST` | `/api/game/state`         | Get active match-3 game state |
| `POST` | `/api/game/start`         | Start new match-3 game        |
| `POST` | `/api/game/move`          | Submit match-3 move           |
| `POST` | `/api/game/end`           | Finalize game, save highScore |
| `POST` | `/api/trivia/duel/ready`  | Mark player ready in lobby    |
| `GET`  | `/api/leaderboard`        | Global leaderboard            |

## Project Structure

```
game-hub/
├── server.js            # Express backend (farm + trivia + match-3 + Discord auth)
├── Dockerfile           # Multi-stage Node 20 Alpine
├── package.json
└── public/
    ├── index.html       # 3-screen slider layout
    ├── css/
    │   ├── base.css     # Design tokens, viewport, nav, responsive
    │   ├── farm.css     # Farm grid, skeleton, dimmed seeds, responsive
    │   ├── trivia.css   # Trivia screen styles
    │   └── match3.css   # Board, gems, animations, responsive
    └── js/
        ├── shared.js    # Discord SDK, API helper, navigation, crops prefetch
        ├── farm.js      # Farm module (skeleton, parallel fetch, seed validation)
        ├── trivia.js    # Trivia module (solo + duels)
        └── match3.js    # Match-3 module (client engine, state restore)
```

## Environment Variables

| Variable                | Required | Description                 |
| ----------------------- | -------- | --------------------------- |
| `DISCORD_CLIENT_ID`     | ✅       | Discord app client ID       |
| `DISCORD_CLIENT_SECRET` | ✅       | Discord app secret          |
| `DISCORD_REDIRECT_URI`  | ✅       | OAuth2 redirect URI         |
| `GCS_BUCKET`            | ❌       | GCS bucket for persistence  |
| `PORT`                  | ❌       | Server port (default: 8090) |

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
