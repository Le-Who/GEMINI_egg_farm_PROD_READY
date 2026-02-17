/* ═══════════════════════════════════════════════════
 *  Game Hub — Match-3 Module (v4.2)
 *  Client-side engine, CSS transitions, state restore
 *  ─ GameStore integration (match3 slice)
 *  ─ Pause/Continue overlay, touch swipe, default mode
 *  ─ Star Drop bonus cells (gravity-safe)
 *
 *  NOTE: calcGoldReward, findMatches, generateBoard, randomGem are
 *  intentionally duplicated from game-logic.js. The client needs its
 *  own copies for instant UI preview without server round-trips.
 *  The client findMatches uses Set<string> and excludes DROP_TYPES;
 *  the server version uses Array<{type, gems}> for different consumers.
 * ═══════════════════════════════════════════════════ */

const Match3Game = (() => {
  const GEM_TYPES = ["fire", "water", "earth", "air", "light", "dark"];
  const GEM_ICONS = {
    fire: "🔥",
    water: "💧",
    earth: "🌿",
    air: "💨",
    light: "⭐",
    dark: "🔮",
  };
  const BOARD_SIZE = 8;

  let board = [];
  let score = 0;
  let movesLeft = 30;
  let combo = 0;
  let selected = null;
  let isAnimating = false;
  let highScore = 0;
  let gameActive = false;
  let gamePaused = false;

  /* ─── Game Mode System ─── */
  let gameMode = "classic"; // "classic" | "timed" | "drop"
  let timedTimer = null;
  let timedSecondsLeft = 0;
  let dropStars = []; // [{x, y, dropped: bool}] for drop mode
  let starsDropped = 0;
  const TIMED_DURATION = 90; // seconds
  const DROP_MOVE_LIMIT = 30;
  const DROP_STAR_COUNT = 3;
  // v3.1: 3 unique reward drop types instead of single star
  const DROP_TYPES = ["drop_gold", "drop_seeds", "drop_energy"];
  const DROP_ICONS = { drop_gold: "💰", drop_seeds: "🌾", drop_energy: "⚡" };
  const DROP_LABELS = {
    drop_gold: "Gold Bag",
    drop_seeds: "Seed Pack",
    drop_energy: "Energy",
  };

  /* ─── Progressive gold reward (mirrors game-logic.js calcGoldReward) ─── */
  const REWARD_BASE = 40;
  const REWARD_LOSE = 5;
  function calcGoldReward(s) {
    if (typeof s !== "number" || s <= 0) return REWARD_LOSE;
    if (s < 1000)
      return Math.max(REWARD_LOSE, Math.floor(REWARD_BASE * (s / 1000)));
    let gold = REWARD_BASE;
    const tiers = [
      { min: 1000, max: 1999, r: 0.05 },
      { min: 2000, max: 2999, r: 0.1 },
      { min: 3000, max: 3999, r: 0.2 },
    ];
    for (const t of tiers) {
      if (s < t.min) break;
      gold += Math.floor(
        Math.floor((Math.min(s, t.max + 1) - t.min) / 100) * t.r * REWARD_BASE,
      );
    }
    if (s >= 4000) {
      let ts = 4000,
        rate = 0.4;
      while (ts <= s) {
        gold += Math.floor(
          Math.floor((Math.min(s, ts + 1000) - ts) / 100) * rate * REWARD_BASE,
        );
        ts += 1000;
        rate = Math.min(rate * 2, 2.0);
      }
    }
    return gold;
  }

  const $ = (id) => document.getElementById(id);

  /** Sync match3 state to GameStore */
  function syncToStore() {
    if (typeof GameStore !== "undefined") {
      GameStore.setState("match3", {
        board,
        score,
        movesLeft,
        combo,
        highScore,
        gameActive,
        gameMode,
      });
    }
  }

  /* ═══ Client-Side Match-3 Engine ═══ */
  function randomGem() {
    return GEM_TYPES[Math.floor(Math.random() * GEM_TYPES.length)];
  }

  function generateBoard() {
    const b = [];
    for (let y = 0; y < BOARD_SIZE; y++) {
      b[y] = [];
      for (let x = 0; x < BOARD_SIZE; x++) {
        let gem;
        do {
          gem = randomGem();
        } while (
          (x >= 2 && b[y][x - 1] === gem && b[y][x - 2] === gem) ||
          (y >= 2 && b[y - 1]?.[x] === gem && b[y - 2]?.[x] === gem)
        );
        b[y][x] = gem;
      }
    }
    return b;
  }

  function findMatches(b) {
    const matches = new Set();
    // Horizontal
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE - 2; x++) {
        // Skip star-type gems (they don't match)
        if (
          b[y][x] &&
          !DROP_TYPES.includes(b[y][x]) &&
          b[y][x] === b[y][x + 1] &&
          b[y][x] === b[y][x + 2]
        ) {
          let end = x;
          while (end < BOARD_SIZE && b[y][end] === b[y][x]) end++;
          for (let i = x; i < end; i++) matches.add(`${i},${y}`);
          x = end - 1;
        }
      }
    }
    // Vertical
    for (let x = 0; x < BOARD_SIZE; x++) {
      for (let y = 0; y < BOARD_SIZE - 2; y++) {
        if (
          b[y][x] &&
          !DROP_TYPES.includes(b[y][x]) &&
          b[y][x] === b[y + 1][x] &&
          b[y][x] === b[y + 2][x]
        ) {
          let end = y;
          while (end < BOARD_SIZE && b[end][x] === b[y][x]) end++;
          for (let i = y; i < end; i++) matches.add(`${x},${i}`);
          y = end - 1;
        }
      }
    }
    return matches;
  }

  /** Run a full cascade: match → clear → gravity → fill → repeat.
   *  Returns { steps, totalPoints, combo } for animation.
   *  Drop tokens (star drop mode) survive gravity and never get replaced. */
  function resolveBoard(b) {
    const steps = [];
    let totalPoints = 0;
    let cascadeCombo = 0;
    let matches = findMatches(b);

    while (matches.size > 0) {
      cascadeCombo++;
      const cleared = [...matches].map((k) => {
        const [x, y] = k.split(",").map(Number);
        return { x, y, type: b[y][x] };
      });
      totalPoints += cleared.length * 10 * Math.min(cascadeCombo, 5);

      // Clear matched cells (but NEVER clear drop tokens)
      for (const { x, y } of cleared) {
        if (!DROP_TYPES.includes(b[y][x])) b[y][x] = null;
      }

      // Gravity + fill (drop tokens fall with gravity but are never replaced)
      const fallen = [];
      const filled = [];
      for (let x = 0; x < BOARD_SIZE; x++) {
        let wy = BOARD_SIZE - 1;
        for (let y = BOARD_SIZE - 1; y >= 0; y--) {
          if (b[y][x]) {
            if (wy !== y) {
              b[wy][x] = b[y][x];
              b[y][x] = null;
              fallen.push({ x, fromY: y, toY: wy });
            }
            wy--;
          }
        }
        for (let y = wy; y >= 0; y--) {
          b[y][x] = randomGem();
          filled.push({ x, y, type: b[y][x] });
        }
      }

      steps.push({ cleared, fallen, filled, combo: cascadeCombo });

      // Check star drops after each cascade step
      if (gameMode === "drop") checkStarDrops();

      matches = findMatches(b);
    }

    return { steps, totalPoints, combo: cascadeCombo };
  }

  /* ═══ Init & Restore ═══ */
  async function init() {
    // Register match3 slice
    if (typeof GameStore !== "undefined") {
      GameStore.registerSlice("match3", {
        board,
        score,
        movesLeft,
        combo,
        highScore,
        gameActive,
      });
    }
    $("m3-btn-start").onclick = () => startGame(); // Bug 6 fix: prevent MouseEvent arg leak
    $("m3-btn-lb").onclick = toggleLeaderboard;
    // Leaderboard close handlers
    $("m3-lb-close").onclick = closeLeaderboard;
    $("m3-lb-backdrop").onclick = closeLeaderboard;

    // Bind pause overlay buttons
    $("m3-pause-new")?.addEventListener("click", () => {
      hideM3PauseOverlay();
      showModeSelector();
    });
    $("m3-pause-resume")?.addEventListener("click", () => {
      hideM3PauseOverlay();
    });
    $("m3-pause-end")?.addEventListener("click", async () => {
      hideM3PauseOverlay();
      if (gameActive) {
        gameActive = false;
        stopTimedCountdown();
        highScore = Math.max(highScore, score);
        const endData = await api("/api/game/end", {
          userId: HUB.userId,
          score,
          mode: gameMode,
        }).catch(() => null);
        if (endData?.highScore) highScore = endData.highScore;
        if (endData?.resources && typeof HUD !== "undefined") {
          HUD.syncFromServer(endData.resources);
          if (endData.goldReward) HUD.animateGoldChange(endData.goldReward);
        }
        showGameOver(score);
        fetchLeaderboard();
        syncToStore();
        updateStartButton();
      }
    });

    fetchLeaderboard();
    updateStartButton();

    // Try to restore an existing game from the server
    await restoreGame();
    syncToStore();

    // If no active game was restored, show mode selector + preview board
    if (!gameActive) {
      board = generateBoard();
      renderBoard(true);
      showM3PauseOverlay();
    }
  }

  /* ═══ Energy Gate ═══ */
  function updateStartButton() {
    const btn = $("m3-btn-start");
    if (!btn) return;
    const hasEnergy = typeof HUD !== "undefined" ? HUD.hasEnergy(5) : true;
    btn.disabled = !hasEnergy && !gameActive;
    if (!hasEnergy && !gameActive) {
      btn.title = "Need 5⚡ to play";
    } else {
      btn.title = "";
    }
  }

  function onEnter() {
    /* board persists in JS across screen switches */
    // Show pause overlay when entering screen (mirror Blox behavior)
    if (gameActive) {
      showM3PauseOverlay();
    } else {
      showM3PauseOverlay();
    }
  }

  /* ── Pause / Resume overlay (mirror of Blox pattern) ── */
  function showM3PauseOverlay() {
    gamePaused = true;
    HUB.swipeBlocked = false; // allow screen swiping when paused

    let overlay = $("m3-pause-overlay");
    if (!overlay) return;

    const btnNew = $("m3-pause-new");
    const btnResume = $("m3-pause-resume");
    const btnEnd = $("m3-pause-end");
    const title = $("m3-pause-title");

    if (gameActive) {
      // Game in progress — show resume + end
      if (title) title.textContent = "⏸ Paused";
      if (btnNew) btnNew.style.display = "none";
      if (btnResume) btnResume.style.display = "";
      if (btnEnd) btnEnd.style.display = "";
    } else {
      // No active game — show New Game (+ Continue if restored)
      if (title) title.textContent = "💎 Gem Crush";
      if (btnNew) btnNew.style.display = "";
      if (btnResume) btnResume.style.display = "none";
      if (btnEnd) btnEnd.style.display = "none";
    }
    overlay.classList.add("show");
  }

  function hideM3PauseOverlay() {
    gamePaused = false;
    const overlay = $("m3-pause-overlay");
    if (overlay) overlay.classList.remove("show");
    // Block swipe when playing
    if (gameActive) HUB.swipeBlocked = true;
  }

  async function restoreGame() {
    try {
      const data = await api("/api/game/state", {
        userId: HUB.userId,
        username: HUB.username,
      });
      if (data && data.game) {
        board = data.game.board;
        score = data.game.score || 0;
        movesLeft = data.game.movesLeft || 0;
        combo = data.game.combo || 0;
        highScore = data.highScore || 0;
        gameActive = movesLeft > 0;

        if (gameActive) {
          updateStatsUI();
          renderBoard(true);
          showToast("💎 Game restored!");
        } else {
          highScore = data.highScore || 0;
          $("m3-best").textContent = highScore;
          // Generate a preview board so the screen isn't empty
          board = generateBoard();
          renderBoard(true);
        }
      } else if (data) {
        highScore = data.highScore || 0;
        $("m3-best").textContent = highScore;
        board = generateBoard();
        renderBoard(true);
      }
    } catch (e) {
      console.warn("Match-3 restore failed:", e);
    }
  }

  /* ═══ Start Game ═══ */
  const LAST_MODE_KEY = "m3_last_mode";
  async function startGame(mode) {
    // If no mode passed, use last mode or default to classic
    if (!mode) {
      const lastMode = localStorage.getItem(LAST_MODE_KEY);
      mode = lastMode || "classic";
    }
    // Save chosen mode
    localStorage.setItem(LAST_MODE_KEY, mode);
    gameMode = mode;

    // Energy gatekeep — show quick-feed modal instead of toast
    if (typeof HUD !== "undefined" && !HUD.hasEnergy(5)) {
      if (HUD.showEnergyModal) {
        HUD.showEnergyModal(5, () => startGame(mode));
      } else {
        showToast("⚡ Need 5 energy to play Match-3!");
      }
      return;
    }

    $("m3-overlay").classList.remove("show");
    hideM3PauseOverlay();
    hideModeSelector();
    selected = null;
    isAnimating = false;

    // Generate board client-side
    board = generateBoard();
    score = 0;
    combo = 0;
    gameActive = true;
    starsDropped = 0;
    dropStars = [];

    // Mode-specific init (drop stars placed AFTER server board)
    if (gameMode === "timed") {
      movesLeft = 9999; // Unlimited moves in timed mode
      timedSecondsLeft = TIMED_DURATION;
      $("m3-moves-label").textContent = "";
      $("m3-moves").textContent = `${TIMED_DURATION}s`;
      $("m3-moves").style.color = "";
      startTimedCountdown();
    } else if (gameMode === "drop") {
      movesLeft = DROP_MOVE_LIMIT;
      // placeDropStars() will be called AFTER server board is applied
    } else {
      movesLeft = 30;
      $("m3-moves-label").textContent = "Moves";
    }

    // Notify server of new game (deducts energy)
    const data = await api("/api/game/start", {
      userId: HUB.userId,
      username: HUB.username,
      mode: gameMode,
    });

    // Handle energy error
    if (data && data.error === "NOT_ENOUGH_ENERGY") {
      showToast("⚡ Not enough energy!");
      gameActive = false;
      stopTimedCountdown();
      return;
    }

    if (data && data.highScore !== undefined) highScore = data.highScore;

    // Sync resources from server response
    if (data && data.resources && typeof HUD !== "undefined") {
      HUD.syncFromServer(data.resources);
    }

    // Use server board if available (ensures consistency)
    if (data && data.game && data.game.board) {
      board = data.game.board;
      score = data.game.score || 0;
      if (gameMode === "classic") {
        movesLeft = data.game.movesLeft || 30;
      }
    }

    // Place drop stars AFTER server board is applied (critical fix!)
    if (gameMode === "drop") {
      placeDropStars();
    }

    updateStatsUI();
    renderBoard(true);
    syncToStore();
    updateStartButton();
  }

  /* ─── Mode Selector UI ─── */
  function showModeSelector() {
    let sel = $("m3-mode-selector");
    if (!sel) {
      sel = document.createElement("div");
      sel.id = "m3-mode-selector";
      sel.className = "m3-mode-selector show";
      sel.innerHTML = `
        <div class="m3-mode-title">Choose Mode</div>
        <div class="m3-mode-cards">
          <button class="m3-mode-card" data-mode="classic">
            <span class="m3-mode-icon">💎</span>
            <span class="m3-mode-name">Classic</span>
            <span class="m3-mode-desc">30 moves to score big</span>
          </button>
          <button class="m3-mode-card" data-mode="timed">
            <span class="m3-mode-icon">⏱️</span>
            <span class="m3-mode-name">Time Attack</span>
            <span class="m3-mode-desc">90 seconds · 1.5× gold</span>
          </button>
          <button class="m3-mode-card" data-mode="drop">
            <span class="m3-mode-icon">🎯</span>
            <span class="m3-mode-name">Star Drop</span>
            <span class="m3-mode-desc">Drop tokens to bottom for loot</span>
          </button>
        </div>
      `;
      sel.addEventListener("click", (e) => {
        const card = e.target.closest(".m3-mode-card");
        if (!card) return;
        const newMode = card.dataset.mode;
        // If switching mode during active game, just switch (no confirm — blocked by Discord sandbox)
        if (gameActive && newMode !== gameMode && score > 0) {
          const label =
            card.querySelector(".m3-mode-name")?.textContent || newMode;
          if (typeof showToast === "function")
            showToast(`🔄 Switching to ${label}…`);
        }
        startGame(newMode);
      });
      // Insert inline inside m3-main, before the board
      const main = $("m3-board-container")?.closest(".m3-main");
      const boardC = $("m3-board-container");
      if (main && boardC) {
        main.insertBefore(sel, boardC);
      } else if (boardC) {
        boardC.parentElement.insertBefore(sel, boardC);
      }
    } else {
      sel.classList.add("show");
    }
    // Remove playing state and active highlights
    sel.classList.remove("playing");
    sel
      .querySelectorAll(".m3-mode-card")
      .forEach((c) => c.classList.remove("active"));
  }
  function hideModeSelector() {
    const sel = $("m3-mode-selector");
    if (!sel) return;
    // Don't hide — keep visible but mark as playing with active mode
    sel.classList.add("playing");
    sel.querySelectorAll(".m3-mode-card").forEach((c) => {
      c.classList.toggle("active", c.dataset.mode === gameMode);
    });
    // Re-enable mode switching during play (clickable but dimmed)
    sel.querySelectorAll(".m3-mode-card:not(.active)").forEach((c) => {
      c.style.pointerEvents = "auto";
    });
  }

  /* ─── Timed Mode Countdown ─── */
  function startTimedCountdown() {
    stopTimedCountdown();
    timedTimer = setInterval(() => {
      timedSecondsLeft--;
      $("m3-moves").textContent = `${timedSecondsLeft}s`;
      if (timedSecondsLeft <= 10) {
        $("m3-moves").style.color = "#ef4444";
      }
      if (timedSecondsLeft <= 0) {
        stopTimedCountdown();
        endTimedGame();
      }
    }, 1000);
  }
  function stopTimedCountdown() {
    if (timedTimer) clearInterval(timedTimer);
    timedTimer = null;
  }
  async function endTimedGame() {
    if (!gameActive) return;
    gameActive = false;
    // Timed mode: 1.5x score for reward calculation
    const adjustedScore = Math.floor(score * 1.5);
    highScore = Math.max(highScore, score);

    const endData = await api("/api/game/end", {
      userId: HUB.userId,
      score: adjustedScore,
      mode: "timed",
    }).catch(() => null);
    if (endData?.highScore) highScore = endData.highScore;
    if (endData?.resources && typeof HUD !== "undefined") {
      HUD.syncFromServer(endData.resources);
      if (endData.goldReward) HUD.animateGoldChange(endData.goldReward);
    }
    setTimeout(() => showGameOver(score), 500);
    fetchLeaderboard();
    syncToStore();
    updateStartButton();
  }

  /* ─── Drop Mode: Star Objects ─── */
  function placeDropStars() {
    dropStars = [];
    starsDropped = 0;
    // Place 3 unique reward objects in top 2 rows at random columns
    const usedCols = new Set();
    for (let i = 0; i < DROP_STAR_COUNT; i++) {
      let col;
      do {
        col = Math.floor(Math.random() * BOARD_SIZE);
      } while (usedCols.has(col));
      usedCols.add(col);
      const row = Math.floor(Math.random() * 2); // row 0 or 1
      const dropType = DROP_TYPES[i];
      board[row][col] = dropType;
      dropStars.push({ x: col, y: row, dropped: false, type: dropType });
    }
  }

  function checkStarDrops() {
    // Reward objects "drop" when they reach the bottom row (row 7)
    for (const star of dropStars) {
      if (star.dropped) continue;
      // Find the drop item on the board
      for (let y = 0; y < BOARD_SIZE; y++) {
        for (let x = 0; x < BOARD_SIZE; x++) {
          if (board[y][x] === star.type) {
            star.x = x;
            star.y = y;
          }
        }
      }
      if (star.y === BOARD_SIZE - 1) {
        // Reached bottom — mark as dropped
        star.dropped = true;
        starsDropped++;
        board[star.y][star.x] = randomGem(); // Replace with regular gem
        const icon = DROP_ICONS[star.type] || "🌟";
        const label = DROP_LABELS[star.type] || "Reward";
        showToast(
          `${icon} ${label} dropped! (${starsDropped}/${DROP_STAR_COUNT})`,
        );
      }
    }
  }

  function calcDropReward() {
    // Returns a reward object describing what the player earned
    const rewards = { gold: 0, seeds: null, energy: 0 };
    for (const star of dropStars) {
      if (!star.dropped) continue;
      if (star.type === "drop_gold") rewards.gold += 40; // Enough for another game
      if (star.type === "drop_seeds") rewards.seeds = getRandomSeedPack(); // ≤60🪙 worth
      if (star.type === "drop_energy") rewards.energy += 7;
    }
    // Bonus for all 3 collected
    if (starsDropped >= DROP_STAR_COUNT) rewards.gold += 20;
    return rewards;
  }

  function getRandomSeedPack() {
    // Pick a random seed type that costs ≤60 gold
    // Return { cropId, quantity } for server to award
    const affordable =
      Object.entries(GEM_ICONS).length > 0
        ? ["carrot", "tomato", "corn", "wheat"] // fallbacks
        : ["carrot"];
    const cropId = affordable[Math.floor(Math.random() * affordable.length)];
    return { cropId, quantity: 3 };
  }

  /* ═══ Render Board (persistent DOM elements) ═══ */
  function renderBoard(animate) {
    const $b = $("m3-board");
    $b.innerHTML = "";
    $b.classList.remove("disabled");

    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        const type = board[y][x];
        const cell = document.createElement("div");
        cell.className = "m3-cell";
        const isDrop = DROP_TYPES.includes(type);
        if (isDrop)
          cell.classList.add("drop-gem", `drop-${type.replace("drop_", "")}`);
        if (animate) cell.classList.add("entering");
        cell.dataset.type = type;
        cell.dataset.x = x;
        cell.dataset.y = y;
        const icon = isDrop ? DROP_ICONS[type] || "🌟" : GEM_ICONS[type] || "?";
        cell.innerHTML = `<span class="gem-icon">${icon}</span>`;
        if (animate) cell.style.animationDelay = `${(x + y) * 25}ms`;
        cell.addEventListener("click", () => onCellClick(x, y));
        $b.appendChild(cell);
      }
    }

    // Bind pointer swipe on board (once)
    initBoardPointerSwipe();
  }

  /* ─── Pointer Swipe (unified touch + mouse drag for gem swapping) ─── */
  let _swipeBound = false;
  function initBoardPointerSwipe() {
    const $b = $("m3-board");
    if (!$b || _swipeBound) return;
    _swipeBound = true;

    let startX = 0,
      startY = 0;
    let startCellX = -1,
      startCellY = -1;
    let swiping = false;

    $b.addEventListener("pointerdown", (e) => {
      if (isAnimating || !gameActive || gamePaused) return;
      const cell = e.target.closest(".m3-cell");
      if (!cell) return;

      startX = e.clientX;
      startY = e.clientY;
      startCellX = parseInt(cell.dataset.x);
      startCellY = parseInt(cell.dataset.y);
      swiping = true;

      // Block screen swipe while interacting with board
      HUB.swipeBlocked = true;
      e.preventDefault();
    });

    $b.addEventListener("pointerup", (e) => {
      if (!swiping || startCellX < 0) {
        swiping = false;
        return;
      }
      swiping = false;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const THRESHOLD = 20; // px

      // Restore screen swipe
      setTimeout(() => {
        if (!gameActive) HUB.swipeBlocked = false;
      }, 100);

      // If movement is too small, treat as click (handled by click listener)
      if (Math.abs(dx) < THRESHOLD && Math.abs(dy) < THRESHOLD) return;

      // Determine dominant direction
      let toX = startCellX,
        toY = startCellY;
      if (Math.abs(dx) >= Math.abs(dy)) {
        toX += dx > 0 ? 1 : -1; // horizontal
      } else {
        toY += dy > 0 ? 1 : -1; // vertical
      }

      // Bounds check
      if (toX < 0 || toX >= BOARD_SIZE || toY < 0 || toY >= BOARD_SIZE) return;

      // Clear any click-selection and attempt swap
      if (selected) {
        getCell(selected.x, selected.y)?.classList.remove("selected");
        selected = null;
      }
      attemptSwap(startCellX, startCellY, toX, toY);
      startCellX = -1;
    });

    // Prevent default to avoid text selection during swipe
    $b.addEventListener("pointermove", (e) => {
      if (swiping) e.preventDefault();
    });

    // Cancel swipe if pointer leaves board
    $b.addEventListener("pointerleave", () => {
      swiping = false;
      startCellX = -1;
    });
  }

  /* ═══ Cell Click ═══ */
  function onCellClick(x, y) {
    if (isAnimating || !gameActive || gamePaused) return;
    if (!selected) {
      selected = { x, y };
      getCell(x, y)?.classList.add("selected");
      return;
    }
    if (selected.x === x && selected.y === y) {
      getCell(x, y)?.classList.remove("selected");
      selected = null;
      return;
    }
    const dx = Math.abs(selected.x - x),
      dy = Math.abs(selected.y - y);
    if (dx + dy === 1) {
      attemptSwap(selected.x, selected.y, x, y);
    } else {
      getCell(selected.x, selected.y)?.classList.remove("selected");
      selected = { x, y };
      getCell(x, y)?.classList.add("selected");
    }
  }

  /* ═══ Swap — Client-Side with Smooth Animations ═══ */
  async function attemptSwap(fromX, fromY, toX, toY) {
    isAnimating = true;
    const $b = $("m3-board");
    $b.classList.add("disabled");
    getCell(fromX, fromY)?.classList.remove("selected");
    selected = null;

    // 1. Client-side: try swap
    const testBoard = board.map((r) => [...r]);
    [testBoard[fromY][fromX], testBoard[toY][toX]] = [
      testBoard[toY][toX],
      testBoard[fromY][fromX],
    ];

    const matches = findMatches(testBoard);
    if (matches.size === 0) {
      // Invalid swap — shake
      $b.classList.add("shake");
      setTimeout(() => $b.classList.remove("shake"), 400);
      isAnimating = false;
      $b.classList.remove("disabled");
      return;
    }

    // 1.5 Visual swap slide animation — cells glide into each other's positions
    const cellA = getCell(fromX, fromY);
    const cellB = getCell(toX, toY);
    const cellSize = cellA?.offsetWidth || 48;
    const dx = (toX - fromX) * cellSize;
    const dy = (toY - fromY) * cellSize;

    if (cellA && cellB) {
      cellA.style.transition = "transform 0.18s ease";
      cellB.style.transition = "transform 0.18s ease";
      cellA.style.transform = `translate(${dx}px, ${dy}px)`;
      cellB.style.transform = `translate(${-dx}px, ${-dy}px)`;
      cellA.style.zIndex = "2";
      await sleep(200);
    }

    // 2. Apply swap to real board
    [board[fromY][fromX], board[toY][toX]] = [
      board[toY][toX],
      board[fromY][fromX],
    ];

    // 3. Resolve cascades client-side
    const result = resolveBoard(board);
    score += result.totalPoints;
    // Don't decrement moves in timed mode (unlimited)
    if (gameMode !== "timed") movesLeft--;
    combo = result.combo;

    // Drop mode: check if stars reached bottom
    if (gameMode === "drop") checkStarDrops();

    // 4. Animate the cascade steps
    await animateCascade(result.steps);

    // 5. Update UI
    updateStatsUI();
    syncToStore();

    if (combo > 1) showComboBanner(combo);
    if (result.totalPoints > 0)
      showFloatingPoints(toX, toY, result.totalPoints);

    // 6. Check game over (mode-specific)
    const isGameOver = gameMode === "timed" ? false : movesLeft <= 0;
    const isDropComplete =
      gameMode === "drop" && starsDropped >= DROP_STAR_COUNT;

    if (isGameOver || isDropComplete) {
      highScore = Math.max(highScore, score);
      gameActive = false;
      stopTimedCountdown();

      // Send final move
      api("/api/game/move", {
        userId: HUB.userId,
        fromX,
        fromY,
        toX,
        toY,
      }).catch(() => {});

      // Calculate end score/rewards based on mode
      let endScore = score;
      if (gameMode === "drop") {
        // Drop mode: structured rewards, not score-based gold
        const dropRewards = calcDropReward();
        endScore = dropRewards.gold + dropRewards.energy * 5; // normalized for leaderboard
        // Show reward breakdown
        const parts = [];
        if (dropRewards.gold > 0) parts.push(`💰 ${dropRewards.gold}🪙`);
        if (dropRewards.energy > 0) parts.push(`⚡ +${dropRewards.energy}`);
        if (dropRewards.seeds)
          parts.push(`🌾 ${dropRewards.seeds.quantity}× seeds`);
        showToast(`🎁 Rewards: ${parts.join(" · ")}`);
      }

      const endData = await api("/api/game/end", {
        userId: HUB.userId,
        score: endScore,
        mode: gameMode,
      }).catch(() => null);
      if (endData?.highScore) highScore = endData.highScore;
      if (endData?.resources && typeof HUD !== "undefined") {
        HUD.syncFromServer(endData.resources);
        if (endData.goldReward) HUD.animateGoldChange(endData.goldReward);
      }
      setTimeout(() => showGameOver(score), 500);
      fetchLeaderboard();
      syncToStore();
      updateStartButton();
    } else {
      // Send move to server in background (fire-and-forget for validation)
      api("/api/game/move", {
        userId: HUB.userId,
        fromX,
        fromY,
        toX,
        toY,
      }).catch(() => {});
    }

    isAnimating = false;
    $b.classList.remove("disabled");
  }

  /* ═══ Cascade Animation (smooth CSS transitions) ═══ */
  async function animateCascade(steps) {
    for (const step of steps) {
      // Phase 1: Pop matched gems (with brightness flash)
      for (const { x, y } of step.cleared) {
        getCell(x, y)?.classList.add("popping");
      }
      await sleep(300); // Longer pop phase for satisfying clear feel

      // Phase 2: Update cells with new types + staggered falling animation
      const $b = $("m3-board");
      $b.innerHTML = "";
      const changedSet = new Set();
      for (const { x, y } of step.cleared) changedSet.add(`${x},${y}`);
      for (const f of step.fallen) changedSet.add(`${f.x},${f.toY}`);
      for (const f of step.filled) changedSet.add(`${f.x},${f.y}`);

      for (let y = 0; y < BOARD_SIZE; y++) {
        for (let x = 0; x < BOARD_SIZE; x++) {
          const type = board[y][x];
          const cell = document.createElement("div");
          cell.className = "m3-cell";
          const isDrop = DROP_TYPES.includes(type);
          if (isDrop)
            cell.classList.add("drop-gem", `drop-${type.replace("drop_", "")}`);
          cell.dataset.type = type;
          cell.dataset.x = x;
          cell.dataset.y = y;
          const icon = isDrop
            ? DROP_ICONS[type] || "🌟"
            : GEM_ICONS[type] || "?";
          cell.innerHTML = `<span class="gem-icon">${icon}</span>`;
          if (changedSet.has(`${x},${y}`)) {
            cell.classList.add("falling");
            // Column-based stagger: each column starts slightly later for cascade effect
            cell.style.animationDelay = `${x * 25 + y * 15}ms`;
          }
          cell.addEventListener("click", () => onCellClick(x, y));
          $b.appendChild(cell);
        }
      }
      await sleep(260); // Longer settle phase for bounce to complete
    }
  }

  /* ═══ UI Helpers ═══ */
  function getCell(x, y) {
    return $("m3-board").querySelector(
      `.m3-cell[data-x="${x}"][data-y="${y}"]`,
    );
  }

  function updateStatsUI() {
    animateNumber($("m3-score"), score);
    // Mode-specific moves/timer display
    if (gameMode === "timed") {
      $("m3-moves").textContent = `${timedSecondsLeft}s`;
      $("m3-moves").style.color = timedSecondsLeft <= 10 ? "#ef4444" : "";
    } else {
      $("m3-moves").textContent = movesLeft === 9999 ? "∞" : movesLeft;
      $("m3-moves").style.color =
        movesLeft <= 5 && gameMode !== "timed" ? "#ef4444" : "";
    }
    const $c = $("m3-combo");
    $c.textContent = combo > 0 ? `${combo}×` : "—";
    if (combo > 1) {
      $c.classList.add("m3-combo-flash");
      setTimeout(() => $c.classList.remove("m3-combo-flash"), 400);
    }
    $("m3-best").textContent = highScore;
    // Live gold reward preview (mode-aware)
    const $g = $("m3-gold");
    if ($g) {
      let reward;
      if (!gameActive) {
        reward = 0;
      } else if (gameMode === "drop") {
        const dr = calcDropReward();
        // Build compact preview: gold + energy
        const parts = [];
        if (dr.gold > 0) parts.push(`${dr.gold}g`);
        if (dr.energy > 0) parts.push(`${dr.energy}⚡`);
        if (dr.seeds) parts.push(`🌾`);
        $g.textContent = gameActive
          ? parts.length
            ? `+${parts.join("+")}`
            : "+0"
          : "—";
        $g.style.color = dr.gold > 0 ? "#fbbf24" : "";
        reward = null; // skip generic display below
      } else if (gameMode === "timed") {
        reward = calcGoldReward(Math.floor(score * 1.5));
      } else {
        reward = calcGoldReward(score);
      }
      if (reward !== null) {
        $g.textContent = gameActive ? `+${reward}` : "—";
        $g.style.color = reward > REWARD_BASE ? "#fbbf24" : "";
      }
    }
  }

  function animateNumber(el, target) {
    const cur = parseInt(el.textContent) || 0;
    if (cur === target) {
      el.textContent = target;
      return;
    }
    const diff = target - cur,
      steps = Math.min(Math.abs(diff), 20),
      step = diff / steps;
    let i = 0;
    const iv = setInterval(() => {
      i++;
      if (i >= steps) {
        el.textContent = target;
        clearInterval(iv);
      } else el.textContent = Math.round(cur + step * i);
    }, 25);
  }

  function showFloatingPoints(x, y, pts) {
    const container = $("m3-board-container");
    const cs =
      parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(
          "--m3-cell",
        ),
      ) || 48;
    const el = document.createElement("div");
    el.className = "m3-float-points";
    el.textContent = `+${pts}`;
    el.style.left = `${10 + x * (cs + 3) + cs / 2}px`;
    el.style.top = `${10 + y * (cs + 3)}px`;
    container.appendChild(el);
    setTimeout(() => el.remove(), 800);
  }

  function showComboBanner(c) {
    const labels = [
      "",
      "",
      "Double! ✨",
      "Triple! 🔥",
      "Mega! 💥",
      "ULTRA! ⚡",
    ];
    const $cb = $("m3-combo-banner");
    $cb.textContent = labels[Math.min(c, 5)] || `${c}× Combo! 🌟`;
    $cb.classList.add("show");
    setTimeout(() => $cb.classList.remove("show"), 1200);
  }

  function showGameOver(finalScore) {
    $("m3-final-score").textContent = finalScore;
    $("m3-final-best").textContent = highScore;
    $("m3-overlay").classList.add("show");
  }

  /* ═══ Leaderboard ═══ */
  let lbVisible = false;
  function toggleLeaderboard() {
    lbVisible ? closeLeaderboard() : openLeaderboard();
  }
  function openLeaderboard() {
    lbVisible = true;
    $("m3-lb-panel").classList.add("open");
    $("m3-lb-backdrop").classList.add("show");
    fetchLeaderboard();
  }
  function closeLeaderboard() {
    lbVisible = false;
    $("m3-lb-panel").classList.remove("open");
    $("m3-lb-backdrop").classList.remove("show");
  }

  async function fetchLeaderboard(scope) {
    const url =
      scope === "room"
        ? "/api/leaderboard?scope=room&roomId=demo"
        : "/api/leaderboard";
    const data = await api(url);
    renderLeaderboard(data);
  }

  function renderLeaderboard(entries) {
    const tbody = $("m3-lb-body");
    if (!entries || entries.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="3" class="m3-lb-empty">No scores yet — play to be first! 🏆</td></tr>';
      return;
    }
    tbody.innerHTML = entries
      .map((e, i) => {
        const cls =
          i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : "";
        return `<tr>
        <td class="m3-lb-rank ${cls}">#${e.rank}</td>
        <td>${e.username}</td>
        <td class="m3-lb-score">${e.highScore}</td>
      </tr>`;
      })
      .join("");
  }

  function setLbTab(scope) {
    document
      .querySelectorAll(".m3-lb-tab")
      .forEach((t) => t.classList.remove("active"));
    const activeTab =
      scope === "room"
        ? document.getElementById("btn-lb-tab-room")
        : document.getElementById("btn-lb-tab-all");
    if (activeTab) activeTab.classList.add("active");
    fetchLeaderboard(scope);
  }

  return { init, onEnter, startGame, toggleLeaderboard, setLbTab };
})();
