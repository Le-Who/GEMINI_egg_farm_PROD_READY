/* ═══════════════════════════════════════════════════
 *  Game Hub — Farm Module
 *  Plots, planting, watering, harvesting, seed shop
 *  ─ Skeleton loading, parallel fetch, client seed validation
 * ═══════════════════════════════════════════════════ */

const FarmGame = (() => {
  let state = null;
  let crops = {};
  let pollInterval = null;
  let selectedSeed = null;

  const $ = (id) => document.getElementById(id);

  /* ─── Skeleton Rendering ─── */
  function showSkeleton() {
    const grid = $("farm-plots");
    grid.innerHTML = "";
    for (let i = 0; i < 6; i++) {
      const div = document.createElement("div");
      div.className = "farm-plot skeleton";
      div.innerHTML = `<div class="skeleton-circle"></div><div class="skeleton-line"></div>`;
      grid.appendChild(div);
    }
    const shopGrid = $("farm-shop-grid");
    shopGrid.innerHTML = "";
    for (let i = 0; i < 4; i++) {
      const card = document.createElement("div");
      card.className = "farm-seed-card skeleton";
      card.innerHTML = `&nbsp;<br>&nbsp;`;
      shopGrid.appendChild(card);
    }
  }

  /* ─── Init (parallel loading) ─── */
  async function init() {
    // Show skeleton immediately while data loads
    showSkeleton();

    // Use prefetched crops if available (from shared.js), otherwise fetch
    const cropsPromise = window.__cropsPromise || api("/api/content/crops");
    const statePromise = api("/api/farm/state", {
      userId: HUB.userId,
      username: HUB.username,
    });

    // Load both in parallel
    const [cropsData, stateData] = await Promise.all([
      cropsPromise,
      statePromise,
    ]);

    if (cropsData && !cropsData.error) {
      crops = cropsData;
      // Cache crops in localStorage (they rarely change)
      try {
        localStorage.setItem("hub_crops_cache", JSON.stringify(cropsData));
      } catch (_) {}
    }

    if (stateData && !stateData.error) {
      state = stateData;
      render();
      renderShop();
    } else {
      console.warn("Farm state load failed:", stateData?.error);
    }
  }

  async function loadState() {
    const data = await api("/api/farm/state", {
      userId: HUB.userId,
      username: HUB.username,
    });
    if (data && !data.error) {
      state = data;
      render();
    } else {
      console.warn("Farm state load failed:", data?.error);
    }
  }

  /* ─── Render Plots ─── */
  function render() {
    if (!state) return;
    $("farm-coins").textContent = state.coins;
    $("farm-xp").textContent = state.xp;
    $("farm-level").textContent = `Lv${state.level}`;

    const grid = $("farm-plots");
    grid.innerHTML = "";
    state.plots.forEach((plot, i) => {
      const div = document.createElement("div");
      const pct = plot.growth || 0;
      const isReady = plot.crop && pct >= 1;
      div.className = `farm-plot loaded${plot.crop ? "" : " empty"}${isReady ? " ready" : ""}`;

      if (plot.crop) {
        const cfg = crops[plot.crop] || {};
        div.innerHTML = `
          <div class="crop-emoji">${cfg.emoji || "🌱"}</div>
          <div class="crop-name">${cfg.name || plot.crop}</div>
          <div class="growth-bar"><div class="growth-bar-fill${isReady ? " done" : ""}" style="width:${Math.round(pct * 100)}%"></div></div>
          ${!plot.watered && !isReady ? '<button class="farm-water-btn" title="Water">💧</button>' : ""}
          ${plot.watered ? '<button class="farm-water-btn watered" disabled>💧</button>' : ""}
        `;
        // Bind water button (CSP-safe, no inline onclick)
        const waterBtn = div.querySelector(".farm-water-btn:not([disabled])");
        if (waterBtn && !plot.watered && !isReady) {
          waterBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            FarmGame.water(i);
          });
        }
        if (isReady) {
          div.onclick = () => FarmGame.harvest(i);
          div.title = "Click to harvest!";
        }
      } else {
        div.innerHTML = `<div class="plot-empty-label">Empty Plot</div><div style="font-size:1.4rem;opacity:0.3">🌱</div>`;
        div.onclick = () => FarmGame.plant(i);
        div.title = selectedSeed
          ? `Plant ${selectedSeed}`
          : "Select a seed first";
      }
      grid.appendChild(div);
    });
  }

  /* ─── Seed Shop ─── */
  function renderShop() {
    const grid = $("farm-shop-grid");
    grid.innerHTML = "";
    for (const [id, cfg] of Object.entries(crops)) {
      const count = (state && state.inventory && state.inventory[id]) || 0;
      const card = document.createElement("div");
      const isSelected = selectedSeed === id;
      const isEmpty = count <= 0;
      card.className = `farm-seed-card${isSelected ? " selected" : ""}${isEmpty ? " no-seeds" : ""}`;
      if (isSelected) card.style.borderColor = "#22c55e";
      card.innerHTML = `
        <div class="seed-emoji">${cfg.emoji}</div>
        <div class="seed-name">${cfg.name}</div>
        <div class="seed-price">🪙 ${cfg.seedPrice}</div>
        <div class="seed-count">×${count}</div>
      `;
      card.onclick = () => selectSeed(id);
      // Buy on right-click / long press
      card.oncontextmenu = (e) => {
        e.preventDefault();
        buySeeds(id);
      };
      grid.appendChild(card);
    }
    // Buy button
    $("farm-buy-btn").onclick = () => {
      if (selectedSeed) buySeeds(selectedSeed);
    };
  }

  function selectSeed(id) {
    selectedSeed = id;
    renderShop();
    render();
  }

  /* ─── Actions ─── */
  async function buySeeds(cropId) {
    const data = await api("/api/farm/buy-seeds", {
      userId: HUB.userId,
      cropId,
      amount: 1,
    });
    if (data.success) {
      state.coins = data.coins;
      state.inventory = data.inventory;
      render();
      renderShop();
      const cfg = crops[cropId];
      showToast(`Bought ${cfg.emoji} ${cfg.name} seeds`);
    } else {
      showToast(`❌ ${data.error}`);
    }
  }

  async function plant(plotId) {
    if (!selectedSeed) {
      showToast("Select a seed first!");
      return;
    }
    // Client-side validation: check seed count before API call
    const seedCount = state?.inventory?.[selectedSeed] || 0;
    if (seedCount <= 0) {
      showToast("🌾 No seeds left! Buy more in the shop ↓");
      const shopEl = document.querySelector(".farm-shop");
      if (shopEl) shopEl.scrollIntoView({ behavior: "smooth" });
      // Highlight the seed card briefly
      const cards = document.querySelectorAll(".farm-seed-card");
      cards.forEach((c) => {
        if (
          c.querySelector(".seed-name")?.textContent ===
          crops[selectedSeed]?.name
        ) {
          c.style.animation = "none";
          c.offsetHeight; // trigger reflow
          c.style.animation = "plotGlow 0.8s ease-in-out 2";
        }
      });
      return;
    }
    const data = await api("/api/farm/plant", {
      userId: HUB.userId,
      plotId,
      cropId: selectedSeed,
    });
    if (data.success) {
      state.plots = data.plots;
      state.inventory = data.inventory;
      state.coins = data.coins;
      render();
      renderShop();
    } else {
      // Friendly error messages instead of raw server errors
      const msg =
        data.error === "no seeds"
          ? "🌾 No seeds left! Buy more in the shop ↓"
          : data.error === "plot occupied"
            ? "🚫 This plot is already in use"
            : data.error === "unknown crop"
              ? "❓ Unknown seed type"
              : `❌ ${data.error}`;
      showToast(msg);
    }
  }

  async function water(plotId) {
    const data = await api("/api/farm/water", { userId: HUB.userId, plotId });
    if (data.success) {
      state.plots = data.plots;
      render();
      showToast("💧 Watered!");
    }
  }

  async function harvest(plotId) {
    const data = await api("/api/farm/harvest", { userId: HUB.userId, plotId });
    if (data.success) {
      state.plots = data.plots;
      state.coins = data.coins;
      state.xp = data.xp;
      state.level = data.level;
      render();
      renderShop();
      showToast(
        `${data.reward.crop} +${data.reward.coins}🪙 +${data.reward.xp}XP`,
      );
      if (data.leveledUp) showToast(`🎉 Level Up! Lv${data.level}`);
    }
  }

  /* ─── Growth Polling ─── */
  function onEnter() {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(async () => {
      if (HUB.currentScreen !== 1) {
        clearInterval(pollInterval);
        pollInterval = null;
        return;
      }
      await loadState();
    }, 2000);
  }

  return { init, onEnter, plant, water, harvest, buySeeds, selectSeed };
})();
