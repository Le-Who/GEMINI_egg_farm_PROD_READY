/* ═══════════════════════════════════════════════════
 *  Game Hub — Farm Module  (v1.2)
 *  Plots, planting, watering, harvesting, seed shop
 *  ─ Skeleton loading, parallel fetch, client seed validation
 *  ─ Diff-update plots (no blink), qty-stepper buy panel
 * ═══════════════════════════════════════════════════ */

const FarmGame = (() => {
  let state = null;
  let crops = {};
  let pollInterval = null;
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

  /* ─── Render Plots (diff-update to avoid blinking) ─── */
  function render() {
    if (!state) return;
    $("farm-coins").textContent = state.coins;
    $("farm-xp").textContent = state.xp;
    $("farm-level").textContent = `Lv${state.level}`;

    const grid = $("farm-plots");
    const existing = grid.querySelectorAll(".farm-plot:not(.skeleton)");
    const isFirstRender = !firstRenderDone;

    // If structure hasn't changed (same number of plots), diff-update
    if (existing.length === state.plots.length && !isFirstRender) {
      state.plots.forEach((plot, i) => {
        const div = existing[i];
        const pct = plot.growth || 0;
        const isReady = plot.crop && pct >= 1;
        const currentCrop = div.dataset.crop || "";
        const structureChanged = currentCrop !== (plot.crop || "");

        if (structureChanged) {
          // Full rebuild of this one plot
          rebuildPlot(div, plot, i, pct, isReady, false);
        } else if (plot.crop) {
          // Just update growth bar + button state
          const fill = div.querySelector(".growth-bar-fill");
          if (fill) {
            fill.style.width = Math.round(pct * 100) + "%";
            fill.classList.toggle("done", isReady);
          }
          // Update water button visibility
          const waterBtn = div.querySelector(".farm-water-btn");
          if (waterBtn && isReady) waterBtn.remove();
        }
        // Update classes
        div.className = `farm-plot${plot.crop ? "" : " empty"}${isReady ? " ready" : ""}`;
      });
    } else {
      // Full rebuild (first render or structure change)
      grid.innerHTML = "";
      state.plots.forEach((plot, i) => {
        const div = document.createElement("div");
        const pct = plot.growth || 0;
        const isReady = plot.crop && pct >= 1;
        rebuildPlot(div, plot, i, pct, isReady, isFirstRender);
        grid.appendChild(div);
      });
      firstRenderDone = true;
    }
  }

  function rebuildPlot(div, plot, i, pct, isReady, animate) {
    div.dataset.crop = plot.crop || "";
    div.className = `farm-plot${animate ? " first-load" : ""}${plot.crop ? "" : " empty"}${isReady ? " ready" : ""}`;

    if (plot.crop) {
      const cfg = crops[plot.crop] || {};
      div.innerHTML = `
        <div class="crop-emoji">${cfg.emoji || "🌱"}</div>
        <div class="crop-name">${cfg.name || plot.crop}</div>
        <div class="growth-bar"><div class="growth-bar-fill${isReady ? " done" : ""}" style="width:${Math.round(pct * 100)}%"></div></div>
        ${!plot.watered && !isReady ? '<button class="farm-water-btn" title="Water">💧</button>' : ""}
        ${plot.watered ? '<button class="farm-water-btn watered" disabled>💧</button>' : ""}
      `;
      // Bind water button
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
  }

  /* ─── Seed Shop (with qty panel) ─── */
  function renderShop() {
    const grid = $("farm-shop-grid");
    grid.innerHTML = "";
    for (const [id, cfg] of Object.entries(crops)) {
      const count = (state && state.inventory && state.inventory[id]) || 0;
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
    // Update buy panel
    updateBuyPanel();
  }

  function selectSeed(id) {
    selectedSeed = id;
    buyQty = 1;
    renderShop();
    render();
  }

  function updateBuyPanel() {
    const panel = $("farm-buy-panel");
    const preview = $("buy-panel-preview");
    if (!selectedSeed || !crops[selectedSeed]) {
      panel.classList.remove("active");
      preview.innerHTML = `<span class="buy-panel-hint">← Select a seed</span>`;
      return;
    }

    panel.classList.add("active");
    const cfg = crops[selectedSeed];
    const totalCost = cfg.seedPrice * buyQty;
    const canAfford = state && state.coins >= totalCost;

    preview.innerHTML = `
      <div class="buy-panel-emoji">${cfg.emoji}</div>
      <div class="buy-panel-name">${cfg.name}</div>
      <div class="buy-panel-price">🪙 ${cfg.seedPrice} each</div>
    `;

    // Remove old stepper/button if any (to avoid duplicates)
    panel
      .querySelectorAll(".buy-panel-stepper, .buy-panel-total, .buy-panel-btn")
      .forEach((el) => el.remove());

    // Qty stepper
    const stepper = document.createElement("div");
    stepper.className = "buy-panel-stepper";
    stepper.innerHTML = `
      <button id="buy-qty-minus">−</button>
      <span class="qty-display" id="buy-qty-val">${buyQty}</span>
      <button id="buy-qty-plus">+</button>
    `;
    panel.appendChild(stepper);

    // Total
    const totalEl = document.createElement("div");
    totalEl.className = "buy-panel-total";
    totalEl.id = "buy-panel-total";
    totalEl.textContent = `Total: 🪙 ${totalCost}`;
    panel.appendChild(totalEl);

    // Buy button
    const buyBtn = document.createElement("button");
    buyBtn.className = "buy-panel-btn";
    buyBtn.textContent = canAfford ? `Buy ×${buyQty}` : "Not enough 🪙";
    buyBtn.disabled = !canAfford;
    buyBtn.style.opacity = canAfford ? "1" : "0.45";
    buyBtn.onclick = () => buySeeds(selectedSeed);
    panel.appendChild(buyBtn);

    // Bind stepper
    $("buy-qty-minus").onclick = () => {
      if (buyQty > 1) {
        buyQty--;
        updateBuyPanel();
      }
    };
    $("buy-qty-plus").onclick = () => {
      if (buyQty < 99) {
        buyQty++;
        updateBuyPanel();
      }
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
      buyQty = 1; // Reset qty after successful buy
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
