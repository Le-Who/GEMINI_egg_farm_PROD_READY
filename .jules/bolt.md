## 2024-05-23 - [Preventing React Re-Renders with Reference Stability]
**Learning:** `JSON.stringify` comparison in the data fetching layer (`GameEngine.getUser`) is a cheap way to ensure object reference stability for small game states (<10KB). This prevents massive React re-render cascades in polling-heavy apps by allowing `React.memo` and dependency checks to bail out early.
**Action:** When working with polled data, always check if the new data is actually different before updating state, especially if that state is passed deep into the component tree.

## 2024-05-23 - [Test Artifact Isolation]
**Learning:** Integration tests running against the real `server.js` logic can generate local artifacts (like `data/db.json`). Always ensure tests use a temporary directory or mocked persistence layer, and verify `git status` before committing to avoid polluting the repo with test data.
**Action:** Add `data/db.json` to `.gitignore` or ensure test cleanup in `afterAll`.

## 2024-05-24 - [Express.listen default parameter pitfall]
**Learning:** `app.listen(port || PORT)` fails if `port` is passed as `0` (for random port), because `0` is falsy and it falls back to `PORT` (8080). This causes parallel tests to fail with `EADDRINUSE`.
**Action:** Use `port !== undefined ? port : PORT` or ensure correct handling of `0` when allowing dynamic port assignment.
