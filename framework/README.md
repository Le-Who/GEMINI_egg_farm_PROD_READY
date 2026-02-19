# 🎮 Discord Activities Game Framework

> Создавайте игры для Discord Activities за минуты, а не месяцы.

Модульный фреймворк для создания встроенных игр, работающих как Discord Activities. Включает **4 шаблона жанров**, **CLI-генератор**, **13 модулей ядра** и полную документацию.

---

## 📋 Оглавление

- [Быстрый старт](#-быстрый-старт)
- [Архитектура](#-архитектура)
- [Ядро (Core Library)](#-ядро-core-library)
- [CLI-Генератор](#-cli-генератор)
- [Шаблоны жанров](#-шаблоны-жанров)
- [Конфигурация](#-конфигурация)
- [Система плагинов](#-система-плагинов)
- [Интернационализация (i18n)](#-интернационализация-i18n)
- [Персистентность (хранение данных)](#-персистентность)
- [Discord интеграция](#-discord-интеграция)
- [Тесты](#-тесты)
- [Деплой](#-деплой)
- [Миграция существующего проекта](#-миграция)
- [API Reference](#-api-reference)

---

## 🚀 Быстрый старт

### Требования

- Node.js 20+
- Discord-приложение с включёнными Activities
- `DISCORD_CLIENT_ID` и `DISCORD_CLIENT_SECRET`

### 1. Сборка фреймворка

```bash
cd framework/core
npm install
npm run build
```

### 2. Сборка CLI

```bash
cd framework/cli
npx tsc
```

### 3. Генерация нового проекта

```bash
# Из корня проекта:
node framework/cli/dist/index.js my-farm --genre farm

# Или через npm-скрипт (из framework/):
cd framework
npm run create-game -- my-farm --genre farm
```

### 4. Запуск

```bash
cd my-farm
npm install
npm run dev
# Откройте http://localhost:8080
```

---

## 🏗 Архитектура

```
framework/
├── core/           # Ядро фреймворка (13 модулей)
│   └── src/
│       ├── types.ts          # Генерик-типы (GameConfig, BasePlayerState, ...)
│       ├── eventBus.ts       # Pub/Sub для React ↔ Phaser
│       ├── stateManager.ts   # Жизненный цикл состояния игрока
│       ├── persistence.ts    # Адаптеры: Memory, LocalFile
│       ├── discordBridge.ts  # Обёртка Discord SDK + OAuth
│       ├── contentManager.ts # Загрузка JSON-контента + кеш
│       ├── assetManager.ts   # Спрайты / аудио + Phaser-текстуры
│       ├── baseServer.ts     # Express-фабрика (auth, CRUD, content, admin)
│       ├── baseScene.ts      # Phaser-сцена (сетка, пулы, эффекты)
│       ├── i18n.ts           # Интернационализация
│       ├── config.ts         # Загрузка конфига + env-переопределения
│       ├── plugin.ts         # Система плагинов
│       └── index.ts          # Barrel-экспорт
├── cli/            # CLI-генератор
│   └── src/
│       ├── index.ts          # Парсер аргументов
│       └── generator.ts      # Движок шаблонов
├── templates/      # 4 жанровых шаблона
│   ├── farm/         # 🌾 Ферма
│   ├── card-battle/  # 🃏 Карточная битва
│   ├── trivia/       # ❓ Викторина
│   └── match-3/      # 💎 Пазл
├── docs/           # Документация
├── tests/          # Unit-тесты
└── vitest.config.ts
```

### Диаграмма потока данных

```
┌─────────────────────────── Клиент (Браузер) ──────────────────────────┐
│                                                                        │
│  ┌──────────┐   EventBus    ┌──────────────┐    ┌──────────────────┐   │
│  │ React UI │◄─────────────►│ Phaser Scene │    │  DiscordBridge   │   │
│  │ (панели) │               │ (отрисовка)  │    │  (SDK + auth)    │   │
│  └────┬─────┘               └──────┬───────┘    └───────┬──────────┘   │
│       │                            │                     │              │
│       └──────── HTTP/fetch ────────┴─────────────────────┘              │
│                                    │                                    │
└────────────────────────────────────┼────────────────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────────┐
│                         Express Сервер                                  │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │  BaseServer   │  │ StateManager │  │ContentManager│  │PluginMgr   │  │
│  │ (маршруты)    │  │ (CRUD+save)  │  │ (CMS-данные) │  │(хуки)      │  │
│  └──────────────┘  └──────┬───────┘  └──────────────┘  └────────────┘  │
│                           │                                             │
│                  ┌────────▼─────────┐                                   │
│                  │PersistenceAdapter│                                    │
│                  │ Memory │ File    │                                    │
│                  │ GCS    │ Redis   │                                    │
│                  └──────────────────┘                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📦 Ядро (Core Library)

### Установка (для разработки шаблонов)

```bash
cd framework/core
npm install
npm run build
```

После сборки все модули доступны через единый импорт:

```typescript
import {
  EventBus,
  StateManager,
  MemoryAdapter,
  LocalFileAdapter,
  DiscordBridge,
  ContentManager,
  AssetManager,
  BaseServer,
  BaseScene,
  I18n,
  PluginManager,
  definePlugin,
  loadGameConfig,
  loadGameConfigWithEnv,
} from "@discord-activities/core";
```

### Модули ядра — подробно

#### 1. `types.ts` — Система типов

Все типы генерик-овые. Каждая игра расширяет `BasePlayerState`:

```typescript
// Базовый стейт (в каждой игре)
interface BasePlayerState {
  id: string; // Discord user ID
  username: string; // Имя пользователя
  discordId?: string;
  lastSaved?: number; // Таймстамп последнего сохранения
}

// Ваш стейт расширяет базовый:
interface MyFarmState extends BasePlayerState {
  coins: number;
  level: number;
  inventory: Record<string, number>;
  placedItems: PlacedItem[];
}
```

Другие ключевые типы:

- `GameConfig` — конфигурация игры (жанр, сервер, рендер, Discord)
- `GameAction<TPayload>` — действие игрока (type + payload)
- `ActionResult<TState>` — результат обработки действия
- `GameEvent<TData>` — событие для EventBus
- `ContentItem` — базовый контент-элемент (id, name, sprite, localized\*)
- `GamePlugin<TState>` — определение плагина с хуками
- `IPersistenceAdapter<TState>` — интерфейс хранилища

#### 2. `eventBus.ts` — Система событий

```typescript
const bus = new EventBus();

// Подписка
bus.on("player:levelup", (data) => console.log(`Level up! ${data.level}`));

// Однократная подписка
bus.once("game:start", () => console.log("Игра началась"));

// Отправка
bus.emit("player:levelup", { level: 5 });

// Отписка
const handler = () => {};
bus.on("test", handler);
bus.off("test", handler);

// Очистка
bus.clear("player:levelup"); // Удалить слушателей конкретного события
bus.clear(); // Удалить ВСЕ слушатели

// Кол-во слушателей
bus.listenerCount("player:levelup"); // → 0
```

#### 3. `stateManager.ts` — Управление состоянием

```typescript
const stateManager = new StateManager<MyFarmState>(
  new MemoryAdapter<MyFarmState>(), // Или LocalFileAdapter("data/db.json")
  { coins: 500, level: 1, inventory: {} }, // Значения по умолчанию
  eventBus,
  { saveDebounceMs: 3000 }, // Задержка перед автосохранением
);

await stateManager.init();

// Получить/создать стейт
const player = stateManager.get("user123", "Alice");
// → { id: "user123", username: "Alice", coins: 500, level: 1, ... }

// Обновить стейт (иммутабельно)
const updated = stateManager.update("user123", (state) => ({
  ...state,
  coins: state.coins + 100,
}));

// Подписка на изменения
const unsubscribe = stateManager.subscribe((state, action) => {
  console.log(`Игрок ${state.id} обновлён`);
});
unsubscribe(); // Отписка

// Принудительное сохранение
await stateManager.saveNow();

// Статистика
stateManager.playerCount; // 1
stateManager.getPlayerIds(); // ["user123"]
stateManager.has("user123"); // true
```

#### 3.1. Продвинутый паттерн: GameStore (Slices)

Для сложных приложений (как **Game Hub**) рекомендуется использовать паттерн **Slice**, вдохновленный Redux/Zustand. Это позволяет разделить монолитный стейт на независимые модули.

Пример архитектуры (см. `examples/game-hub/public/js/store.js`):

```javascript
// store.js
const createStore = (set, get) => ({
  resources: createResourcesSlice(set, get), // ⚡ Энергия, золото
  farm: createFarmSlice(set, get), // 🌱 Грядки, инвентарь
  pet: createPetSlice(set, get), // 🐾 Питомец
});

// Использование в компоненте
const { energy } = useStore((state) => state.resources);
```

#### 4. `persistence.ts` — Адаптеры хранилища

| Адаптер            | Описание             | Когда использовать       |
| ------------------ | -------------------- | ------------------------ |
| `MemoryAdapter`    | В оперативной памяти | Разработка, тесты        |
| `LocalFileAdapter` | JSON-файл на диске   | Одиночный сервер         |
| GCS / Redis        | Облачное хранилище   | Продакшн, мульти-инстанс |

```typescript
// Память (данные теряются при перезапуске)
const memory = new MemoryAdapter<MyState>();

// Файл (данные сохраняются между запусками)
const file = new LocalFileAdapter<MyState>("data/players.json");

// Оба реализуют IPersistenceAdapter:
await adapter.init();
await adapter.save("id", state);
const loaded = await adapter.load("id");
await adapter.saveAll(statesMap);
const all = await adapter.loadAll();
await adapter.delete("id");
await adapter.close();
```

#### 5. `baseServer.ts` — Express-сервер

Готовый сервер с типовыми маршрутами:

| Маршрут                    | Метод | Описание                           |
| -------------------------- | ----- | ---------------------------------- |
| `/api/health`              | GET   | Проверка здоровья + кол-во игроков |
| `/api/token`               | POST  | Discord OAuth2 обмен code→token    |
| `/api/content`             | GET   | Весь контент игры (с ETag-кешем)   |
| `/api/content/version`     | GET   | Версия контента (для поллинга)     |
| `/api/content/:type`       | GET   | Конкретный тип контента            |
| `/api/state`               | GET   | Стейт текущего игрока (auth)       |
| `/api/state/:userId`       | GET   | Стейт другого игрока (публичный)   |
| `/api/state`               | POST  | Сохранить стейт игрока (auth)      |
| `/api/players`             | GET   | Список игроков для соц. функций    |
| `/admin/api/content`       | GET   | Весь контент (admin auth)          |
| `/admin/api/content/:type` | PUT   | Обновить контент (admin auth)      |

```typescript
const server = new BaseServer({
  config: { port: 8080, adminPanel: true, adminPasswordEnv: "ADMIN_PASSWORD" },
  stateManager,
  contentManager,
  discordClientId: process.env.DISCORD_CLIENT_ID,
  discordClientSecret: process.env.DISCORD_CLIENT_SECRET,
  validateState: (data) => MyStateSchema.safeParse(data), // Zod-валидация
});

// Добавить свои маршруты
const auth = server.getAuthMiddleware();
server.app.post("/api/farm/plant", auth, (req, res) => {
  // Ваша логика посадки
  res.json({ success: true });
});

// Статика + SPA
server.serveStatic("dist");
server.addSPACatchAll("dist/index.html"); // Вызвать ПОСЛЕДНИМ

await server.start();

// Graceful shutdown
process.on("SIGTERM", () => server.shutdown());
```

#### 6. `baseScene.ts` — Phaser-сцена

Абстрактный базовый класс для 2D-игр:

```typescript
class MyFarmScene extends BaseScene {
  constructor() {
    super({
      key: "FarmScene",
      grid: {
        width: 16,
        height: 16,
        tileWidth: 64,
        tileHeight: 32,
        isometric: true,
      },
      backgroundColor: 0x2f3136,
      eventBus: gameBus,
      assetManager: assets,
    });
  }

  create() {
    // Автоматический расчёт зума
    this.cameras.main.setZoom(this.calculateZoom());

    // Клик по сетке
    this.input.on("pointerdown", (ptr) => {
      const world = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
      const { gridX, gridY } = this.getGridFromScreen(world.x, world.y);
      if (this.isValidGrid(gridX, gridY)) {
        this.gameBus.emit("grid:click", { gridX, gridY });
      }
    });
  }

  drawScene() {
    this.resetPools(); // Сброс пулов объектов
    this.drawGrid(); // Сетка
    this.drawHighlight(5, 5); // Подсветка тайла
    this.showFloatingText(5, 5, "+10 🪙", "#ffcc00"); // Анимированный текст
  }
}
```

Ключевые методы:

- `getScreenFromGrid(x, y)` / `getGridFromScreen(x, y)` — конвертация координат
- `isValidGrid(x, y)` — проверка границ
- `drawGrid()` / `drawHighlight()` — отрисовка сетки
- `showFloatingText()` — всплывающий текст с анимацией
- `getGraphics()` / `getText()` — получение из пула (0 аллокаций)
- `resetPools()` — сброс пулов (вызывать в начале `drawScene`)

---

## 🔧 CLI-Генератор

### Команда

```bash
node framework/cli/dist/index.js <имя-проекта> [опции]
```

### Параметры

| Параметр        | Описание               | Значения                                   | По умолчанию |
| --------------- | ---------------------- | ------------------------------------------ | ------------ |
| `--genre`       | Жанр игры              | `farm`, `card-battle`, `trivia`, `match-3` | `farm`       |
| `--persistence` | Хранилище              | `memory`, `local-file`, `gcs`              | `memory`     |
| `--locale`      | Локали (через запятую) | `en`, `ru`, `de`, ...                      | `en`         |
| `--theme`       | Цветовая тема          | `discord`, `dark`, `light`                 | `discord`    |

### Примеры

```bash
# Ферма с сохранением в файл
node framework/cli/dist/index.js my-farm --genre farm --persistence local-file

# Викторина на двух языках
node framework/cli/dist/index.js quiz-night --genre trivia --locale en,ru

# Карточная игра
node framework/cli/dist/index.js card-arena --genre card-battle

# Пазл match-3
node framework/cli/dist/index.js gem-blast --genre match-3
```

### Что генерируется

```
my-farm/
├── game.config.json       # Конфигурация с подставленными переменными
├── server.js              # Сервер (если есть в шаблоне)
├── .env                   # Шаблон секретов
├── .gitignore
├── README.md
├── src/
│   ├── types.ts           # Типы для конкретного жанра
│   ├── engine/            # Движок игры (если есть)
│   └── scenes/            # Phaser-сцены (если есть)
└── data/content/          # JSON контент
```

### Переменные шаблонов

CLI автоматически подставляет эти переменные в файлах:

| Переменная        | Пример значения |
| ----------------- | --------------- |
| `{{GAME_ID}}`     | `my-farm`       |
| `{{GAME_TITLE}}`  | `My Farm`       |
| `{{GAME_GENRE}}`  | `farm`          |
| `{{PERSISTENCE}}` | `memory`        |
| `{{LOCALES}}`     | `["en","ru"]`   |
| `{{VERSION}}`     | `0.1.0`         |

---

## 🎯 Шаблоны жанров

### Сравнение

| Жанр           | Рендерер       | Мультиплеер | Игровой движок   | Контент           |
| -------------- | -------------- | ----------- | ---------------- | ----------------- |
| 🌾 Farm        | Phaser 3 (ISO) | Да (визиты) | FarmScene        | items, crops      |
| 🃏 Card Battle | DOM/React      | PvAI        | CardBattleEngine | cards (7 шт.)     |
| ❓ Trivia      | DOM/React      | Да          | TriviaEngine     | questions (8 шт.) |
| 💎 Match-3     | Canvas         | Соло        | Match3Engine     | — (процедурная)   |

### 🌾 Farm — Фермерский симулятор

**Файлы:** `game.config.json`, `types.ts`, `FarmScene.ts`, `server.js`, `items.json`, `crops.json`

Изометрическая ферма:

- Посадка и сбор урожая
- Декорирование комнат
- Визиты к друзьям
- Питомцы

```typescript
// types.ts — расширение BasePlayerState
interface FarmPlayerState extends BasePlayerState {
  coins: number;
  gems: number;
  inventory: Record<string, number>;
  rooms: Record<string, FarmRoom>;
  pets: PetInstance[];
}
```

### 🃏 Card Battle — Карточная битва

**Файлы:** `game.config.json`, `types.ts`, `CardBattleEngine.ts`, `cards.json`

Пошаговый бой с элементами:

- Сбор и построение колоды
- 6 элементов: Огонь, Вода, Земля, Воздух, Тьма, Свет
- AI-противник
- Раритеты: Common, Rare, Epic, Legendary

```typescript
// Пример карты из cards.json
{
  "id": "earth_golem",
  "name": "Earth Golem",
  "rarity": "rare",
  "type": "creature",
  "attack": 5,
  "health": 8,
  "element": "earth"
}
```

### ❓ Trivia — Викторина

**Файлы:** `game.config.json`, `types.ts`, `TriviaEngine.ts`, `questions.json`

Квиз с таймером и очками:

- Категории + уровни сложности (easy / medium / hard)
- Очки за время ответа (быстрее = больше)
- Серии правильных ответов (стрики)
- Готовые вопросы (Technology, Science)

```typescript
// Пример вопроса из questions.json
{
  "id": "q1",
  "question": "In which city is Discord's headquarters?",
  "correctAnswer": "San Francisco",
  "wrongAnswers": ["New York", "Seattle", "Los Angeles"],
  "difficulty": "easy",
  "points": 100
}
```

### 💎 Match-3 — Пазл

**Файлы:** `game.config.json`, `types.ts`, `Match3Engine.ts`

Классический match-3:

- Сетка 8×8 с 6 типами камней
- Обнаружение совпадений (горизонт + вертик)
- Гравитация + каскады
- Система комбо (до 5× множитель)
- Генерация доски без начальных совпадений

---

## ⚙ Конфигурация

Каждая игра имеет `game.config.json`:

```json
{
  "id": "my-game",
  "title": "My Awesome Game",
  "description": "...",
  "genre": "farm",
  "version": "0.1.0",
  "locales": ["en", "ru"],
  "persistence": "local-file",
  "discord": {
    "clientId": "YOUR_CLIENT_ID",
    "scopes": ["identify", "rpc.activities.write"]
  },
  "rendering": {
    "type": "phaser",
    "grid": {
      "width": 16,
      "height": 16,
      "tileWidth": 64,
      "tileHeight": 32,
      "isometric": true
    },
    "backgroundColor": 3092790
  },
  "server": {
    "port": 8080,
    "adminPanel": true,
    "adminPasswordEnv": "ADMIN_PASSWORD"
  },
  "features": {
    "multiplayer": true,
    "leaderboard": true
  }
}
```

Env-переменные **автоматически переопределяют** конфиг:

| Env                 | Переопределяет     |
| ------------------- | ------------------ |
| `DISCORD_CLIENT_ID` | `discord.clientId` |
| `PORT`              | `server.port`      |
| `GAME_PERSISTENCE`  | `persistence`      |

---

## 🔌 Система плагинов

Расширение функциональности без изменения кода ядра:

```typescript
import { definePlugin, PluginManager } from "@discord-activities/core";

// Определение плагина
const xpDoubler = definePlugin({
  id: "weekend-xp",
  name: "Weekend XP Doubler",
  version: "1.0.0",
  hooks: {
    onInit: (config) => {
      console.log(`Plugin initialized for: ${config.title}`);
    },

    // Перехват ПЕРЕД обработкой действия (можно модифицировать или отменить)
    beforeAction: (action, state) => {
      if (action.type === "cheat") return null; // Отмена
      return action; // Пропустить
    },

    // После обработки действия
    afterAction: (action, result) => {
      if (result.success) {
        console.log(`Action ${action.type} succeeded`);
      }
    },

    // Игровой тик (для логики реального времени)
    onTick: (delta, state) => {
      /* ... */
    },

    // Подключение/отключение игрока
    onPlayerJoin: (playerId) => {
      /* ... */
    },
    onPlayerLeave: (playerId) => {
      /* ... */
    },

    // Очистка при выключении
    onDestroy: async () => {
      /* ... */
    },
  },
});

// Регистрация
const plugins = new PluginManager();
plugins.register(xpDoubler);
await plugins.initAll(gameConfig);

// Использование в игровом цикле
const action = plugins.runBeforeAction(rawAction, state);
if (action) {
  const result = processAction(action, state);
  plugins.runAfterAction(action, result);
}
```

### Жизненный цикл хуков

```
onInit ──► onPlayerJoin ──► beforeAction ──► afterAction ──► onTick
                                  │
                                  └──► return null (отмена действия)

onPlayerLeave ──► onDestroy
```

---

## 🌍 Интернационализация (i18n)

```typescript
import { I18n } from "@discord-activities/core";

const i18n = new I18n("en");

// Загрузка переводов
i18n.load("en", {
  ui: {
    shop: { title: "Shop", buy: "Buy for {{price}} coins" },
  },
  items: { tomato: "Tomato" },
});

i18n.load("ru", {
  ui: {
    shop: { title: "Магазин", buy: "Купить за {{price}} монет" },
  },
  items: { tomato: "Помидор" },
});

// Использование
i18n.t("ui.shop.title"); // → "Shop"
i18n.t("ui.shop.buy", { price: 100 }); // → "Buy for 100 coins"

// Переключение языка
i18n.setLocale("ru");
i18n.t("ui.shop.title"); // → "Магазин"
i18n.t("ui.shop.buy", { price: 100 }); // → "Купить за 100 монет"

// Фолбэк на язык по умолчанию
i18n.t("unknown.key"); // → "unknown.key" (ключ как есть)

// Для контент-элементов с полями localizedNames
const item = { name: "Tomato", localizedNames: { ru: "Помидор" } };
i18n.tField(item, "name"); // → "Помидор" (если locale = "ru")
```

---

## 💾 Персистентность

### Выбор адаптера

| Адаптер            | Данные теряются? | Мульти-инстанс? | Когда           |
| ------------------ | :--------------: | :-------------: | --------------- |
| `MemoryAdapter`    |      ✅ Да       |     ❌ Нет      | Разработка      |
| `LocalFileAdapter` |      ❌ Нет      |     ❌ Нет      | Прод (1 сервер) |
| GCS / Redis        |      ❌ Нет      |      ✅ Да      | Прод (scale)    |

### Создание своего адаптера

Реализуйте интерфейс `IPersistenceAdapter<TState>`:

```typescript
class RedisAdapter<
  TState extends BasePlayerState,
> implements IPersistenceAdapter<TState> {
  async init() {
    /* подключение к Redis */
  }
  async load(id: string) {
    /* redis.get */
  }
  async save(id: string, state: TState) {
    /* redis.set */
  }
  async loadAll() {
    /* redis.keys + mget */
  }
  async saveAll(states: Map<string, TState>) {
    /* pipeline set */
  }
  async listPlayers() {
    /* redis.keys */
  }
  async delete(id: string) {
    /* redis.del */
  }
  async close() {
    /* redis.quit */
  }
}
```

---

## 🎮 Discord интеграция

### DiscordBridge (клиент)

```typescript
const bridge = new DiscordBridge({
  clientId: "YOUR_CLIENT_ID",
  scopes: ["identify", "rpc.activities.write"],
  tokenEndpoint: "/api/token",
  eventBus: gameBus,
});

await bridge.init();
console.log(bridge.user); // { id, username, avatar, ... }
console.log(bridge.accessToken); // OAuth access token

// Статус активности
await bridge.setActivity("Playing Farm", "Level 5", {
  largeImage: "farm_logo",
  largeText: "My Farm Game",
});

// Жизненный цикл
gameBus.on("discord:lifecycle", ({ state }) => {
  // "initializing" → "authenticating" → "ready" | "error"
});
```

### Авторизация на сервере

`BaseServer` автоматически предоставляет:

- `POST /api/token` — обмен OAuth-кода на access_token
- `requireAuth` middleware — валидация Bearer-токена через Discord API

---

## 🧪 Тесты

### Запуск

```bash
cd framework
npm install
npm test
```

### Покрытие

| Модуль       | Тестов | Что тестируется                            |
| ------------ | ------ | ------------------------------------------ |
| EventBus     | 8      | emit, off, once, clear, edge cases         |
| StateManager | 9      | CRUD, подписки, event bus, иммутабельность |
| i18n         | 8      | ключи, интерполяция, фолбэк, tField        |
| Plugin       | 7      | регистрация, хуки, модификация, отмена     |
| Config       | 4      | дефолты, merge, deep merge, env            |
| Persistence  | 7      | CRUD, deep clone, batch, cleanup           |

#### Game Hub (`examples/game-hub`)

Game Hub имеет собственный набор тестов (184 штук) на `node:test` — см. `examples/game-hub/README.md`:

```bash
cd examples/game-hub
npm test          # Unit (49) + API (24) + Blox (30) + M3 (12) + UX (36) + GCP (20) + Perf (7) + Version (2) + Star Drop (4)
```

### CI

GitHub Actions (`.github/workflows/framework-ci.yml`):

- Node.js 20 + 22
- Unit-тесты
- TypeScript strict-проверка

---

## 🚀 Деплой

### Docker

```dockerfile
FROM node:20-slim AS builder
WORKDIR /app
COPY . .
RUN npm ci && npm run build

FROM node:20-slim
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json .
COPY --from=builder /app/data ./data
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "server.js"]
```

### Google Cloud Run

```bash
gcloud run deploy my-game --source . --set-env-vars="DISCORD_CLIENT_ID=...,DISCORD_CLIENT_SECRET=..."
```

---

## 🔄 Миграция

Фреймворк живёт в `framework/` параллельно с существующей игрой. **Ноль изменений** в оригинальном коде.

Подробный план миграции: `framework/docs/migration.md`

### Таблица замен модулей

| Существующий файл           | Модуль фреймворка         |
| --------------------------- | ------------------------- |
| `services/eventBus.ts`      | `EventBus`                |
| `services/discord.ts`       | `DiscordBridge`           |
| `services/contentLoader.ts` | `ContentManager`          |
| `server/storage.js`         | `LocalFileAdapter` / GCS  |
| `server/contentManager.js`  | `ContentManager` (сервер) |

---

## 📖 API Reference

Полная справка по экспортируемым модулям:

### Классы

| Класс                 | Назначение                                |
| --------------------- | ----------------------------------------- |
| `EventBus`            | Pub/sub для декаупленной коммуникации     |
| `StateManager<T>`     | Управление стейтом с дебаунсом сохранений |
| `MemoryAdapter<T>`    | In-memory хранилище                       |
| `LocalFileAdapter<T>` | JSON-файл хранилище                       |
| `DiscordBridge`       | Discord SDK обёртка                       |
| `ContentManager`      | Загрузка/кеш контента                     |
| `AssetManager`        | Спрайт/аудио пайплайн                     |
| `BaseServer<T>`       | Express-фабрика с auth/CRUD/admin         |
| `BaseScene`           | Phaser 3 сцена с сеткой и пулами          |
| `I18n`                | Интернационализация                       |
| `PluginManager<T>`    | Менеджер плагинов                         |

### Функции

| Функция                   | Назначение                        |
| ------------------------- | --------------------------------- |
| `definePlugin()`          | Типобезопасное создание плагина   |
| `loadGameConfig()`        | Загрузка конфига с дефолтами      |
| `loadGameConfigWithEnv()` | Загрузка конфига + env-переменные |

### Синглтоны

| Экспорт               | Назначение              |
| --------------------- | ----------------------- |
| `gameBus`             | Глобальный EventBus     |
| `i18n`                | Глобальный I18n-инстанс |
| `DEFAULT_GAME_CONFIG` | Конфиг по умолчанию     |

---

## 📄 Лицензия

MIT
