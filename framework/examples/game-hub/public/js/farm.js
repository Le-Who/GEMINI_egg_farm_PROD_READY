/* ═══════════════════════════════════════════════════
 *  Game Hub — Farm Module  (v1.3)
 *  Plots, planting, watering, harvesting, seed shop
 *  ─ Local growth timer, diff-update fix, farm badge
 *  ─ Diff-update plots (no blink), horizontal buy bar, plot dispatcher
 * ═══════════════════════════════════════════════════ */

const FarmGame = (() => {
  let state = null;
  let crops = {};
  let selectedSeed = null;
  let firstRenderDone = false;
  let buyQty = 1;

  const $ = (id) => document.getElementById(id);

  /* ─── Skeleton Rendering ─── */
  function showSkeleton() {
    firstRenderDone = false;
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
    showSkeleton();

    const cropsPromise = window.__cropsPromise || api("/api/content/crops");
    const statePromise = api("/api/farm/state", {
      userId: HUB.userId,
      username: HUB.username,
    });

    const [cropsData, stateData] = await Promise.all([
      cropsPromise,
      statePromise,
    ]);

    if (cropsData && !cropsData.error) {
      crops = cropsData;
      try {
        localStorage.setItem("hub_crops_cache", JSON.stringify(cropsData));
      } catch (_) {}
    }

    if (stateData && !stateData.error) {
      state = stateData;
      render();
      renderShop();
      updateBuyBar();
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
    }
  }

  /* ─── Plot Click Dispatcher ─── */
  function onPlotClick(i) {
    const plot = state?.plots?.[i];
    if (!plot) return;
    const pct = getLocalGrowth(plot);
    const isReady = plot.crop && pct >= 1;

    if (isReady) {
      // Always harvest ready plots, regardless of seed selection
      harvest(i);
    } else if (plot.crop) {
      // Growing plot — no-op, show tooltip
      showToast("🌱 Still growing...");
    } else {
      // Empty plot — plant if seed selected
      plant(i);
    }
  }

  /* ─── Render Plots (diff-update to avoid blinking) ─── */
  function render() {
    if (!state) return;
    $("farm-coins").textContent = state.coins;
    $("farm-xp").textContent = state.xp;
    $("farm-level").textContent = `Lv${state.level}`;

    const grid = $("farm-plots");
    const existing = grid.querySelectorAll(".farm-plot:not(.skeleton)");
    const isFirstRender = !firstRenderDone;

    if (existing.length === state.plots.length && !isFirstRender) {
      // Diff-update: only rebuild changed plots
      state.plots.forEach((plot, i) => {
        const div = existing[i];
        const pct = getLocalGrowth(plot);
        const isReady = plot.crop && pct >= 1;
        const currentCrop = div.dataset.crop || "";
        const currentWatered = div.dataset.watered === "true";
        const structureChanged = currentCrop !== (plot.crop || "");
        const wateredChanged = !!plot.watered !== currentWatered;

        if (structureChanged || wateredChanged) {
          rebuildPlot(div, plot, i, pct, isReady, false);
        } else if (plot.crop) {
          // Update growth bar width + button state
          const fill = div.querySelector(".growth-bar-fill");
          if (fill) {
            fill.style.width = Math.round(pct * 100) + "%";
            fill.classList.toggle("done", isReady);
          }
          const waterBtn = div.querySelector(".farm-water-btn");
          if (waterBtn && isReady) waterBtn.remove();
        }
        // Always update classes and onclick via dispatcher
        div.className = `farm-plot${plot.crop ? "" : " empty"}${isReady ? " ready" : ""}`;
        div.onclick = () => onPlotClick(i);
      });
    } else {
      // Full rebuild (first render)
      grid.innerHTML = "";
      state.plots.forEach((plot, i) => {
        const div = document.createElement("div");
        const pct = getLocalGrowth(plot);
        const isReady = plot.crop && pct >= 1;
        rebuildPlot(div, plot, i, pct, isReady, isFirstRender);
        grid.appendChild(div);
      });
      firstRenderDone = true;
    }
  }

  function rebuildPlot(div, plot, i, pct, isReady, animate) {
    div.dataset.crop = plot.crop || "";
    div.dataset.watered = plot.watered ? "true" : "false";
    div.className = `farm-plot${animate ? " first-load" : ""}${plot.crop ? "" : " empty"}${isReady ? " ready" : ""}`;
    // Always use dispatcher
    div.onclick = () => onPlotClick(i);

    if (plot.crop) {
      const cfg = crops[plot.crop] || {};
      div.innerHTML = `
        <div class="crop-emoji">${cfg.emoji || "🌱"}</div>
        <div class="crop-name">${cfg.name || plot.crop}</div>
        <div class="growth-bar"><div class="growth-bar-fill${isReady ? " done" : ""}" style="width:${Math.round(pct * 100)}%"></div></div>
        ${!plot.watered && !isReady ? '<button class="farm-water-btn" title="Water">💧</button>' : ""}
        ${plot.watered ? '<button class="farm-water-btn watered" disabled>💧</button>' : ""}
      `;
      const waterBtn = div.querySelector(".farm-water-btn:not([disabled])");
      if (waterBtn && !plot.watered && !isReady) {
        waterBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          FarmGame.water(i);
        });
      }
      div.title = isReady ? "Click to harvest!" : "Growing...";
    } else {
      div.innerHTML = `<div class="plot-empty-label">Empty Plot</div><div style="font-size:1.4rem;opacity:0.3">🌱</div>`;
      div.title = selectedSeed
        ? `Plant ${crops[selectedSeed]?.name || selectedSeed}`
        : "Select a seed first";
    }
  }

  /* ─── Seed Shop Grid ─── */
  function renderShop() {
    const grid = $("farm-shop-grid");
    grid.innerHTML = "";
    for (const [id, cfg] of Object.entries(crops)) {
      const count = state?.inventory?.[id] || 0;
      const card = document.createElement("div");
      const isSelected = selectedSeed === id;
      const isEmpty = count <= 0;
      card.className = `farm-seed-card${isSelected ? " selected" : ""}${isEmpty ? " no-seeds" : ""}`;
      card.innerHTML = `
        <div class="seed-emoji">${cfg.emoji}</div>
        <div class="seed-name">${cfg.name}</div>
        <div class="seed-price">🪙 ${cfg.seedPrice}</div>
        <div class="seed-count">×${count}</div>
      `;
      card.onclick = () => selectSeed(id);
      grid.appendChild(card);
    }
  }

  function selectSeed(id) {
    // Toggle: clicking same seed deselects it
    if (selectedSeed === id) {
      selectedSeed = null;
      buyQty = 1;
    } else {
      selectedSeed = id;
      buyQty = 1;
    }
    renderShop();
    updateBuyBar();
    render(); // Re-render plots to update titles
  }

  /* ─── Horizontal Buy Bar ─── */
  function updateBuyBar() {
    const bar = $("farm-buy-bar");
    if (!bar) return;

    if (!selectedSeed || !crops[selectedSeed]) {
      bar.style.display = "none";
      return;
    }

    bar.style.display = "";
    const cfg = crops[selectedSeed];
    const totalCost = cfg.seedPrice * buyQty;
    const canAfford = state && state.coins >= totalCost;

    bar.innerHTML = `
      <span class="buy-bar-seed">${cfg.emoji} ${cfg.name}</span>
      <span class="buy-bar-stepper">
        <button id="buy-qty-minus">−</button>
        <span class="qty-display" id="buy-qty-val">${buyQty}</span>
        <button id="buy-qty-plus">+</button>
      </span>
      <span class="buy-bar-total">🪙 ${totalCost}</span>
      <button class="buy-bar-btn${canAfford ? "" : " disabled"}" id="buy-bar-go">${canAfford ? "Buy" : "💰?"}</button>
    `;

    $("buy-qty-minus").onclick = () => {
      if (buyQty > 1) {
        buyQty--;
        updateBuyBar();
      }
    };
    $("buy-qty-plus").onclick = () => {
      if (buyQty < 99) {
        buyQty++;
        updateBuyBar();
      }
    };
    $("buy-bar-go").onclick = () => {
      if (canAfford) buySeeds(selectedSeed);
    };
  }

  /* ─── Actions ─── */
  async function buySeeds(cropId) {
    const cfg = crops[cropId];
    if (!cfg) return;
    const totalCost = cfg.seedPrice * buyQty;
    if (state.coins < totalCost) {
      showToast("❌ Not enough coins!");
      return;
    }
    const data = await api("/api/farm/buy-seeds", {
      userId: HUB.userId,
      cropId,
      amount: buyQty,
    });
    if (data.success) {
      state.coins = data.coins;
      state.inventory = data.inventory;
      render();
      renderShop();
      showToast(`Bought ${buyQty}× ${cfg.emoji} ${cfg.name} seeds`);
      buyQty = 1;
      updateBuyBar();
    } else {
      showToast(`❌ ${data.error}`);
    }
  }

  async function plant(plotId) {
    if (!selectedSeed) {
      showToast("Select a seed first!");
      return;
    }
    const seedCount = state?.inventory?.[selectedSeed] || 0;
    if (seedCount <= 0) {
      showToast("🌾 No seeds left! Buy more in the shop ↓");
      const shopEl = document.querySelector(".farm-shop");
      if (shopEl) shopEl.scrollIntoView({ behavior: "smooth" });
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
      updateBuyBar();
    } else {
      const msg =
        data.error === "no seeds"
          ? "🌾 No seeds left! Buy more in the shop ↓"
          : data.error === "plot occupied"
            ? "🚫 This plot is already in use"
            : `❌ ${data.error}`;
      showToast(msg);
    }
  }

  async function water(plotId) {
    const data = await api("/api/farm/water", { userId: HUB.userId, plotId });
    if (data.success) {
      state.plots = data.plots;
      render();
      // Splash animation on the water button
      const btn = document.querySelectorAll(".farm-water-btn")[plotId];
      if (btn) btn.classList.add("water-splash");
      // Calculate watering bonus percentage for toast
      const plot = state.plots[plotId];
      const mult = plot?.wateringMultiplier;
      const bonusPct = mult ? Math.round((1 - mult) * 100) : 30;
      showToast(`💧 Watered! Growth +${bonusPct}% faster`);
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
      updateBuyBar();
      showToast(
        `${data.reward.crop} +${data.reward.coins}🪙 +${data.reward.xp}XP`,
      );
      if (data.leveledUp) showToast(`🎉 Level Up! Lv${data.level}`);
    }
  }

  /* ─── Local Growth Computation (Issue 5) ─── */
  function getLocalGrowth(plot) {
    if (!plot.crop || !plot.plantedAt) return 0;
    const elapsed = Date.now() - plot.plantedAt;
    const mult = plot.watered ? plot.wateringMultiplier || 0.7 : 1;
    const gt = plot.growthTime || 15000;
    return Math.min(1, elapsed / (gt * mult));
  }

  /* ─── Local Growth Tick (replaces 2s polling) ─── */
  let growthTickId = null;
  let syncInterval = null;

  function startLocalGrowthTick() {
    stopLocalGrowthTick();
    growthTickId = setInterval(() => {
      if (!state?.plots) return;
      render(); // re-render with locally computed growth
      updateFarmBadge();
    }, 500);
    // Lazy server sync every 30s for drift correction
    syncInterval = setInterval(async () => {
      if (HUB.userId) await loadState();
    }, 30000);
  }

  function stopLocalGrowthTick() {
    if (growthTickId) {
      clearInterval(growthTickId);
      growthTickId = null;
    }
    if (syncInterval) {
      clearInterval(syncInterval);
      syncInterval = null;
    }
  }

  /* ─── Farm Badge Notification (Issue 7) ─── */
  function updateFarmBadge() {
    if (!state?.plots) return;
    const readyCount = state.plots.filter(
      (p) => p.crop && getLocalGrowth(p) >= 1,
    ).length;
    const dot = document.querySelectorAll(".nav-dot")[1]; // farm is center dot
    const badge = document.getElementById("farm-ready-badge");
    if (dot) {
      dot.classList.toggle(
        "has-notification",
        readyCount > 0 && HUB.currentScreen !== 1,
      );
    }
    if (badge) {
      if (readyCount > 0 && HUB.currentScreen !== 1) {
        badge.textContent = `🌾 ×${readyCount}`;
        badge.classList.add("show");
        badge.onclick = () => {
          if (typeof goToScreen === "function") goToScreen(1);
        };
      } else {
        badge.classList.remove("show");
      }
    }
  }

  /* ─── Screen Enter/Exit ─── */
  function onEnter() {
    // Sync with server on enter, then rely on local timer
    loadState();
    startLocalGrowthTick();
  }

  return {
    init,
    onEnter,
    plant,
    water,
    harvest,
    buySeeds,
    selectSeed,
    updateFarmBadge,
    getLocalGrowth,
  };
})();
