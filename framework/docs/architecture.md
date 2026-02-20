# Architecture Overview

## System Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Discord Activity                      │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ React UI │  │ Phaser Scene │  │  DiscordBridge     │  │
│  │ (panels) │  │ (game view)  │  │  (SDK + auth)     │  │
│  └────┬─────┘  └──────┬───────┘  └────────┬──────────┘  │
│       │               │                    │             │
│       └───────────────┬┘                   │             │
│                       │                    │             │
│                  ┌────▼────┐               │             │
│                  │EventBus │◄──────────────┘             │
│                  └────┬────┘                             │
│                       │                                  │
│              ┌────────▼─────────┐                        │
│              │  Game Engine     │ ← game-specific logic  │
│              │  (actions/state) │                         │
│              └────────┬─────────┘                        │
│                       │                                  │
│              ┌────────▼─────────┐                        │
│              │  ContentManager  │ ← from CMS / JSON      │
│              └──────────────────┘                        │
│                                                          │
│  ═══════════════════════════════════════════════════════  │
│                    HTTP / API Layer                       │
└──────────────────────────┬──────────────────────────────┘
                           │
  ┌────────────────────────▼──────────────────────────────┐
  │                   Express Server                       │
  │  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐ │
  │  │BaseServer│  │StateManager  │  │PluginManager     │ │
  │  │(routes)  │  │(CRUD + save) │  │(lifecycle hooks) │ │
  │  └──────────┘  └──────┬───────┘  └──────────────────┘ │
  │                       │                                │
  │              ┌────────▼─────────┐                      │
  │              │PersistenceAdapter│                      │
  │              │ Memory │ File │  │                      │
  │              │ GCS    │ Redis│  │                      │
  │              └──────────────────┘                      │
  └────────────────────────────────────────────────────────┘
```

## Module Responsibilities

| Module              | Purpose                 | Dependencies                                |
| ------------------- | ----------------------- | ------------------------------------------- |
| `types.ts`          | All generic interfaces  | None                                        |
| `eventBus.ts`       | Decoupled communication | None                                        |
| `stateManager.ts`   | Player state lifecycle  | `persistence`, `eventBus`                   |
| `persistence.ts`    | Storage backends        | `fs` (Node)                                 |
| `discordBridge.ts`  | Discord SDK wrapper     | `@discord/embedded-app-sdk`                 |
| `contentManager.ts` | Game content loading    | `eventBus`                                  |
| `assetManager.ts`   | Sprite/audio pipeline   | `phaser` (optional)                         |
| `baseServer.ts`     | Express server factory  | `express`, `stateManager`, `contentManager` |
| `baseScene.ts`      | Phaser scene helpers    | `phaser`, `eventBus`, `assetManager`        |
| `i18n.ts`           | Internationalization    | None                                        |
| `config.ts`         | Config loading/merging  | None                                        |
| `plugin.ts`         | Plugin lifecycle mgmt   | None                                        |

## Data Flow

1. **Client Init**: `DiscordBridge.init()` → OAuth → user info
2. **State Load**: `GET /api/state` → `StateManager.get()` → `PersistenceAdapter.load()`
3. **User Action**: UI → `EventBus.emit("action")` → Game Engine → `StateManager.update()`
4. **State Save**: `StateManager` → debounced `PersistenceAdapter.saveAll()`
5. **Content**: `GET /api/content` → `ContentManager.getAll()` → client cache

## Extension Points

- **Game Engine**: Not in core — each template defines its own action handlers
- **Plugins**: Hook into `beforeAction`, `afterAction`, `onTick`, `onPlayerJoin/Leave`
- **Persistence**: Implement `IPersistenceAdapter` for any backend
- **Content Types**: Register via `ContentManager.registerTypes()`
- **Routes**: Add to `BaseServer.app` (Express instance)
