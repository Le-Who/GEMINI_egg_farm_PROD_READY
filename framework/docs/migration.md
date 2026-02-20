# Migration Plan: Egg Farm → Framework

This document outlines how to migrate the existing Egg Farm game to use the new framework.

## Approach: Parallel, Non-Breaking

The framework lives in `framework/` alongside the existing game. Migration is opt-in and incremental. **No existing files are modified**.

## Migration Steps (When Ready)

### Phase 1: Switch to Core Imports

Replace local modules with framework equivalents:

| Existing File               | Framework Equivalent                             |
| --------------------------- | ------------------------------------------------ |
| `services/eventBus.ts`      | `EventBus` from `@discord-activities/core`       |
| `services/discord.ts`       | `DiscordBridge` from `@discord-activities/core`  |
| `services/contentLoader.ts` | `ContentManager` from `@discord-activities/core` |
| `server/storage.js`         | `LocalFileAdapter` / GCS adapter                 |
| `server/contentManager.js`  | `ContentManager` (server-side)                   |

### Phase 2: Refactor Server

1. Create `farm.config.json` from existing constants
2. Replace `server.js` monolith with `BaseServer` + farm routes
3. Extract admin routes to plugin

### Phase 3: Refactor Game Engine

1. Extend `BasePlayerState` for `UserState`
2. Refactor `gameEngine.ts` to use `StateManager` + action handlers
3. Refactor `MainScene.ts` to extend `BaseScene`

### Phase 4: Validate

1. Run existing unit tests — all should pass
2. Run existing integration tests — all should pass
3. Deploy to staging for manual testing

## Risk Mitigation

- **No forced migration**: The existing game works without any changes
- **Gradual adoption**: Migrate one module at a time
- **Parallel testing**: Framework tests run independently via CI
