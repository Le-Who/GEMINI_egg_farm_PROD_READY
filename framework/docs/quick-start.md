# Quick Start Guide

Create your first Discord Activities game in 3 steps.

## Prerequisites

- Node.js 20+
- A Discord Application with Activities enabled
- Your `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET`

## Step 1: Generate

```bash
npx create-discord-activity-game my-game --genre farm
cd my-game
npm install
```

## Step 2: Configure

Edit `.env` with your Discord credentials:

```env
DISCORD_CLIENT_ID=your_id_here
DISCORD_CLIENT_SECRET=your_secret_here
```

## Step 3: Run

```bash
npm run dev
```

Open http://localhost:8080. In Discord dev mode, use the Activity Shelf to test.

## Project Structure

```
my-game/
├── game.config.json     # Game settings (genre, grid, features)
├── server.js            # Express server with game routes
├── .env                 # Secrets (not committed)
├── src/
│   ├── types.ts         # Game-specific TypeScript types
│   ├── App.tsx          # React root component
│   └── scenes/          # Phaser scenes (if applicable)
├── data/content/        # Game content JSON files
└── public/              # Static assets (sprites, audio)
```

## Customization

### Adding Items

Edit `data/content/items.json`:

```json
{
  "my_item": {
    "id": "my_item",
    "name": "Cool Item",
    "type": "DECORATION",
    "price": 100,
    "color": 16711935
  }
}
```

### Adding Routes

In `server.js`, add routes to the Express app:

```javascript
server.app.post("/api/my-action", auth, (req, res) => {
  const user = req.discordUser;
  const state = stateManager.get(user.id);
  // ... your logic
  res.json({ success: true, state });
});
```

### Using Plugins

```typescript
import { definePlugin, PluginManager } from "@discord-activities/core";

const myPlugin = definePlugin({
  id: "daily-bonus",
  name: "Daily Bonus",
  version: "1.0.0",
  hooks: {
    onPlayerJoin: (playerId) => {
      console.log(`${playerId} logged in — check daily bonus`);
    },
  },
});

const plugins = new PluginManager();
plugins.register(myPlugin);
```

## Deploying

### Docker

```bash
docker build -t my-game .
docker run -p 8080:8080 --env-file .env my-game
```

### Google Cloud Run

```bash
gcloud run deploy my-game --source .
```

Set environment variables in the Cloud Run console.
