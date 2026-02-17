# Changelog

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
