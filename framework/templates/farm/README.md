# {{GAME_TITLE}}

A cozy farm simulation game for Discord Activities.

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:8080 in your browser, or deploy as a Discord Activity.

## Features

- 🌱 Plant and harvest crops
- 🏠 Decorate your room
- 👥 Visit friends' farms
- 🐾 Collect pets

## Project Structure

```
├── game.config.json    # Game configuration
├── server.js           # Express server (extends BaseServer)
├── src/
│   ├── App.tsx         # React root component
│   ├── types.ts        # Farm-specific types
│   └── scenes/
│       └── FarmScene.ts  # Phaser game scene
├── data/content/       # Game content (items, crops)
└── public/             # Static assets
```
