import { DiscordSDK, DiscordSDKMock } from "@discord/embedded-app-sdk";

// Client ID injected by Vite at build time, or fallback for local dev
const CLIENT_ID =
  (typeof process !== "undefined" && process.env?.DISCORD_CLIENT_ID) ||
  "123456789012345678"; // Replace with your real CLIENT_ID

const isEmbedded = window.location.search.includes("frame_id");

let discordSdk: DiscordSDK;

if (isEmbedded) {
  discordSdk = new DiscordSDK(CLIENT_ID);
} else {
  discordSdk = new DiscordSDKMock(CLIENT_ID, null, "123456");
}

export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  public_flags?: number;
}

class DiscordService {
  private auth: any;
  public user: DiscordUser | null = null;
  public isReady: boolean = false;
  public accessToken: string | null = null;

  async init() {
    if (this.isReady) return;

    await discordSdk.ready();

    // 1. Authorize
    const { code } = await discordSdk.commands.authorize({
      client_id: CLIENT_ID,
      response_type: "code",
      state: "",
      prompt: "none",
      scope: ["identify", "rpc.activities.write", "guilds.members.read"],
    });

    // 2. Exchange Code for Token (via Backend)
    const response = await this.exchangeCodeForToken(code);

    if (response.access_token) {
      this.accessToken = response.access_token;

      // 3. Authenticate SDK
      this.auth = await discordSdk.commands.authenticate({
        access_token: response.access_token,
      });

      if (this.auth) {
        // Get user info directly from our auth context
        this.user = {
          id: this.auth.user.id,
          username: this.auth.user.username,
          discriminator: this.auth.user.discriminator,
          avatar: this.auth.user.avatar
            ? `https://cdn.discordapp.com/avatars/${this.auth.user.id}/${this.auth.user.avatar}.png`
            : null,
        };
      }
    } else {
      throw new Error("Failed to obtain access token from backend");
    }

    this.isReady = true;
    console.log("Discord SDK Initialized & Authenticated");
  }

  // REAL Backend Token Exchange
  private async exchangeCodeForToken(code: string) {
    try {
      const res = await fetch("/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (!res.ok) throw new Error("Backend token exchange failed");
      return await res.json();
    } catch (e) {
      console.error("Token Exchange Error:", e);
      // Fallback for local dev without running backend (Mock Mode)
      if (!isEmbedded) {
        return { access_token: "mock_local_token", expires_in: 99999 };
      }
      return {};
    }
  }

  async setActivity(details: string, state: string) {
    if (!this.isReady) return;
    try {
      await discordSdk.commands.setActivity({
        activity: {
          type: 0,
          details: details,
          state: state,
          assets: {
            large_image: "garden_main",
            large_text: "Tending the garden",
          },
        },
      });
    } catch (e) {
      console.warn("Failed to set activity", e);
    }
  }

  getChannelId() {
    return discordSdk.channelId;
  }
}

export const discordService = new DiscordService();
