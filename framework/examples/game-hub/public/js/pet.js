/* ═══════════════════════════════════════════════════
 *  Game Hub — Pet Module (v1.6)
 *  Living Pet Entity with state machine & interactions
 * ═══════════════════════════════════════════════════ */
const PetCompanion = (function () {
  "use strict";

  const STATES = {
    IDLE: "idle",
    ROAM: "roam",
    SLEEP: "sleep",
    HAPPY: "happy",
    DIZZY: "dizzy",
  };
  const SKINS = {
    basic_dog: "🐕",
    basic_cat: "🐱",
    basic_bunny: "🐰",
  };

  let currentState = STATES.IDLE;
  let petData = null;
  let clickCount = 0;
  let clickResetTimer = null;
  let stateTimer = null;
  let inactivityTimer = null;
  let panelOpen = false;
  let dockMode = "ground"; // "ground" (Farm) | "perch" (Match3/Trivia)

  /* ─── GameStore Slice ─── */
  function registerSlice() {
    if (typeof GameStore !== "undefined") {
      GameStore.registerSlice("pet", {
        name: "Buddy",
        level: 1,
        xp: 0,
        xpToNextLevel: 100,
        skinId: "basic_dog",
        stats: { happiness: 100 },
        abilities: { autoHarvest: false, autoWater: false },
      });
    }
  }

  /* ─── Init ─── */
  async function init() {
    registerSlice();
    const container = document.getElementById("pet-container");
    const sprite = document.getElementById("pet-sprite");
    if (!container || !sprite) return;

    // Fetch pet data (included in resources/state)
    try {
      const data = await api("/api/resources/state");
      if (data && data.pet) {
        petData = data.pet;
        if (typeof GameStore !== "undefined") {
          GameStore.setState("pet", data.pet);
        }
        sprite.textContent = SKINS[data.pet.skinId] || SKINS.basic_dog;
      }
    } catch (e) {
      console.warn("Pet: failed to fetch state", e);
    }

    // Click handler
    container.addEventListener("click", onPetClick);
    container.addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault();
        onPetClick();
      },
      { passive: false },
    );

    // Start state machine
    setState(STATES.IDLE);
    scheduleNextState();
    resetInactivityTimer();

    // Subscribe to store
    if (typeof GameStore !== "undefined") {
      GameStore.subscribe("pet", (newState) => {
        petData = newState;
        if (panelOpen) renderInfoPanel();
      });
    }

    // Start auto-water butler ability
    startAutoWater();

    // Click-outside to close info panel (Fix 3)
    document.addEventListener("click", (e) => {
      if (!panelOpen) return;
      const panel = document.getElementById("pet-info-panel");
      const petContainer = document.getElementById("pet-container");
      if (!panel) return;
      // Close if click is outside both the panel and the pet itself
      if (!panel.contains(e.target) && !petContainer?.contains(e.target)) {
        panelOpen = false;
        panel.style.display = "none";
      }
    });
  }

  /* ─── State Machine ─── */
  function setState(newState) {
    currentState = newState;
    const container = document.getElementById("pet-container");
    if (container) {
      container.setAttribute("data-state", newState);
    }

    // Sleep overlay
    const heartsEl = document.getElementById("pet-hearts");
    if (heartsEl) {
      // Remove old zzz
      heartsEl.querySelectorAll(".pet-zzz").forEach((el) => el.remove());
      if (newState === STATES.SLEEP) {
        const zzz = document.createElement("span");
        zzz.className = "pet-zzz";
        zzz.textContent = "💤";
        heartsEl.appendChild(zzz);
      }
    }
  }

  function scheduleNextState() {
    if (stateTimer) clearTimeout(stateTimer);
    const delay = 5000 + Math.random() * 8000; // 5-13s
    stateTimer = setTimeout(() => {
      if (currentState === STATES.HAPPY || currentState === STATES.DIZZY) {
        // Don't interrupt reaction states
        scheduleNextState();
        return;
      }
      if (currentState === STATES.SLEEP) {
        // Stay asleep until interaction
        return;
      }

      // Pick next state: 45% idle, 55% roam (only in ground mode)
      const roll = Math.random();
      if (roll < 0.45 || dockMode === "perch") {
        setState(STATES.IDLE);
      } else {
        setState(STATES.ROAM);
        roamToRandomPosition();
      }
      scheduleNextState();
    }, delay);
  }

  function roamToRandomPosition() {
    const container = document.getElementById("pet-container");
    const overlay = document.getElementById("pet-overlay");
    if (!container || !overlay) return;

    // Don't roam in perch mode — pet sits still
    if (dockMode === "perch") {
      setState(STATES.IDLE);
      return;
    }

    // Use window width for full-screen roaming with edge padding
    const padding = 40;
    const maxX = window.innerWidth - padding;
    const newX = padding + Math.random() * (maxX - padding * 2);

    // Determine direction from current position
    const computedStyle = getComputedStyle(container);
    const matrix = new DOMMatrix(computedStyle.transform);
    const currentX = matrix.m41;

    // Set direction for walk animation
    container.style.setProperty("--pet-dir", newX > currentX ? "1" : "-1");
    container.style.transform = `translate3d(${newX}px, 0, 0) translateX(-50%)`;

    // Return to idle after reaching destination
    setTimeout(() => {
      if (currentState === STATES.ROAM) {
        setState(STATES.IDLE);
      }
    }, 3000);
  }

  /* ─── Pet Action Bubble ─── */
  function showBubble(text) {
    const container = document.getElementById("pet-container");
    if (!container) return;
    // Remove any existing bubble
    const old = container.querySelector(".pet-bubble");
    if (old) old.remove();
    const bubble = document.createElement("div");
    bubble.className = "pet-bubble";
    bubble.textContent = text;
    container.appendChild(bubble);
    setTimeout(() => bubble.remove(), 2500);
  }

  /* ─── Auto-Water (Butler ability, level ≥ 3) ─── */
  let autoWaterTimer = null;
  function startAutoWater() {
    if (autoWaterTimer) clearInterval(autoWaterTimer);
    autoWaterTimer = setInterval(() => {
      if (!petData || petData.level < 3) return;
      if (currentState === STATES.SLEEP) return;
      // Check for crops needing water via GameStore
      if (typeof GameStore === "undefined") return;
      const farmState = GameStore.getState("farm");
      if (!farmState || !farmState.plots) return;
      const plotIndex = farmState.plots.findIndex((p) => p.crop && !p.watered);
      if (plotIndex === -1) return;
      // Auto-water via FarmGame
      if (typeof FarmGame !== "undefined" && FarmGame.water) {
        FarmGame.water(plotIndex);
        showBubble("💧 Watered!");
        setState(STATES.HAPPY);
        spawnHeart();
        setTimeout(() => setState(STATES.IDLE), 1200);
      }
    }, 30000); // Every 30s
  }

  /* ─── Inactivity → Sleep ─── */
  function resetInactivityTimer() {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
      if (currentState !== STATES.HAPPY && currentState !== STATES.DIZZY) {
        setState(STATES.SLEEP);
      }
    }, 30000); // 30s
  }

  /* ─── Click Interaction ─── */
  function onPetClick() {
    resetInactivityTimer();

    // Wake up from sleep
    if (currentState === STATES.SLEEP) {
      setState(STATES.IDLE);
      scheduleNextState();
      spawnHeart();
      return;
    }

    clickCount++;
    if (clickResetTimer) clearTimeout(clickResetTimer);
    clickResetTimer = setTimeout(() => {
      clickCount = 0;
    }, 2000);

    if (clickCount >= 5) {
      // Easter egg: dizzy
      setState(STATES.DIZZY);
      clickCount = 0;
      setTimeout(() => {
        setState(STATES.IDLE);
        scheduleNextState();
      }, 2000);
    } else {
      setState(STATES.HAPPY);
      spawnHeart();
      setTimeout(() => {
        setState(STATES.IDLE);
      }, 1200);
    }

    // Toggle info panel on double-tap
    if (clickCount === 2) {
      toggleInfoPanel();
    }
  }

  function spawnHeart() {
    const heartsEl = document.getElementById("pet-hearts");
    if (!heartsEl) return;

    const heart = document.createElement("span");
    heart.className = "pet-heart";
    const emojis = ["❤️", "💕", "✨", "⭐"];
    heart.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    heart.style.setProperty("--hx", Math.random() * 30 - 15 + "px");
    heartsEl.appendChild(heart);
    setTimeout(() => heart.remove(), 1200);
  }

  /* ─── Info Panel ─── */
  function toggleInfoPanel() {
    panelOpen = !panelOpen;
    const panel = document.getElementById("pet-info-panel");
    if (panel) {
      panel.style.display = panelOpen ? "block" : "none";
      if (panelOpen) renderInfoPanel();
    }
  }

  function renderInfoPanel() {
    const panel = document.getElementById("pet-info-panel");
    if (!panel || !petData) return;

    const xpPct = ((petData.xp / petData.xpToNextLevel) * 100).toFixed(1);

    // Get available crops for feeding
    let feedOptions = "";
    const harvested =
      typeof GameStore !== "undefined"
        ? GameStore.getState("resources")?.__harvested || {}
        : {};

    panel.innerHTML = `
      <button class="pet-info-close" id="pet-info-close">✕</button>
      <div class="pet-info-header">
        <span class="pet-info-name">${SKINS[petData.skinId] || "🐕"} ${petData.name}</span>
        <span class="pet-info-level">Lv ${petData.level}</span>
      </div>
      <div class="pet-info-xp-bar">
        <div class="pet-info-xp-fill" style="width: ${xpPct}%"></div>
      </div>
      <div class="pet-info-xp-text">${petData.xp} / ${petData.xpToNextLevel} XP</div>
      <div class="pet-info-abilities">
        <span class="pet-ability ${petData.abilities.autoHarvest ? "unlocked" : ""}">
          ${petData.abilities.autoHarvest ? "✅" : "🔒"} Auto-Harvest (Lv 3)
        </span>
        <span class="pet-ability ${petData.abilities.autoWater ? "unlocked" : ""}">
          ${petData.abilities.autoWater ? "✅" : "🔒"} Auto-Water (Lv 5)
        </span>
      </div>
      <div class="pet-feed-section" id="pet-feed-section"></div>
    `;

    // Setup close button
    const closeBtn = document.getElementById("pet-info-close");
    if (closeBtn) {
      closeBtn.onclick = () => toggleInfoPanel();
    }

    // Render feed buttons
    renderFeedButtons();
  }

  async function renderFeedButtons() {
    const section = document.getElementById("pet-feed-section");
    if (!section) return;

    // Fetch current harvested crops
    try {
      const data = await api("/api/resources/state");
      if (data && data.harvested) {
        const crops = Object.entries(data.harvested).filter(
          ([, qty]) => qty > 0,
        );
        if (crops.length === 0) {
          section.innerHTML = `<div style="text-align:center;color:#666;font-size:0.75rem;">
            No harvested crops to feed 🌾<br>Visit the farm to harvest!
          </div>`;
          return;
        }

        section.innerHTML = crops
          .map(
            ([cropId, qty]) => `
            <button class="pet-feed-btn" data-crop="${cropId}">
              🍽️ Feed ${cropId} (${qty}) → +2⚡ +10XP
            </button>
          `,
          )
          .join("");

        section.querySelectorAll(".pet-feed-btn").forEach((btn) => {
          btn.onclick = () => feedPet(btn.getAttribute("data-crop"));
        });
      }
    } catch (e) {
      section.innerHTML = `<div style="color:#666;font-size:0.75rem;">Unable to load crops</div>`;
    }
  }

  /* ─── Feed Pet ─── */
  async function feedPet(cropId) {
    // Optimistic update: show happy reaction immediately
    const petSnapshot = petData ? { ...petData } : null;
    const prevState = currentState;
    setState(STATES.HAPPY);
    spawnHeart();
    spawnHeart();

    // Optimistic food list update: decrement locally and re-render buttons
    if (typeof GameStore !== "undefined") {
      const rState = GameStore.getState("resources");
      if (rState?.__harvested?.[cropId]) {
        rState.__harvested[cropId]--;
        if (rState.__harvested[cropId] <= 0) delete rState.__harvested[cropId];
        if (panelOpen) renderFeedButtons();
      }
    }

    try {
      const data = await api("/api/pet/feed", {
        cropId,
        userId: HUB.userId,
      });

      if (data && data.success) {
        // Update pet state from server
        if (data.pet) {
          petData = data.pet;
          if (typeof GameStore !== "undefined") {
            GameStore.setState("pet", data.pet);
          }
        }

        // Update resources via HUD
        if (data.resources && typeof HUD !== "undefined") {
          HUD.syncFromServer(data.resources);
        }

        setTimeout(() => setState(STATES.IDLE), 1200);

        // Show toast
        if (typeof showToast === "function") {
          const msg = data.leveledUp
            ? `🎉 ${petData.name} leveled up to Lv ${petData.level}!`
            : `🍽️ Fed ${petData.name}! +2⚡ +10XP`;
          showToast(msg);
        }

        // Re-render panel if open
        if (panelOpen) renderInfoPanel();
      } else {
        // Rollback
        if (petSnapshot) {
          petData = petSnapshot;
          if (typeof GameStore !== "undefined") {
            GameStore.setState("pet", petSnapshot);
          }
        }
        setState(prevState);
        if (data && data.error && typeof showToast === "function") {
          showToast("❌ " + data.error);
        }
      }
    } catch (e) {
      // Rollback on network error
      if (petSnapshot) {
        petData = petSnapshot;
        if (typeof GameStore !== "undefined") {
          GameStore.setState("pet", petSnapshot);
        }
      }
      setState(prevState);
      console.error("Pet feed error:", e);
      if (typeof showToast === "function") {
        showToast("❌ Failed to feed pet");
      }
    }
  }

  /* ─── Sync from server data ─── */
  function syncFromServer(pet) {
    if (!pet) return;
    petData = pet;
    if (typeof GameStore !== "undefined") {
      GameStore.setState("pet", pet);
    }
    const sprite = document.getElementById("pet-sprite");
    if (sprite) {
      sprite.textContent = SKINS[pet.skinId] || SKINS.basic_dog;
    }
  }

  /* ─── Smart Docking ─── */
  function setDockMode(mode) {
    dockMode = mode;
    if (mode === "perch") {
      // Cancel roaming, force idle
      if (currentState === STATES.ROAM) {
        setState(STATES.IDLE);
      }
    }
  }

  return {
    init,
    syncFromServer,
    feedPet,
    toggleInfoPanel,
    setDockMode,
  };
})();
