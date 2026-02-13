## 2025-02-19 - Persistence Starvation via Global Debounce
**Vulnerability:** The `debouncedSaveDb` function used a global timeout that reset on *every* write. Under continuous load (writes < 3s apart), the database would *never* persist to disk, leading to total data loss on crash.
**Learning:** Global debouncing is dangerous for critical persistence paths in high-frequency applications.
**Prevention:** Use a throttle (max wait time) or periodic interval snapshotting instead of pure debounce for global saves.

## 2025-02-19 - In-Memory Rate Limiting
**Vulnerability:** The application lacked rate limiting, allowing DoS and brute force attacks.
**Learning:** Express apps behind proxies (like Cloud Run) need `app.set('trust proxy', 1)` to correctly rate limit based on IP.
**Prevention:** Always configure trust proxy settings when deploying behind load balancers.
