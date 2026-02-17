# Changelog

## v3.1 — 2026-02-17

### Farm & Inventory

- **Gold sync** — Buying seeds now instantly updates gold display (optimistic deduct + rollback on error)
- **Harvest persist** — Harvested items no longer disappear on reload (server `farm.harvested` → `resources.__harvested`)
- **Sell button** — Each inventory item has 💰 sell button using formula `ceil((seedPrice × 0.5) × (growthSec × 0.25))`
- **Feed pet** — 🍖 button in inventory feeds crop to pet (+2⚡), blocked at max energy
- **Water timeout** — Water button now has 3s fallback to release click lock on slow server

### Match-3

- **Play Again fixed** — Game-over overlay now dismissed before showing mode selector
- **Star Drop redesign** — 3 unique reward objects: 💰 Gold Bag, 🌾 Seed Pack, ⚡ Energy (distinct colors/animations)
- **Time Attack display** — Shows countdown timer instead of "9999 moves"
- **Tile clearing tests** — Unit tests for `findMatches()`, `resolveBoard()`, gravity, and cascade

### Energy & HUD

- **Faster regen** — Energy regenerates every 150s (was 300s)
- **Aurora energy pill** — Animated aurora borealis gradient fill (teal → purple → green)

### Server

- **`/api/farm/sell-crop`** — New endpoint for selling harvested crops

---

## v3.0 — 2026-02-17

### Hotfix (7 bugs)

1. Farm panel shifted left — Fixed to `position: absolute` overlay
2. Harvested items lost — `harvest()` now writes to `resources.__harvested`
3. Harvest toast showed +gold — Changed to +XP only
4. Fast planting drops clicks — Per-plot version tracking (`Map<plotId, version>`)
5. Stale energy display — Removed "smart merge", always trust server energy
6. Mode selector skipped — Arrow function wrapper prevents `MouseEvent` arg leak
7. Energy regen bar misplaced — Regen fill now covers full energy pill

---

## v1.0 – v2.x

Initial release through iterative development. Core systems: Farm, Match-3 (Gem Crush), Brain Blitz (Trivia), Pet Companion, HUD with energy/gold, Discord Activity SDK integration.
