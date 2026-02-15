/* ═══════════════════════════════════════════════════
 *  Game Hub — Shared Module (Production-Ready)
 *  Discord SDK auth, API helper, screen navigation
 *  CSP-compliant: no inline handlers, no external fonts
 * ═══════════════════════════════════════════════════ */

const HUB = {
  userId: null,
  username: "Player",
  accessToken: null,
  currentScreen: 1, // 0=Trivia, 1=Farm, 2=Match3
  screenNames: ["trivia", "farm", "match3"],
  initialized: { trivia: false, farm: false, match3: false },
};

/* ─── Discord SDK Init ─── */
async function initDiscord() {
  // Fetch client_id from server config
  let clientId = "";
  try {
    const cfgRes = await fetch("/api/config");
    const cfg = await cfgRes.json();
    clientId = cfg.clientId || "";
    if (!cfg.discordEnabled) {
      console.log("Discord not enabled on server — demo mode");
      throw new Error("demo");
    }
  } catch (e) {
    if (e.message !== "demo") console.warn("Config fetch failed:", e.message);
  }

  // Try Discord Embedded App SDK (only works inside Discord iframe)
  if (clientId && typeof DiscordSDK !== "undefined") {
    try {
      const sdk = new DiscordSDK(clientId);
      await sdk.ready();
      console.log("Discord SDK ready");

      // Authorize and get code
      const { code } = await sdk.commands.authorize({
        client_id: clientId,
        response_type: "code",
        state: "",
        prompt: "none",
        scope: ["identify"],
      });

      // Exchange code for access token via our server
      const tokenRes = await fetch("/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const tokenData = await tokenRes.json();
      if (tokenData.access_token) {
        HUB.accessToken = tokenData.access_token;

        // Fetch user info
        const userRes = await fetch("https://discord.com/api/users/@me", {
          headers: { Authorization: `Bearer ${HUB.accessToken}` },
        });
        const user = await userRes.json();
        HUB.userId = user.id;
        HUB.username = user.global_name || user.username || "Player";

        // Notify SDK we're authenticated
        await sdk.commands.authenticate({ access_token: HUB.accessToken });
        console.log(`Discord auth OK: ${HUB.username} (${HUB.userId})`);
        return;
      }
    } catch (e) {
      console.warn(
        "Discord SDK init failed (expected outside Discord):",
        e.message || e,
      );
    }
  } else if (!clientId) {
    console.log("No client_id configured — running in demo mode");
  } else {
    console.log("DiscordSDK not available — running in demo mode");
  }

  // Fallback: demo mode — random userId
  HUB.userId = "hub_" + Math.random().toString(36).slice(2, 8);
  HUB.username = "Player";
  console.log(`Demo mode: ${HUB.userId}`);
}

/* ─── API Helper (auto-attaches auth) ─── */
async function api(path, body) {
  const headers = { "Content-Type": "application/json" };
  if (HUB.accessToken) {
    headers["Authorization"] = `Bearer ${HUB.accessToken}`;
  }
  const res = await fetch(path, {
    method: body ? "POST" : "GET",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`API ${path} → ${res.status}: ${text}`);
    return { error: `Server error ${res.status}`, _httpStatus: res.status };
  }
  return res.json();
}

/* ─── Navigation ─── */
function navigate(dir) {
  const next = HUB.currentScreen + dir;
  if (next < 0 || next > 2) return;
  HUB.currentScreen = next;
  applyScreenPosition();
  updateNavUI();
  triggerScreenCallbacks();
}

function goToScreen(index) {
  if (index < 0 || index > 2 || index === HUB.currentScreen) return;
  HUB.currentScreen = index;
  applyScreenPosition();
  updateNavUI();
  triggerScreenCallbacks();
}

function applyScreenPosition() {
  const track = document.getElementById("track");
  track.style.transform = `translateX(-${HUB.currentScreen * 100}vw)`;
}

function updateNavUI() {
  const $left = document.getElementById("nav-left");
  const $right = document.getElementById("nav-right");
  $left.classList.toggle("hidden", HUB.currentScreen === 0);
  $right.classList.toggle("hidden", HUB.currentScreen === 2);

  document.querySelectorAll(".nav-dot").forEach((dot, i) => {
    dot.classList.toggle("active", i === HUB.currentScreen);
  });
}

function triggerScreenCallbacks() {
  const name = HUB.screenNames[HUB.currentScreen];
  // Lazy init
  if (!HUB.initialized[name]) {
    HUB.initialized[name] = true;
    if (name === "farm" && typeof FarmGame !== "undefined") FarmGame.init();
    if (name === "trivia" && typeof TriviaGame !== "undefined")
      TriviaGame.init();
    if (name === "match3" && typeof Match3Game !== "undefined")
      Match3Game.init();
  }
  // Screen enter callbacks
  if (name === "farm" && typeof FarmGame !== "undefined") FarmGame.onEnter();
  if (name === "trivia" && typeof TriviaGame !== "undefined")
    TriviaGame.onEnter();
  if (name === "match3" && typeof Match3Game !== "undefined")
    Match3Game.onEnter();
}

/* ─── Toast ─── */
function showToast(msg) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2100);
}

/* ─── Sleep ─── */
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/* ─── Bind Navigation Buttons (CSP-safe, no inline handlers) ─── */
function bindNavigation() {
  // Nav arrows
  document
    .getElementById("nav-left")
    .addEventListener("click", () => navigate(-1));
  document
    .getElementById("nav-right")
    .addEventListener("click", () => navigate(1));

  // Nav dots
  document
    .getElementById("nav-dot-trivia")
    .addEventListener("click", () => goToScreen(0));
  document
    .getElementById("nav-dot-farm")
    .addEventListener("click", () => goToScreen(1));
  document
    .getElementById("nav-dot-match3")
    .addEventListener("click", () => goToScreen(2));

  // Trivia buttons
  document
    .getElementById("btn-trivia-solo")
    ?.addEventListener("click", () => TriviaGame.startSolo());
  document
    .getElementById("btn-trivia-create-duel")
    ?.addEventListener("click", () => TriviaGame.createDuel());
  document
    .getElementById("btn-trivia-join-duel")
    ?.addEventListener("click", () => TriviaGame.showJoinDuel());
  document
    .getElementById("btn-duel-copy-code")
    ?.addEventListener("click", () => TriviaGame.copyInviteCode());
  document
    .getElementById("btn-duel-create-back")
    ?.addEventListener("click", () => TriviaGame.showMenu());
  document
    .getElementById("btn-duel-join-submit")
    ?.addEventListener("click", () => TriviaGame.joinDuel());
  document
    .getElementById("btn-duel-join-back")
    ?.addEventListener("click", () => TriviaGame.showMenu());
  document
    .getElementById("btn-trivia-play-again")
    ?.addEventListener("click", () => TriviaGame.showMenu());

  // Match-3 buttons
  document
    .getElementById("btn-m3-play-again")
    ?.addEventListener("click", () => Match3Game.startGame());
  document
    .getElementById("btn-lb-tab-all")
    ?.addEventListener("click", () => Match3Game.setLbTab("all"));
  document
    .getElementById("btn-lb-tab-room")
    ?.addEventListener("click", () => Match3Game.setLbTab("room"));
}

/* ─── Init on load ─── */
window.addEventListener("DOMContentLoaded", async () => {
  // Bind all navigation buttons (CSP-safe)
  bindNavigation();

  // Initialize Discord auth (or fallback to demo)
  await initDiscord();

  applyScreenPosition();
  updateNavUI();
  // Auto-init the default screen (Farm)
  HUB.initialized.farm = true;
  if (typeof FarmGame !== "undefined") FarmGame.init();
  if (typeof FarmGame !== "undefined") FarmGame.onEnter();

  // Cell size for match-3 based on viewport
  const cellSize = Math.min(48, Math.floor((window.innerWidth - 120) / 8));
  document.documentElement.style.setProperty("--m3-cell", cellSize + "px");
  window.addEventListener("resize", () => {
    const cs = Math.min(48, Math.floor((window.innerWidth - 120) / 8));
    document.documentElement.style.setProperty("--m3-cell", cs + "px");
  });
});
