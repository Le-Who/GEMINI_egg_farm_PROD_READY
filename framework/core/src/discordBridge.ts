/**
 * DiscordBridge — Discord Activities SDK wrapper.
 *
 * Handles SDK initialization, OAuth2 code→token exchange,
 * activity status updates, and user info retrieval.
 * Extracted and generalized from the egg farm's discord.ts.
 */

import type {
  DiscordUser,
  DiscordConfig,
  ActivityLifecycleState,
} from "./types.js";
import { EventBus } from "./eventBus.js";

export interface DiscordBridgeOptions {
  /** Discord Application Client ID */
  clientId: string;
  /** OAuth2 scopes */
  scopes?: string[];
  /** Token exchange API endpoint (default: /api/token) */
  tokenEndpoint?: string;
  /** Event bus for lifecycle events */
  eventBus?: EventBus;
}

/**
 * DiscordBridge wraps the @discord/embedded-app-sdk for Activities.
 *
 * Usage:
 *   const bridge = new DiscordBridge({ clientId: "..." });
 *   await bridge.init();
 *   console.log(bridge.user); // DiscordUser
 */
export class DiscordBridge {
  public user: DiscordUser | null = null;
  public accessToken: string | null = null;
  public state: ActivityLifecycleState = "initializing";

  private sdk: any = null;
  private auth: any = null;
  private readonly clientId: string;
  private readonly scopes: string[];
  private readonly tokenEndpoint: string;
  private readonly eventBus: EventBus | null;
  private readonly isEmbedded: boolean;

  constructor(options: DiscordBridgeOptions) {
    this.clientId = options.clientId;
    this.scopes = options.scopes ?? ["identify", "rpc.activities.write"];
    this.tokenEndpoint = options.tokenEndpoint ?? "/api/token";
    this.eventBus = options.eventBus ?? null;
    this.isEmbedded =
      typeof window !== "undefined" &&
      window.location.search.includes("frame_id");
  }

  /** Initialize the Discord SDK and authenticate */
  async init(): Promise<void> {
    try {
      this.setState("initializing");

      // Dynamic import to allow server-side usage without the SDK
      const sdkModule = await import("@discord/embedded-app-sdk");
      const { DiscordSDK, DiscordSDKMock } = sdkModule;

      if (this.isEmbedded) {
        this.sdk = new DiscordSDK(this.clientId);
      } else {
        this.sdk = new DiscordSDKMock(
          this.clientId,
          null as any,
          "dev_user_123",
          null as any,
        ) as any;
      }

      await this.sdk.ready();
      this.setState("authenticating");

      // Authorize
      const { code } = await this.sdk.commands.authorize({
        client_id: this.clientId,
        response_type: "code",
        state: "",
        prompt: "none",
        scope: this.scopes,
      });

      // Exchange code for token
      const tokenResponse = await this.exchangeCodeForToken(code);

      if (tokenResponse.access_token) {
        this.accessToken = tokenResponse.access_token;

        // Authenticate SDK
        this.auth = await this.sdk.commands.authenticate({
          access_token: tokenResponse.access_token,
        });

        if (this.auth?.user) {
          this.user = {
            id: this.auth.user.id,
            username: this.auth.user.username,
            discriminator: this.auth.user.discriminator ?? "0",
            avatar: this.auth.user.avatar
              ? `https://cdn.discordapp.com/avatars/${this.auth.user.id}/${this.auth.user.avatar}.png`
              : null,
          };
        }
      } else if (!this.isEmbedded) {
        // Mock mode for local dev
        this.user = {
          id: "dev_user_123",
          username: "DevUser",
          discriminator: "0",
          avatar: null,
        };
        this.accessToken = "mock_local_token";
      } else {
        throw new Error("Failed to obtain access token from backend");
      }

      this.setState("ready");
      console.log("[DiscordBridge] Initialized & Authenticated");
    } catch (error) {
      this.setState("error");
      console.error("[DiscordBridge] Init error:", error);
      throw error;
    }
  }

  /** Set the Discord Activity status */
  async setActivity(
    details: string,
    state: string,
    assets?: {
      largeImage?: string;
      largeText?: string;
    },
  ): Promise<void> {
    if (this.state !== "ready" || !this.sdk) return;
    try {
      await this.sdk.commands.setActivity({
        activity: {
          type: 0,
          details,
          state,
          assets: assets
            ? {
                large_image: assets.largeImage,
                large_text: assets.largeText,
              }
            : undefined,
        },
      });
    } catch (e) {
      console.warn("[DiscordBridge] Failed to set activity:", e);
    }
  }

  /** Get the current channel ID */
  getChannelId(): string | null {
    return this.sdk?.channelId ?? null;
  }

  /** Cleanup */
  async destroy(): Promise<void> {
    this.setState("destroyed");
    this.sdk = null;
    this.auth = null;
    this.user = null;
    this.accessToken = null;
  }

  private setState(newState: ActivityLifecycleState): void {
    this.state = newState;
    this.eventBus?.emit("discord:lifecycle", { state: newState });
  }

  private async exchangeCodeForToken(
    code: string,
  ): Promise<{ access_token?: string }> {
    try {
      const res = await fetch(this.tokenEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) throw new Error("Token exchange failed");
      return await res.json();
    } catch (e) {
      console.error("[DiscordBridge] Token exchange error:", e);
      if (!this.isEmbedded) {
        return { access_token: "mock_local_token" };
      }
      return {};
    }
  }
}
