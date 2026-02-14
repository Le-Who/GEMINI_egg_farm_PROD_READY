/**
 * BaseServer — Express server factory for Discord Activities games.
 *
 * Creates a pre-configured Express app with:
 * - Health check endpoint
 * - Discord OAuth2 token exchange
 * - Player state CRUD (GET/POST /api/state)
 * - Content API (GET /api/content)
 * - Admin panel endpoints (optional)
 * - Static file serving
 * - SPA catch-all
 *
 * Games extend this with their own routes.
 */

import express, { Express, Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";
import type { BasePlayerState, ServerConfig } from "./types.js";
import { StateManager } from "./stateManager.js";
import { ContentManager } from "./contentManager.js";

export interface BaseServerOptions<TState extends BasePlayerState> {
  /** Express app (will be created if not provided) */
  app?: Express;
  /** Server config */
  config: ServerConfig;
  /** State manager instance */
  stateManager: StateManager<TState>;
  /** Content manager instance */
  contentManager: ContentManager;
  /** Static files directory (built frontend) */
  staticDir?: string;
  /** Discord Client ID */
  discordClientId?: string;
  /** Discord Client Secret */
  discordClientSecret?: string;
  /** Discord Redirect URI */
  discordRedirectUri?: string;
  /** Admin password */
  adminPassword?: string;
  /** State validation function (replaces Zod schema) */
  validateState?: (data: any) => {
    success: boolean;
    data?: TState;
    error?: any;
  };
}

export class BaseServer<TState extends BasePlayerState> {
  public readonly app: Express;
  private readonly config: ServerConfig;
  private readonly stateManager: StateManager<TState>;
  private readonly contentManager: ContentManager;

  constructor(private readonly options: BaseServerOptions<TState>) {
    this.app = options.app ?? express();
    this.config = options.config;
    this.stateManager = options.stateManager;
    this.contentManager = options.contentManager;
    this.setupMiddleware();
    this.setupCoreRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json({ limit: "10mb" }));
  }

  private setupCoreRoutes(): void {
    // Health check
    this.app.get("/api/health", (_req: Request, res: Response) => {
      res.json({
        status: "ok",
        timestamp: Date.now(),
        players: this.stateManager.playerCount,
      });
    });

    // Content API
    this.app.get("/api/content", (_req: Request, res: Response) => {
      const version = this.contentManager.getVersion();
      const etag = `"v${version}"`;
      res.set("ETag", etag);
      if (_req.headers["if-none-match"] === etag) return res.status(304).end();
      res.json(this.contentManager.getAll());
    });

    this.app.get("/api/content/version", (_req: Request, res: Response) => {
      res.json({ version: this.contentManager.getVersion() });
    });

    this.app.get("/api/content/:type", (req: Request, res: Response) => {
      const typeKeys = this.contentManager.getTypeKeys();
      const { type } = req.params;
      if (typeKeys.length > 0 && !typeKeys.includes(type)) {
        return res.status(404).json({ error: `Unknown content type: ${type}` });
      }
      res.json(this.contentManager.get(type) ?? {});
    });

    // Discord OAuth2 Token Exchange
    this.app.post("/api/token", async (req: Request, res: Response) => {
      const clientId =
        this.options.discordClientId ?? process.env.DISCORD_CLIENT_ID;
      const clientSecret =
        this.options.discordClientSecret ?? process.env.DISCORD_CLIENT_SECRET;
      const redirectUri =
        this.options.discordRedirectUri ??
        process.env.DISCORD_REDIRECT_URI ??
        "";

      if (!clientId || !clientSecret) {
        return res
          .status(500)
          .json({ error: "Discord credentials not configured" });
      }

      try {
        const { code } = req.body;
        const params = new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
        });

        const response = await fetch("https://discord.com/api/oauth2/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: params,
        });

        const data = await response.json();
        if (!response.ok) {
          return res.status(500).json(data);
        }
        res.json(data);
      } catch (error) {
        console.error("[BaseServer] Token exchange error:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    // Discord Auth middleware factory
    const requireAuth = async (
      req: Request,
      res: Response,
      next: NextFunction,
    ) => {
      const authHeader = req.headers.authorization;
      if (!authHeader)
        return res.status(401).json({ error: "No token provided" });
      const token = authHeader.split(" ")[1];
      try {
        const userReq = await fetch("https://discord.com/api/users/@me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!userReq.ok) throw new Error("Invalid token");
        (req as any).discordUser = await userReq.json();
        next();
      } catch {
        return res.status(401).json({ error: "Invalid token" });
      }
    };

    // Player State CRUD
    this.app.get("/api/state", requireAuth, (req: Request, res: Response) => {
      const user = (req as any).discordUser;
      const state = this.stateManager.has(user.id)
        ? this.stateManager.get(user.id)
        : null;
      res.json(state);
    });

    this.app.get("/api/state/:userId", (req: Request, res: Response) => {
      const state = this.stateManager.has(req.params.userId)
        ? this.stateManager.get(req.params.userId)
        : null;
      if (!state) return res.status(404).json({ error: "User not found" });
      res.json(state);
    });

    this.app.post("/api/state", requireAuth, (req: Request, res: Response) => {
      const user = (req as any).discordUser;

      if (this.options.validateState) {
        const result = this.options.validateState(req.body);
        if (!result.success) {
          return res
            .status(400)
            .json({ error: "Invalid state", details: result.error });
        }
      }

      const state = req.body as TState;
      if (state.id !== user.id) {
        return res.status(400).json({ error: "User ID mismatch" });
      }

      this.stateManager.set(user.id, state);
      res.json({ success: true });
    });

    // Players list (for social features like visiting)
    this.app.get("/api/players", requireAuth, (req: Request, res: Response) => {
      const user = (req as any).discordUser;
      const ids = this.stateManager
        .getPlayerIds()
        .filter((id) => id !== user.id);
      const profiles = ids.slice(0, 10).map((id) => {
        const s = this.stateManager.get(id);
        return { id: s.id, username: s.username };
      });
      res.json(profiles);
    });

    // Admin routes (if enabled)
    if (this.config.adminPanel) {
      this.setupAdminRoutes();
    }
  }

  private setupAdminRoutes(): void {
    const adminPassword =
      this.options.adminPassword ??
      process.env[this.config.adminPasswordEnv] ??
      "admin123";

    const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
      const authHeader = req.headers.authorization;
      if (!authHeader)
        return res.status(401).json({ error: "Admin password required" });
      const password = authHeader.replace("Bearer ", "");
      if (password !== adminPassword)
        return res.status(403).json({ error: "Invalid admin password" });
      next();
    };

    this.app.get(
      "/admin/api/content",
      requireAdmin,
      (_req: Request, res: Response) => {
        res.json(this.contentManager.getAll());
      },
    );

    this.app.put(
      "/admin/api/content/:type",
      requireAdmin,
      (req: Request, res: Response) => {
        this.contentManager.set(req.params.type, req.body);
        res.json({ success: true, type: req.params.type });
      },
    );
  }

  /** Add static file serving for the built frontend */
  serveStatic(distDir: string): void {
    if (fs.existsSync(distDir)) {
      this.app.use(express.static(distDir));
    }
  }

  /** Add SPA catch-all route (must be called LAST) */
  addSPACatchAll(indexPath: string): void {
    this.app.get("*", (req: Request, res: Response) => {
      if (req.path.startsWith("/api") || req.path.startsWith("/admin")) {
        return res.status(404).json({ error: "Not found" });
      }
      res.sendFile(indexPath);
    });
  }

  /** Start listening */
  async start(): Promise<ReturnType<Express["listen"]>> {
    return this.app.listen(this.config.port, () => {
      console.log(`[BaseServer] Running on port ${this.config.port}`);
    });
  }

  /** Graceful shutdown */
  async shutdown(): Promise<void> {
    await this.stateManager.saveNow();
    await this.stateManager.destroy();
    this.contentManager.destroy();
  }

  /** Get the requireAuth middleware for use in custom routes */
  getAuthMiddleware(): (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => Promise<void> {
    return async (req: Request, res: Response, next: NextFunction) => {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        res.status(401).json({ error: "No token provided" });
        return;
      }
      const token = authHeader.split(" ")[1];
      try {
        const userReq = await fetch("https://discord.com/api/users/@me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!userReq.ok) throw new Error("Invalid token");
        (req as any).discordUser = await userReq.json();
        next();
      } catch {
        res.status(401).json({ error: "Invalid token" });
      }
    };
  }
}
