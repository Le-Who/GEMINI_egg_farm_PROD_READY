## 2024-05-23 - [Preventing React Re-Renders with Reference Stability]
**Learning:** `JSON.stringify` comparison in the data fetching layer (`GameEngine.getUser`) is a cheap way to ensure object reference stability for small game states (<10KB). This prevents massive React re-render cascades in polling-heavy apps by allowing `React.memo` and dependency checks to bail out early.
**Action:** When working with polled data, always check if the new data is actually different before updating state, especially if that state is passed deep into the component tree.

## 2024-05-23 - [Test Artifact Isolation]
**Learning:** Integration tests running against the real `server.js` logic can generate local artifacts (like `data/db.json`). Always ensure tests use a temporary directory or mocked persistence layer, and verify `git status` before committing to avoid polluting the repo with test data.
**Action:** Add `data/db.json` to `.gitignore` or ensure test cleanup in `afterAll`.

## 2024-05-24 - [Optimized Neighbor Selection]
**Learning:** `server.js` was using an O(N log N) shuffle on the entire user database (which could be large) to select just 5 random neighbors. This is a classic scalability bottleneck.
**Action:** Replaced with an O(1) random index sampling approach for N > 20 users. Kept O(N) shuffle for small N for simplicity and correctness. Verified with a performance benchmark showing ~10x improvement (50ms -> 4ms for 50k users).

## 2024-05-24 - [Test Environment Variable Override]
**Learning:** `tests/setup.ts` sets `process.env.DB_PATH` globally for all tests to a temporary file. This overrides any `DATA_DIR` setting in `server.js` logic.
**Action:** When writing performance tests that need to control the database file location or content, explicitly override `process.env.DB_PATH` in the test setup (`beforeAll`), or write to the path specified by `process.env.DB_PATH`.
