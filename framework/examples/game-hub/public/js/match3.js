/* ═══════════════════════════════════════════════════
 *  Game Hub — Match-3 Module
 *  Board rendering, swap mechanics, animations, leaderboard
 * ═══════════════════════════════════════════════════ */

const Match3Game = (() => {
  const GEM_ICONS = {
    fire: "🔥",
    water: "💧",
    earth: "🌿",
    air: "💨",
    light: "⭐",
    dark: "🔮",
  };
  let board = [];
  let selected = null;
  let isAnimating = false;
  let highScore = 0;
  let gameActive = false;

  const $ = (id) => document.getElementById(id);

  function init() {
    $("m3-btn-start").onclick = startGame;
    $("m3-btn-lb").onclick = toggleLeaderboard;
    fetchLeaderboard();
  }

  function onEnter() {
    /* board persists in JS, no action needed */
  }

  /* ─── Start Game ─── */
  async function startGame() {
    $("m3-overlay").classList.remove("show");
    selected = null;
    isAnimating = false;

    const data = await api("/api/game/start", {
      userId: HUB.userId,
      username: HUB.username,
    });
    board = data.game.board;
    highScore = data.highScore || 0;
    gameActive = true;

    updateStats(data.game);
    renderBoard(true);
  }

  /* ─── Render Board ─── */
  function renderBoard(animate) {
    const $b = $("m3-board");
    $b.innerHTML = "";
    $b.classList.remove("disabled");

    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
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

  /* ─── Cell Click ─── */
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

  /* ─── Swap ─── */
  async function attemptSwap(fromX, fromY, toX, toY) {
    isAnimating = true;
    const $b = $("m3-board");
    $b.classList.add("disabled");
    getCell(fromX, fromY)?.classList.remove("selected");
    selected = null;

    const data = await api("/api/game/move", {
      userId: HUB.userId,
      fromX,
      fromY,
      toX,
      toY,
    });

    if (!data.valid) {
      $b.classList.add("shake");
      setTimeout(() => $b.classList.remove("shake"), 400);
      isAnimating = false;
      $b.classList.remove("disabled");
      return;
    }

    if (data.combo > 1) showComboBanner(data.combo);
    if (data.points > 0) showFloatingPoints(toX, toY, data.points);

    const oldBoard = board.map((r) => [...r]);
    board = data.game.board;
    await animateTransition(oldBoard, board);
    updateStats(data.game);

    if (data.game.isGameOver) {
      highScore = data.highScore || highScore;
      gameActive = false;
      setTimeout(() => showGameOver(data.game.score), 500);
      fetchLeaderboard();
    }

    isAnimating = false;
    $b.classList.remove("disabled");
  }

  /* ─── Board Transition ─── */
  async function animateTransition(oldB, newB) {
    const changed = [];
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++)
        if (oldB[y][x] !== newB[y][x]) changed.push({ x, y });

    for (const { x, y } of changed) getCell(x, y)?.classList.add("popping");
    await sleep(280);

    const $b = $("m3-board");
    $b.innerHTML = "";
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const type = newB[y][x];
        const cell = document.createElement("div");
        cell.className = "m3-cell";
        cell.dataset.type = type;
        cell.dataset.x = x;
        cell.dataset.y = y;
        cell.innerHTML = `<span class="gem-icon">${GEM_ICONS[type] || "?"}</span>`;
        if (changed.some((c) => c.x === x && c.y === y)) {
          cell.classList.add("falling");
          cell.style.animationDelay = `${x * 30}ms`;
        }
        cell.addEventListener("click", () => onCellClick(x, y));
        $b.appendChild(cell);
      }
    }
    await sleep(350);
  }

  /* ─── UI Helpers ─── */
  function getCell(x, y) {
    return $("m3-board").querySelector(
      `.m3-cell[data-x="${x}"][data-y="${y}"]`,
    );
  }

  function updateStats(game) {
    animateNumber($("m3-score"), game.score);
    $("m3-moves").textContent = game.movesLeft;
    const $c = $("m3-combo");
    $c.textContent = game.combo > 0 ? `${game.combo}×` : "—";
    if (game.combo > 1) {
      $c.classList.add("m3-combo-flash");
      setTimeout(() => $c.classList.remove("m3-combo-flash"), 400);
    }
    $("m3-best").textContent = highScore;
    $("m3-moves").style.color = game.movesLeft <= 5 ? "#ef4444" : "";
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

  function showComboBanner(combo) {
    const labels = [
      "",
      "",
      "Double! ✨",
      "Triple! 🔥",
      "Mega! 💥",
      "ULTRA! ⚡",
    ];
    const $cb = $("m3-combo-banner");
    $cb.textContent = labels[Math.min(combo, 5)] || `${combo}× Combo! 🌟`;
    $cb.classList.add("show");
    setTimeout(() => $cb.classList.remove("show"), 1200);
  }

  function showGameOver(score) {
    $("m3-final-score").textContent = score;
    $("m3-final-best").textContent = highScore;
    $("m3-overlay").classList.add("show");
  }

  /* ─── Leaderboard ─── */
  let lbVisible = false;
  function toggleLeaderboard() {
    lbVisible = !lbVisible;
    $("m3-lb-panel").style.display = lbVisible ? "" : "none";
    if (lbVisible) fetchLeaderboard();
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
