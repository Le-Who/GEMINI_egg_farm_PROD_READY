## 2024-05-23 - [Preventing React Re-Renders with Reference Stability]
**Learning:** `JSON.stringify` comparison in the data fetching layer (`GameEngine.getUser`) is a cheap way to ensure object reference stability for small game states (<10KB). This prevents massive React re-render cascades in polling-heavy apps by allowing `React.memo` and dependency checks to bail out early.
**Action:** When working with polled data, always check if the new data is actually different before updating state, especially if that state is passed deep into the component tree.

## 2024-05-23 - [Test Artifact Isolation]
**Learning:** Integration tests running against the real `server.js` logic can generate local artifacts (like `data/db.json`). Always ensure tests use a temporary directory or mocked persistence layer, and verify `git status` before committing to avoid polluting the repo with test data.
**Action:** Add `data/db.json` to `.gitignore` or ensure test cleanup in `afterAll`.

## 2024-05-24 - [Efficient Random Sampling]
**Learning:** Using `array.sort(() => Math.random() - 0.5)` to pick a small subset of items is O(N log N) and becomes a bottleneck as N grows. For large datasets, picking random indices in a loop (O(K)) is orders of magnitude faster.
**Action:** Replace full array shuffles with random index selection when only a small sample is needed from a large collection.
