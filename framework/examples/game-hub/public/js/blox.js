/* ═══════════════════════════════════════════════════
 *  Game Hub — Building Blox Module (v4.0)
 *  10×10 Block Puzzle: place pieces, clear lines
 *  ─ GameStore integration (blox slice)
 * ═══════════════════════════════════════════════════ */

const BloxGame = (() => {
  "use strict";

  const GRID = 10;
  const PIECE_COUNT = 3; // pieces per tray refill

  /* ── Piece library (duplicated from game-logic.js for client preview) ── */
  const PIECES = [
    { id: "dot", cells: [[0, 0]], color: "#94a3b8" },
    {
      id: "h2",
      cells: [
        [0, 0],
        [0, 1],
      ],
      color: "#60a5fa",
    },
    {
      id: "v2",
      cells: [
        [0, 0],
        [1, 0],
      ],
      color: "#60a5fa",
    },
    {
      id: "l3",
      cells: [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
      color: "#f97316",
    },
    {
      id: "l3r",
      cells: [
        [0, 0],
        [0, 1],
        [1, 0],
      ],
      color: "#f97316",
    },
    {
      id: "h3",
      cells: [
        [0, 0],
        [0, 1],
        [0, 2],
      ],
      color: "#22c55e",
    },
    {
      id: "v3",
      cells: [
        [0, 0],
        [1, 0],
        [2, 0],
      ],
      color: "#22c55e",
    },
    {
      id: "sq",
      cells: [
        [0, 0],
        [0, 1],
        [1, 0],
        [1, 1],
      ],
      color: "#fbbf24",
    },
    {
      id: "t4",
      cells: [
        [0, 0],
        [0, 1],
        [0, 2],
        [1, 1],
      ],
      color: "#a78bfa",
    },
    {
      id: "s4",
      cells: [
        [0, 1],
        [0, 2],
        [1, 0],
        [1, 1],
      ],
      color: "#ef4444",
    },
    {
      id: "i4",
      cells: [
        [0, 0],
        [0, 1],
        [0, 2],
        [0, 3],
      ],
      color: "#06b6d4",
    },
    {
      id: "i5",
      cells: [
        [0, 0],
        [0, 1],
        [0, 2],
        [0, 3],
        [0, 4],
      ],
      color: "#e879f9",
    },
  ];

  // ── State ──
  let board = []; // GRID×GRID, null = empty, string = color
  let tray = []; // Array of { piece, placed }
  let score = 0;
  let linesCleared = 0;
  let highScore = 0;
  let gameActive = false;
  let selectedPiece = -1;

  const $ = (id) => document.getElementById(id);

  // ── Board helpers ──
  function createEmptyBoard() {
    return Array.from({ length: GRID }, () => Array(GRID).fill(null));
  }

  function randomPiece() {
    return PIECES[Math.floor(Math.random() * PIECES.length)];
  }

  function refillTray() {
    tray = [];
    for (let i = 0; i < PIECE_COUNT; i++) {
      tray.push({ piece: randomPiece(), placed: false });
    }
    selectedPiece = -1;
  }

  function canPlace(piece, row, col) {
    for (const [dr, dc] of piece.cells) {
      const r = row + dr,
        c = col + dc;
      if (r < 0 || r >= GRID || c < 0 || c >= GRID) return false;
      if (board[r][c] !== null) return false;
    }
    return true;
  }

  function placePiece(piece, row, col) {
    for (const [dr, dc] of piece.cells) {
      board[row + dr][col + dc] = piece.color;
    }
  }

  // ── Line clearing ──
  function clearLines() {
    let cleared = 0;
    const rowsToClear = [];
    const colsToClear = [];

    // Check rows
    for (let r = 0; r < GRID; r++) {
      if (board[r].every((c) => c !== null)) rowsToClear.push(r);
    }
    // Check columns
    for (let c = 0; c < GRID; c++) {
      let full = true;
      for (let r = 0; r < GRID; r++) {
        if (board[r][c] === null) {
          full = false;
          break;
        }
      }
      if (full) colsToClear.push(c);
    }

    // Clear with animation
    const cellsToClear = new Set();
    for (const r of rowsToClear) {
      for (let c = 0; c < GRID; c++) cellsToClear.add(`${r},${c}`);
    }
    for (const c of colsToClear) {
      for (let r = 0; r < GRID; r++) cellsToClear.add(`${r},${c}`);
    }

    cleared = rowsToClear.length + colsToClear.length;

    if (cleared > 0) {
      // Animate clear
      const gridEl = $("blox-board");
      if (gridEl) {
        for (const key of cellsToClear) {
          const [r, c] = key.split(",").map(Number);
          const cell = gridEl.querySelector(`[data-r="${r}"][data-c="${c}"]`);
          if (cell) cell.classList.add("clearing");
        }
      }

      // Delay actual clear for animation
      setTimeout(() => {
        for (const key of cellsToClear) {
          const [r, c] = key.split(",").map(Number);
          board[r][c] = null;
        }
        renderBoard();
      }, 300);

      // Score: bonus for multi-line clears
      const bonus = cleared > 1 ? cleared * 5 : 0;
      const pts = cleared * 10 + bonus;
      score += pts;
      linesCleared += cleared;

      if (typeof showToast === "function") {
        const msg =
          cleared > 1
            ? `✨ ${cleared} lines! +${pts} pts`
            : `📏 Line clear! +${pts} pts`;
        showToast(msg);
      }
    }

    return cleared;
  }

  // ── Game-over check ──
  function canAnyPieceFit() {
    for (const t of tray) {
      if (t.placed) continue;
      for (let r = 0; r < GRID; r++) {
        for (let c = 0; c < GRID; c++) {
          if (canPlace(t.piece, r, c)) return true;
        }
      }
    }
    return false;
  }

  // ── Rendering ──
  function renderBoard() {
    const gridEl = $("blox-board");
    if (!gridEl) return;
    gridEl.innerHTML = "";
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const cell = document.createElement("div");
        cell.className = "blox-cell";
        cell.dataset.r = r;
        cell.dataset.c = c;
        if (board[r][c]) {
          cell.classList.add("filled");
          cell.style.background = board[r][c];
        }
        cell.addEventListener("click", () => onCellClick(r, c));
        cell.addEventListener("mouseenter", () => showGhost(r, c));
        cell.addEventListener("mouseleave", clearGhost);
        gridEl.appendChild(cell);
      }
    }
  }

  function renderTray() {
    const trayEl = $("blox-tray");
    if (!trayEl) return;
    trayEl.innerHTML = "";
    tray.forEach((t, i) => {
      const wrapper = document.createElement("div");
      wrapper.className = "blox-piece-wrapper" + (t.placed ? " placed" : "");
      if (i === selectedPiece && !t.placed) wrapper.classList.add("selected");
      wrapper.addEventListener("click", () => selectPiece(i));

      // Render mini preview of piece shape
      const preview = document.createElement("div");
      preview.className = "blox-piece-preview";
      const maxR = Math.max(...t.piece.cells.map((c) => c[0])) + 1;
      const maxC = Math.max(...t.piece.cells.map((c) => c[1])) + 1;
      preview.style.gridTemplateColumns = `repeat(${maxC}, 1fr)`;
      preview.style.gridTemplateRows = `repeat(${maxR}, 1fr)`;

      for (let r = 0; r < maxR; r++) {
        for (let c = 0; c < maxC; c++) {
          const mini = document.createElement("div");
          mini.className = "blox-mini-cell";
          const isActive = t.piece.cells.some(
            ([pr, pc]) => pr === r && pc === c,
          );
          if (isActive) {
            mini.classList.add("active");
            mini.style.background = t.piece.color;
          }
          preview.appendChild(mini);
        }
      }
      wrapper.appendChild(preview);
      trayEl.appendChild(wrapper);
    });
  }

  function updateStats() {
    const scoreEl = $("blox-score");
    const linesEl = $("blox-lines");
    const bestEl = $("blox-best");
    const rewardEl = $("blox-reward");
    if (scoreEl) scoreEl.textContent = score;
    if (linesEl) linesEl.textContent = linesCleared;
    if (bestEl) bestEl.textContent = highScore;
    if (rewardEl) {
      const reward = calcBloxRewardClient(score);
      rewardEl.textContent = gameActive ? `+${reward}` : "—";
    }
  }

  // Client-side reward estimate (mirrors game-logic.js calcBloxReward)
  function calcBloxRewardClient(s) {
    const BASE = 35,
      LOSE = 5;
    if (typeof s !== "number" || s <= 0) return LOSE;
    if (s < 100) return Math.max(LOSE, Math.floor(BASE * (s / 100)));
    let gold = BASE;
    if (s >= 100)
      gold += Math.floor(((Math.min(s, 300) - 100) / 50) * 0.08 * BASE);
    if (s >= 300)
      gold += Math.floor(((Math.min(s, 600) - 300) / 50) * 0.15 * BASE);
    if (s >= 600) gold += Math.floor(((s - 600) / 50) * 0.25 * BASE);
    return Math.min(gold, 400);
  }

  // ── Ghost preview ──
  function showGhost(r, c) {
    if (selectedPiece < 0 || !gameActive) return;
    const t = tray[selectedPiece];
    if (!t || t.placed) return;
    clearGhost();
    const gridEl = $("blox-board");
    if (!gridEl) return;
    const valid = canPlace(t.piece, r, c);
    for (const [dr, dc] of t.piece.cells) {
      const gr = r + dr,
        gc = c + dc;
      if (gr < 0 || gr >= GRID || gc < 0 || gc >= GRID) continue;
      const cell = gridEl.querySelector(`[data-r="${gr}"][data-c="${gc}"]`);
      if (cell) {
        cell.classList.add("ghost");
        if (!valid) cell.classList.add("ghost-invalid");
        else cell.style.setProperty("--ghost-color", t.piece.color);
      }
    }
  }

  function clearGhost() {
    const gridEl = $("blox-board");
    if (!gridEl) return;
    gridEl.querySelectorAll(".ghost").forEach((c) => {
      c.classList.remove("ghost", "ghost-invalid");
      c.style.removeProperty("--ghost-color");
    });
  }

  // ── Interaction ──
  function selectPiece(i) {
    if (!gameActive) return;
    if (tray[i]?.placed) return;
    selectedPiece = selectedPiece === i ? -1 : i;
    renderTray();
  }

  function onCellClick(r, c) {
    if (!gameActive || selectedPiece < 0) return;
    const t = tray[selectedPiece];
    if (!t || t.placed) return;
    if (!canPlace(t.piece, r, c)) {
      // Shake board
      const gridEl = $("blox-board");
      if (gridEl) {
        gridEl.classList.add("shake");
        setTimeout(() => gridEl.classList.remove("shake"), 350);
      }
      return;
    }

    // Place piece
    placePiece(t.piece, r, c);
    t.placed = true;
    selectedPiece = -1;

    renderBoard();
    renderTray();

    // Check line clears (after brief delay for visual feedback)
    setTimeout(() => {
      clearLines();
      updateStats();
      syncToStore();

      // Check if all pieces placed → refill
      if (tray.every((x) => x.placed)) {
        setTimeout(() => {
          refillTray();
          renderTray();
          // Check game over with new tray
          if (!canAnyPieceFit()) {
            gameOver();
          }
        }, 200);
      } else {
        // Check if remaining pieces can fit
        if (!canAnyPieceFit()) {
          setTimeout(gameOver, 400);
        }
      }
    }, 50);
  }

  // ── Game lifecycle ──
  async function startGame() {
    // Energy gatekeep
    if (typeof HUD !== "undefined" && !HUD.hasEnergy(4)) {
      if (HUD.showEnergyModal) {
        HUD.showEnergyModal(4, () => startGame());
      } else {
        showToast("⚡ Need 4 energy to play Building Blox!");
      }
      return;
    }

    // Close game-over overlay
    $("blox-overlay")?.classList.remove("show");

    board = createEmptyBoard();
    score = 0;
    linesCleared = 0;
    gameActive = true;
    refillTray();

    renderBoard();
    renderTray();
    updateStats();
    syncToStore();

    // Notify server
    const data = await api("/api/blox/start", {
      userId: HUB.userId,
      username: HUB.username,
    }).catch(() => null);

    if (data?.error === "NOT_ENOUGH_ENERGY") {
      showToast("⚡ Not enough energy!");
      gameActive = false;
      return;
    }
    if (data?.highScore !== undefined) highScore = data.highScore;
    if (data?.resources && typeof HUD !== "undefined") {
      HUD.syncFromServer(data.resources);
    }
    updateStats();

    // Update start button
    const btn = $("blox-btn-start");
    if (btn) btn.textContent = "🏁 End Game";
  }

  async function endGame() {
    if (!gameActive) return;
    gameActive = false;
    highScore = Math.max(highScore, score);

    const data = await api("/api/blox/end", {
      userId: HUB.userId,
      score,
      linesCleared,
    }).catch(() => null);

    if (data?.highScore) highScore = data.highScore;
    if (data?.resources && typeof HUD !== "undefined") {
      HUD.syncFromServer(data.resources);
      if (data.goldReward) HUD.animateGoldChange(data.goldReward);
    }

    showGameOver(score);
    syncToStore();
    updateStats();

    const btn = $("blox-btn-start");
    if (btn) btn.textContent = "🧱 New Game";
  }

  function gameOver() {
    if (typeof showToast === "function") {
      showToast("🧱 No more moves! Game Over");
    }
    endGame();
  }

  function showGameOver(finalScore) {
    $("blox-final-score").textContent = finalScore;
    $("blox-final-best").textContent = highScore;
    $("blox-final-lines").textContent = linesCleared;
    $("blox-overlay")?.classList.add("show");
  }

  // ── Store sync ──
  function syncToStore() {
    if (typeof GameStore !== "undefined") {
      GameStore.setState("blox", {
        score,
        linesCleared,
        highScore,
        gameActive,
      });
    }
  }

  // ── Init ──
  async function init() {
    if (typeof GameStore !== "undefined") {
      GameStore.registerSlice("blox", {
        score,
        linesCleared,
        highScore,
        gameActive,
      });
    }

    $("blox-btn-start").onclick = () => {
      if (gameActive) endGame();
      else startGame();
    };

    board = createEmptyBoard();
    renderBoard();
    updateStats();
  }

  function onEnter() {
    updateStats();
  }

  return { init, onEnter, startGame };
})();
