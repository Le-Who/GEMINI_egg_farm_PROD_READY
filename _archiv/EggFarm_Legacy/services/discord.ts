// DiscordSDKMock is intentionally kept — used for local dev outside Discord iframe
import { DiscordSDK, DiscordSDKMock } from "@discord/embedded-app-sdk";

const isEmbedded = window.location.search.includes("frame_id");

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
  private sdk: DiscordSDK | DiscordSDKMock | null = null;

  async init() {
    if (this.isReady) return;

    // 1. Fetch Client ID Config
    let clientId = "";
    try {
      const res = await fetch("/api/config/discord");
      if (res.ok) {
        const data = await res.json();
        clientId = data.clientId;
      }
    } catch (e) {
      console.warn("Failed to fetch Discord config:", e);
    }

    // Fallback if fetch fails (e.g. local dev without server or different port)
    if (!clientId) {
      console.warn("No Client ID found from server, using fallback/mock.");
      clientId = "1471622547983306833";
    }

    // 2. Initialize SDK
    if (isEmbedded) {
      this.sdk = new DiscordSDK(clientId);
    } else {
      this.sdk = new DiscordSDKMock(clientId, null, "123456", null) as any;
    }

    await this.sdk!.ready();

    // 3. Authorize
    const { code } = await this.sdk!.commands.authorize({
      client_id: clientId,
      response_type: "code",
      state: "",
      prompt: "none",
      scope: ["identify", "rpc.activities.write", "guilds.members.read"],
    });

    // 4. Exchange Code for Token (via Backend)
    const response = await this.exchangeCodeForToken(code);

    if (response.access_token) {
      this.accessToken = response.access_token;

      // 5. Authenticate SDK
      this.auth = await this.sdk!.commands.authenticate({
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
    if (!this.isReady || !this.sdk) return;
    try {
      await this.sdk.commands.setActivity({
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
    if (!this.sdk) return null;
    return this.sdk.channelId;
  }
}

export const discordService = new DiscordService();
