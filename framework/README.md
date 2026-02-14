# Discord Activities Game Framework

> Build Discord Activities games in minutes, not months.

A modular framework for creating embedded games that run as Discord Activities. Ships with 4 genre templates, a CLI generator, and production-ready infrastructure.

## Quick Start

```bash
# 1. Generate a new game
npx create-discord-activity-game my-farm --genre farm

# 2. Install & run
cd my-farm
npm install
npm run dev

# 3. Open http://localhost:8080
```

## Architecture

```
framework/
├── core/           # @discord-activities/core library
│   └── src/
│       ├── types.ts          # Generic types
│       ├── eventBus.ts       # Pub/sub event system
│       ├── stateManager.ts   # Player state lifecycle
│       ├── persistence.ts    # Memory & file adapters
│       ├── discordBridge.ts  # Discord SDK wrapper
│       ├── contentManager.ts # Game content CMS
│       ├── assetManager.ts   # Sprite/audio loading
│       ├── baseServer.ts     # Express server factory
│       ├── baseScene.ts      # Phaser scene base class
│       ├── i18n.ts           # Internationalization
│       ├── config.ts         # Config loader
│       └── plugin.ts         # Plugin system
├── cli/            # CLI generator (npx)
├── templates/      # Genre templates
│   ├── farm/         # 🌾 Farm simulation
│   ├── card-battle/  # 🃏 Turn-based card game
│   ├── trivia/       # ❓ Quiz game
│   └── match-3/      # 💎 Puzzle game
├── docs/           # Documentation
└── tests/          # Framework tests
```

## Core Concepts

### 1. Generic Types

Every game extends `BasePlayerState`:

```typescript
import type { BasePlayerState } from "@discord-activities/core";

interface MyPlayerState extends BasePlayerState {
  coins: number;
  inventory: Record<string, number>;
  // ...your game-specific fields
}
```

### 2. State Management

`StateManager<T>` handles the full lifecycle with debounced persistence:

```typescript
const stateManager = new StateManager(
  new LocalFileAdapter("data/db.json"),
  defaultState,
  eventBus,
);
await stateManager.init();
const player = stateManager.get("user123");
```

### 3. Server

`BaseServer` provides Discord OAuth, state CRUD, content API, and admin endpoints:

```typescript
const server = new BaseServer({
  config: gameConfig.server,
  stateManager,
  contentManager,
});
// Add your game-specific routes...
server.app.post("/api/my-action", auth, (req, res) => { ... });
await server.start();
```

### 4. Plugins

Extend game behavior without modifying core:

```typescript
import { definePlugin } from "@discord-activities/core";

const myPlugin = definePlugin({
  id: "xp-multiplier",
  name: "XP Multiplier",
  version: "1.0.0",
  hooks: {
    afterAction: (action, result) => {
      // Double XP on weekends
    },
  },
});
```

## Templates

| Genre       | Renderer       | Multiplayer    | Key Features             |
| ----------- | -------------- | -------------- | ------------------------ |
| Farm        | Phaser 3 (iso) | Yes (visiting) | Crops, pets, decoration  |
| Card Battle | DOM/React      | PvAI           | Deck building, elements  |
| Trivia      | DOM/React      | Yes            | Categories, time scoring |
| Match-3     | Canvas         | Solo           | Cascades, combos         |

## CLI Options

```
create-discord-activity-game <name> [options]

  --genre <genre>       farm | card-battle | trivia | match-3
  --persistence <type>  memory | local-file | gcs
  --locale <list>       en,ru,de (comma-separated)
  --theme <theme>       discord | dark | light
```

## License

MIT
