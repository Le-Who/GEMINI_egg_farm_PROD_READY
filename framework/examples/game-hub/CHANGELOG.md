# Changelog

## v3.3 — 2026-02-17

### Bug Fixes

- **Match-3**: Mode selector panel and preview board now shown automatically on first visit (no more empty screen)
- **Energy HUD**: Fixed tooltip countdown using wrong interval (5min → 2.5min); `syncFromServer` smart-merges timestamps to prevent visual jumps
- **Pet Profile**: Removed duplicate feed section (feeding lives in farm inventory); added missing Auto-Plant (Lv 7) ability display with tooltips for all 3 abilities
- **Farm Emojis**: Pre-populate crops from `localStorage` cache before API response to prevent 🌱 fallback on re-login

### Code Quality

- **Intentional duplication**: Documented why `findMatches`, `calcGoldReward`, `generateBoard` are duplicated between `match3.js` (client) and `game-logic.js` (server)
- **Test fix**: `ux.test.js` `getWateringMultiplier` was called with object instead of string (always returned default 0.7); now tests actual crop-specific multipliers
- Removed dead code: `feedPet()` and `renderFeedButtons()` from `pet.js`

## v3.2 — 2026-02-17

### GCP Resilience Tests (`tests/gcp.test.js`)

- **Latency**: All endpoints < 200ms budget, p95 across 20 warm requests
- **Concurrency**: 20 parallel buy-seeds (no gold overspend), parallel water/harvest (exactly 1 success)
- **Payload**: All responses < 16KB (farm, crops, leaderboard, full 12-plot inventory)
- **Save stress**: 50 rapid plant cycles + 30 burst buys maintain state consistency
- **Stale reconnect**: 10-min gap triggers offline report; 30s gap does not; energy regen matches interval math
- **Idempotency**: Double harvest/water/feed returns exactly 1 success, 1 rejection

### Test Audit Fixes

- `match3.test.js:251` — removed `if (m.size > 0) return;` skip clause (was silently passing)
- `ux.test.js` — pet flicker tests now assert minimum safety buffers (≥200ms, ≥1000ms, ≥30ms) instead of trivially-true comparisons

### Version

- All `?v=3.1` → `?v=3.2` (index.html, shared.js SmartLoader)
- Version badge → v3.2

---

## v3.1.1 — 2026-02-17 (hotfix)

- **CRASH FIX**: `STAR_TYPE` undefined in `animateCascade` (lines 726,730) — replaced with `DROP_TYPES.includes()`, same pattern as `renderBoard`
- **[object Object] reward**: `calcDropReward()` returns `{gold,seeds,energy}` object — `updateStatsUI` now builds compact text preview (`+40g+7⚡`)
- **Mode selector → left sidebar**: Absolute-positioned vertical bar left of board (`left:-110px`). Cards stacked vertically. `m3-layout` gets `position:relative`
- **Stale cache**: All `?v=3.0` → `?v=3.1` in index.html (6 CSS + 4 JS). SmartLoader `?v=1.5` → `?v=3.1` in shared.js

## v3.1 — 2026-02-17

### Farm

- Gold sync — instant `GameStore.resources.gold` deduct in `buySeeds`
- Harvest persist — `syncHarvestedToStore()` on load/harvest
- Sell button — formula `ceil((seedPrice*0.5)*(growSec*0.25))`
- Feed pet — 🍖 button, +2⚡, max-energy guard
- Water timeout — 3s `setTimeout` fallback
- Server `/api/farm/sell-crop` endpoint

### Match-3

- Star Drop — 3 types: `drop_gold`💰, `drop_seeds`🌾, `drop_energy`⚡
- Play Again — close overlay before mode selector
- Time Attack — timer-only display, no "9999" moves

### Energy/HUD

- Regen 150s (was 300s) in `game-logic.js` + `hud.js`
- Aurora pill — `@keyframes auroraShift` gradient

### CSS

- `farm.css` — `.farm-inv-btn.sell`, `.farm-inv-btn.feed`
- `match3.css` — `.drop-gold`, `.drop-seeds`, `.drop-energy` (was `.star-gem`)

### Tests

- 12 tile clearing tests (findMatches, resolveBoard, gravity, cascade, drop exclusion)

---

## v3.0 — 2026-02-17

### Hotfix (7 bugs)

1. Farm panel → absolute overlay
2. Harvest → `resources.__harvested` sync
3. Toast → +XP only
4. Fast plant → per-plot version
5. Energy → always trust server
6. Mode selector → arrow function wrapper
7. Regen bar → energy pill fill
