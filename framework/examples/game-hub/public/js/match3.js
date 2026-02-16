/* ═══════════════════════════════════════════════════
 *  Game Hub — Match-3 Module (v1.5)
 *  Client-side engine, CSS transitions, state restore
 *  ─ GameStore integration (match3 slice)
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
        if (b[y][x] && b[y][x] === b[y][x + 1] && b[y][x] === b[y][x + 2]) {
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
        if (b[y][x] && b[y][x] === b[y + 1][x] && b[y][x] === b[y + 2][x]) {
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
   *  Returns { steps, totalPoints, combo } for animation. */
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

      // Clear
      for (const { x, y } of cleared) b[y][x] = null;

      // Gravity + fill
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
    $("m3-btn-start").onclick = startGame;
    $("m3-btn-lb").onclick = toggleLeaderboard;
    // Leaderboard close handlers
    $("m3-lb-close").onclick = closeLeaderboard;
    $("m3-lb-backdrop").onclick = closeLeaderboard;
    fetchLeaderboard();
    updateStartButton();

    // Try to restore an existing game from the server
    await restoreGame();
    syncToStore();
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
        }
      } else if (data) {
        highScore = data.highScore || 0;
        $("m3-best").textContent = highScore;
      }
    } catch (e) {
      console.warn("Match-3 restore failed:", e);
    }
  }

  /* ═══ Start Game ═══ */
  async function startGame() {
    // Energy gatekeep — show quick-feed modal instead of toast
    if (typeof HUD !== "undefined" && !HUD.hasEnergy(5)) {
      if (HUD.showEnergyModal) {
        HUD.showEnergyModal(5, () => startGame());
      } else {
        showToast("⚡ Need 5 energy to play Match-3!");
      }
      return;
    }

    $("m3-overlay").classList.remove("show");
    selected = null;
    isAnimating = false;

    // Generate board client-side
    board = generateBoard();
    score = 0;
    movesLeft = 30;
    combo = 0;
    gameActive = true;

    // Notify server of new game (deducts energy)
    const data = await api("/api/game/start", {
      userId: HUB.userId,
      username: HUB.username,
    });

    // Handle energy error
    if (data && data.error === "NOT_ENOUGH_ENERGY") {
      showToast("⚡ Not enough energy!");
      gameActive = false;
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
      movesLeft = data.game.movesLeft || 30;
    }

    updateStatsUI();
    renderBoard(true);
    syncToStore();
    updateStartButton();
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
        if (animate) cell.classList.add("entering");
        cell.dataset.type = type;
        cell.dataset.x = x;
        cell.dataset.y = y;
        cell.innerHTML = `<span class="gem-icon">${GEM_ICONS[type] || "?"}</span>`;
        if (animate) cell.style.animationDelay = `${(x + y) * 25}ms`;
        cell.addEventListener("click", () => onCellClick(x, y));
        $b.appendChild(cell);
      }
    }
  }

  /* ═══ Cell Click ═══ */
  function onCellClick(x, y) {
    if (isAnimating || !gameActive) return;
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

    // 2. Apply swap to real board
    [board[fromY][fromX], board[toY][toX]] = [
      board[toY][toX],
      board[fromY][fromX],
    ];

    // 3. Resolve cascades client-side
    const result = resolveBoard(board);
    score += result.totalPoints;
    movesLeft--;
    combo = result.combo;

    // 4. Animate the cascade steps
    await animateCascade(result.steps);

    // 5. Update UI
    updateStatsUI();
    syncToStore();

    if (combo > 1) showComboBanner(combo);
    if (result.totalPoints > 0)
      showFloatingPoints(toX, toY, result.totalPoints);

    // 6. Check game over
    if (movesLeft <= 0) {
      highScore = Math.max(highScore, score);
      gameActive = false;
      // Send final move + end game via dedicated endpoint
      api("/api/game/move", {
        userId: HUB.userId,
        fromX,
        fromY,
        toX,
        toY,
      }).catch(() => {});
      // Save score and get server-side highScore + gold reward
      const endData = await api("/api/game/end", {
        userId: HUB.userId,
        score,
      }).catch(() => null);
      if (endData?.highScore) {
        highScore = endData.highScore;
      }
      // Sync gold reward to HUD
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
          cell.dataset.type = type;
          cell.dataset.x = x;
          cell.dataset.y = y;
          cell.innerHTML = `<span class="gem-icon">${GEM_ICONS[type] || "?"}</span>`;
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
    $("m3-moves").textContent = movesLeft;
    const $c = $("m3-combo");
    $c.textContent = combo > 0 ? `${combo}×` : "—";
    if (combo > 1) {
      $c.classList.add("m3-combo-flash");
      setTimeout(() => $c.classList.remove("m3-combo-flash"), 400);
    }
    $("m3-best").textContent = highScore;
    $("m3-moves").style.color = movesLeft <= 5 ? "#ef4444" : "";
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
