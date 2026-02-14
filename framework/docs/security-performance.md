# Security & Performance Recommendations

## Security

### Discord Token Handling

- **Never expose** `DISCORD_CLIENT_SECRET` to the frontend
- Store tokens in HTTP-only cookies or server sessions
- The `BaseServer` token exchange endpoint should be the only place handling secrets

### Input Validation

- All state updates from clients should be validated with Zod schemas
- Use `BaseServer`'s `validateState` option to plug in your schema
- Never trust client-computed values (coins, XP, etc.) — validate server-side

### Rate Limiting

```javascript
// Recommended: express-rate-limit
import rateLimit from "express-rate-limit";
app.use("/api/", rateLimit({ windowMs: 60_000, max: 60 }));
```

### Admin Panel

- Always change the default admin password
- Use a strong, unique `ADMIN_PASSWORD` env var
- Consider IP whitelisting for admin routes in production

### Dependencies

- Run `npm audit` regularly
- Pin dependency versions in production
- Use `npm ci` instead of `npm install` in CI/CD

## Performance

### State Management

- The `StateManager` debounces saves by default (3s)
- For high-traffic games, increase `saveDebounceMs` to 5–10s
- Consider Redis persistence for multi-instance deployments

### Content Caching

- `ContentManager` uses ETag-based caching for content API
- In production, set long cache headers for static assets
- Content polling interval should be ≥ 30s

### Phaser Scene Optimization

- `BaseScene` uses object pooling — always call `resetPools()` before each draw
- Avoid creating new `Graphics`/`Text` objects per frame — use the pool
- Limit the number of simultaneous tweens (floating text, etc.)

### Frontend Bundle

- Use code splitting with React.lazy for panels/modals
- Phaser 3 is ~1.5MB — ensure it's in a separate chunk
- Use Vite's `manualChunks` for optimal splitting:

```javascript
// vite.config.ts
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        phaser: ["phaser"],
        vendor: ["react", "react-dom"],
      },
    },
  },
}
```

### Docker

- Use multi-stage builds (already provided in templates)
- Set `NODE_ENV=production` for smaller bundles and faster startup
- Use `.dockerignore` to exclude `node_modules`, `data/`, `.env`
