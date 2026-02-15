/* ═══════════════════════════════════════════════════
 *  Game Hub — Farm Module
 *  Plots, planting, watering, harvesting, seed shop
 * ═══════════════════════════════════════════════════ */

const FarmGame = (() => {
  let state = null;
  let crops = {};
  let pollInterval = null;
  let selectedSeed = null;

  const $ = (id) => document.getElementById(id);

  /* ─── Init ─── */
  async function init() {
    crops = await api("/api/content/crops");
    await loadState();
    renderShop();
  }

  async function loadState() {
    const data = await api("/api/farm/state", {
      userId: HUB.userId,
      username: HUB.username,
    });
    state = data;
    render();
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
      div.className = `farm-plot${plot.crop ? "" : " empty"}${isReady ? " ready" : ""}`;

      if (plot.crop) {
        const cfg = crops[plot.crop] || {};
        div.innerHTML = `
          <div class="crop-emoji">${cfg.emoji || "🌱"}</div>
          <div class="crop-name">${cfg.name || plot.crop}</div>
          <div class="growth-bar"><div class="growth-bar-fill${isReady ? " done" : ""}" style="width:${Math.round(pct * 100)}%"></div></div>
          ${!plot.watered && !isReady ? `<button class="farm-water-btn" onclick="FarmGame.water(${i})" title="Water">💧</button>` : ""}
          ${plot.watered ? '<button class="farm-water-btn watered" disabled>💧</button>' : ""}
        `;
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
      card.className = `farm-seed-card${selectedSeed === id ? " selected" : ""}`;
      if (selectedSeed === id) card.style.borderColor = "#22c55e";
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
      showToast(`❌ ${data.error}`);
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
