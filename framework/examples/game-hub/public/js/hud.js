/* ═══════════════════════════════════════════════════
 *  Game Hub — HUD Module (v1.6)
 *  TopHUD for Energy & Gold display
 *  Registers 'resources' slice in GameStore
 * ═══════════════════════════════════════════════════ */
const HUD = (function () {
  "use strict";

  let regenTimerId = null;

  /* ─── GameStore Slice Registration ─── */
  function registerSlice() {
    if (typeof GameStore !== "undefined") {
      GameStore.registerSlice("resources", {
        gold: 0,
        energy: { current: 0, max: 20, lastRegenTimestamp: Date.now() },
      });
    }
  }

  /* ─── Fetch from server ─── */
  async function fetchResources() {
    try {
      const data = await api("/api/resources/state");
      if (data && data.resources) {
        if (typeof GameStore !== "undefined") {
          GameStore.setState("resources", data.resources);
        }
        updateDisplay(data.resources);
        return data;
      }
    } catch (e) {
      console.warn("HUD: failed to fetch resources", e);
    }
    return null;
  }

  /* ─── Update Display ─── */
  function updateDisplay(res) {
    if (!res) return;
    const energyText = document.getElementById("hud-energy-text");
    const goldText = document.getElementById("hud-gold-text");
    const energyEl = document.querySelector(".hud-energy");
    const barFill = document.getElementById("hud-energy-bar-fill");

    if (energyText) {
      energyText.textContent = `${res.energy.current}/${res.energy.max}`;
    }
    if (goldText) {
      goldText.textContent = formatGold(res.gold);
    }
    if (barFill) {
      const pct = (res.energy.current / res.energy.max) * 100;
      barFill.style.width = `${pct}%`;
    }

    // Low energy warning
    if (energyEl) {
      energyEl.classList.toggle("hud-energy-low", res.energy.current <= 3);
    }

    // Update tooltip
    updateTooltip(res);
  }

  function formatGold(amount) {
    if (amount >= 10000) return (amount / 1000).toFixed(1) + "k";
    return String(amount);
  }

  /* ─── Regen Timer ─── */
  function updateTooltip(res) {
    const tooltip = document.getElementById("hud-energy-tooltip");
    if (!tooltip) return;

    if (res.energy.current >= res.energy.max) {
      tooltip.textContent = "Energy full!";
      return;
    }

    const elapsed = Date.now() - res.energy.lastRegenTimestamp;
    const interval = 5 * 60 * 1000;
    const remaining = interval - (elapsed % interval);
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    tooltip.textContent = `Next +1⚡ in ${mins}:${String(secs).padStart(2, "0")}`;
  }

  function startRegenTimer() {
    stopRegenTimer();
    regenTimerId = setInterval(() => {
      if (typeof GameStore !== "undefined") {
        const res = GameStore.getState("resources");
        if (res) {
          // Local regen tick
          const e = { ...res.energy };
          const now = Date.now();
          const interval = 5 * 60 * 1000;
          if (e.current < e.max) {
            const delta = now - e.lastRegenTimestamp;
            const ticks = Math.floor(delta / interval);
            if (ticks > 0) {
              e.current = Math.min(e.max, e.current + ticks);
              if (e.current < e.max) {
                e.lastRegenTimestamp = now - (delta % interval);
              } else {
                e.lastRegenTimestamp = now;
              }
              GameStore.setState("resources", { ...res, energy: e });
            }
          }
          updateDisplay({ ...res, energy: e });
        }
      }
    }, 1000);
  }

  function stopRegenTimer() {
    if (regenTimerId) {
      clearInterval(regenTimerId);
      regenTimerId = null;
    }
  }

  /* ─── Gold Animation ─── */
  function animateGoldChange(amount) {
    const goldEl = document.querySelector(".hud-gold");
    if (!goldEl) return;

    const float = document.createElement("span");
    float.className = "hud-gold-change" + (amount < 0 ? " negative" : "");
    float.textContent = (amount > 0 ? "+" : "") + amount;
    goldEl.style.position = "relative";
    goldEl.appendChild(float);
    setTimeout(() => float.remove(), 1500);
  }

  /* ─── Energy Check (for gatekeeping) ─── */
  function hasEnergy(amount) {
    if (typeof GameStore !== "undefined") {
      const res = GameStore.getState("resources");
      return res && res.energy.current >= amount;
    }
    return true; // Fallback: allow
  }

  function getGold() {
    if (typeof GameStore !== "undefined") {
      const res = GameStore.getState("resources");
      return res ? res.gold : 0;
    }
    return 0;
  }

  /* ─── Update from server response ─── */
  function syncFromServer(resources) {
    if (!resources) return;
    if (typeof GameStore !== "undefined") {
      GameStore.setState("resources", resources);
    }
    updateDisplay(resources);
  }

  /* ─── Init ─── */
  async function init() {
    registerSlice();
    const data = await fetchResources();
    if (data && data.resources) {
      updateDisplay(data.resources);
    }
    startRegenTimer();

    // Subscribe to store changes
    if (typeof GameStore !== "undefined") {
      GameStore.subscribe("resources", (newState) => {
        updateDisplay(newState);
      });
    }
  }

  return {
    init,
    fetchResources,
    updateDisplay,
    syncFromServer,
    hasEnergy,
    getGold,
    animateGoldChange,
    startRegenTimer,
    stopRegenTimer,
  };
})();
