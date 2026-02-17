/* ═══════════════════════════════════════════════════
 *  Game Hub — Building Blox Module (v4.1)
 *  10×10 Block Puzzle: place pieces, clear lines
 *  ─ localStorage persistence, pause overlay, touch drag,
 *    center-of-mass ghost, swipe blocking
 * ═══════════════════════════════════════════════════ */

const BloxGame = (() => {
  "use strict";

  const GRID = 10;
  const PIECE_COUNT = 3;
  const STORAGE_KEY = "blox_state";

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
  let board = [];
  let tray = [];
  let score = 0;
  let linesCleared = 0;
  let highScore = 0;
  let gameActive = false;
  let gamePaused = false;
  let selectedPiece = -1;

  // Drag state (touch)
  let dragPieceIdx = -1;
  let dragPreviewEl = null;

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

  // ── Center-of-mass offset for a piece ──
  function getCenterOffset(piece) {
    const rows = piece.cells.map((c) => c[0]);
    const cols = piece.cells.map((c) => c[1]);
    return {
      dr: Math.round(rows.reduce((a, b) => a + b, 0) / rows.length),
      dc: Math.round(cols.reduce((a, b) => a + b, 0) / cols.length),
    };
  }

  // ── Line clearing ──
  function clearLines() {
    let cleared = 0;
    const rowsToClear = [];
    const colsToClear = [];

    for (let r = 0; r < GRID; r++) {
      if (board[r].every((c) => c !== null)) rowsToClear.push(r);
    }
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

    const cellsToClear = new Set();
    for (const r of rowsToClear) {
      for (let c = 0; c < GRID; c++) cellsToClear.add(`${r},${c}`);
    }
    for (const c of colsToClear) {
      for (let r = 0; r < GRID; r++) cellsToClear.add(`${r},${c}`);
    }

    cleared = rowsToClear.length + colsToClear.length;

    if (cleared > 0) {
      const gridEl = $("blox-board");
      if (gridEl) {
        for (const key of cellsToClear) {
          const [r, c] = key.split(",").map(Number);
          const cell = gridEl.querySelector(`[data-r="${r}"][data-c="${c}"]`);
          if (cell) cell.classList.add("clearing");
        }
      }

      setTimeout(() => {
        for (const key of cellsToClear) {
          const [r, c] = key.split(",").map(Number);
          board[r][c] = null;
        }
        renderBoard();
      }, 300);

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

  // ── Persistence ──
  function saveState() {
    try {
      const state = {
        board,
        tray: tray.map((t) => ({
          pieceId: t.piece.id,
          placed: t.placed,
        })),
        score,
        linesCleared,
        highScore,
        gameActive,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_) {
      /* quota exceeded - silent */
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const state = JSON.parse(raw);
      if (!state || !state.board || !state.tray) return null;
      // Reconstruct tray pieces from IDs
      const restoredTray = state.tray.map((t) => {
        const piece = PIECES.find((p) => p.id === t.pieceId);
        if (!piece) return null;
        return { piece, placed: t.placed };
      });
      if (restoredTray.some((t) => t === null)) return null;
      return {
        board: state.board,
        tray: restoredTray,
        score: state.score || 0,
        linesCleared: state.linesCleared || 0,
        highScore: state.highScore || 0,
        gameActive: !!state.gameActive,
      };
    } catch (_) {
      return null;
    }
  }

  function clearSavedState() {
    localStorage.removeItem(STORAGE_KEY);
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
        // No per-cell click — handled by board-level click in initBoardMouseTracking
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

      // Touch drag
      wrapper.addEventListener("touchstart", (e) => onTrayTouchStart(e, i), {
        passive: false,
      });

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

  // ── Ghost preview + click (board-level, center-of-mass offset) ──
  function initBoardMouseTracking() {
    const gridEl = $("blox-board");
    if (!gridEl) return;

    // Guard: only bind once per DOM element
    if (gridEl._bloxBound) return;
    gridEl._bloxBound = true;

    // Shared function: compute placement target from mouse/click position
    function getTargetFromEvent(e) {
      if (selectedPiece < 0 || !gameActive || gamePaused) return null;
      const t = tray[selectedPiece];
      if (!t || t.placed) return null;

      const rect = gridEl.getBoundingClientRect();
      const cellSize = rect.width / GRID;
      const hoveredR = Math.floor((e.clientY - rect.top) / cellSize);
      const hoveredC = Math.floor((e.clientX - rect.left) / cellSize);

      if (
        hoveredR < 0 ||
        hoveredR >= GRID ||
        hoveredC < 0 ||
        hoveredC >= GRID
      ) {
        return null;
      }

      const offset = getCenterOffset(t.piece);
      return {
        piece: t.piece,
        targetR: hoveredR - offset.dr,
        targetC: hoveredC - offset.dc,
      };
    }

    gridEl.addEventListener("mousemove", (e) => {
      clearGhost();
      const target = getTargetFromEvent(e);
      if (target) showGhostAt(target.piece, target.targetR, target.targetC);
    });

    gridEl.addEventListener("mouseleave", clearGhost);

    // Board-level click: same offset math as ghost
    gridEl.addEventListener("click", (e) => {
      const target = getTargetFromEvent(e);
      if (target) onCellClick(target.targetR, target.targetC);
    });
  }

  function showGhostAt(piece, r, c) {
    const gridEl = $("blox-board");
    if (!gridEl) return;
    const valid = canPlace(piece, r, c);
    for (const [dr, dc] of piece.cells) {
      const gr = r + dr,
        gc = c + dc;
      if (gr < 0 || gr >= GRID || gc < 0 || gc >= GRID) continue;
      const cell = gridEl.querySelector(`[data-r="${gr}"][data-c="${gc}"]`);
      if (cell) {
        cell.classList.add("ghost");
        if (!valid) cell.classList.add("ghost-invalid");
        else cell.style.setProperty("--ghost-color", piece.color);
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

  // ── Touch drag-and-drop ──
  function onTrayTouchStart(e, idx) {
    if (!gameActive || gamePaused) return;
    if (tray[idx]?.placed) return;
    e.preventDefault(); // Block swipe nav
    dragPieceIdx = idx;
    selectedPiece = idx;
    renderTray();

    // Create floating preview
    createDragPreview(tray[idx].piece, e.touches[0]);

    // Block swipe navigation while dragging
    HUB.swipeBlocked = true;

    const onMove = (ev) => {
      ev.preventDefault();
      if (dragPieceIdx < 0) return;
      const touch = ev.touches[0];
      moveDragPreview(touch);

      // Show ghost on board
      const gridEl = $("blox-board");
      if (!gridEl) return;
      const rect = gridEl.getBoundingClientRect();
      const cellSize = rect.width / GRID;
      const hoveredR = Math.floor((touch.clientY - rect.top) / cellSize);
      const hoveredC = Math.floor((touch.clientX - rect.left) / cellSize);
      const offset = getCenterOffset(tray[dragPieceIdx].piece);
      const targetR = hoveredR - offset.dr;
      const targetC = hoveredC - offset.dc;
      clearGhost();
      if (
        hoveredR >= 0 &&
        hoveredR < GRID &&
        hoveredC >= 0 &&
        hoveredC < GRID
      ) {
        showGhostAt(tray[dragPieceIdx].piece, targetR, targetC);
      }
    };

    const onEnd = (ev) => {
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      removeDragPreview();
      clearGhost();

      if (dragPieceIdx < 0) return;
      const touch = ev.changedTouches[0];
      const gridEl = $("blox-board");
      if (gridEl) {
        const rect = gridEl.getBoundingClientRect();
        const cellSize = rect.width / GRID;
        const hoveredR = Math.floor((touch.clientY - rect.top) / cellSize);
        const hoveredC = Math.floor((touch.clientX - rect.left) / cellSize);
        const offset = getCenterOffset(tray[dragPieceIdx].piece);
        const targetR = hoveredR - offset.dr;
        const targetC = hoveredC - offset.dc;

        if (
          hoveredR >= 0 &&
          hoveredR < GRID &&
          hoveredC >= 0 &&
          hoveredC < GRID
        ) {
          onCellClick(targetR, targetC);
        }
      }
      dragPieceIdx = -1;
    };

    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd, { passive: false });
  }

  function createDragPreview(piece, touch) {
    removeDragPreview();
    const el = document.createElement("div");
    el.className = "blox-drag-preview";
    const maxR = Math.max(...piece.cells.map((c) => c[0])) + 1;
    const maxC = Math.max(...piece.cells.map((c) => c[1])) + 1;
    const cellPx = 28;
    el.style.width = `${maxC * cellPx}px`;
    el.style.height = `${maxR * cellPx}px`;
    el.style.gridTemplateColumns = `repeat(${maxC}, ${cellPx}px)`;
    el.style.gridTemplateRows = `repeat(${maxR}, ${cellPx}px)`;

    for (let r = 0; r < maxR; r++) {
      for (let c = 0; c < maxC; c++) {
        const cell = document.createElement("div");
        const isActive = piece.cells.some(([pr, pc]) => pr === r && pc === c);
        if (isActive) {
          cell.style.background = piece.color;
          cell.style.borderRadius = "4px";
        }
        el.appendChild(cell);
      }
    }

    const offset = getCenterOffset(piece);
    el.style.left = `${touch.clientX - (offset.dc + 0.5) * cellPx}px`;
    el.style.top = `${touch.clientY - (offset.dr + 0.5) * cellPx - 40}px`; // Lift above finger
    document.body.appendChild(el);
    dragPreviewEl = el;
  }

  function moveDragPreview(touch) {
    if (!dragPreviewEl || dragPieceIdx < 0) return;
    const piece = tray[dragPieceIdx].piece;
    const offset = getCenterOffset(piece);
    const cellPx = 28;
    dragPreviewEl.style.left = `${touch.clientX - (offset.dc + 0.5) * cellPx}px`;
    dragPreviewEl.style.top = `${touch.clientY - (offset.dr + 0.5) * cellPx - 40}px`;
  }

  function removeDragPreview() {
    if (dragPreviewEl) {
      dragPreviewEl.remove();
      dragPreviewEl = null;
    }
  }

  // ── Interaction ──
  function selectPiece(i) {
    if (!gameActive || gamePaused) return;
    if (tray[i]?.placed) return;
    selectedPiece = selectedPiece === i ? -1 : i;
    renderTray();
  }

  function onCellClick(r, c) {
    if (!gameActive || gamePaused || selectedPiece < 0) return;
    const t = tray[selectedPiece];
    if (!t || t.placed) return;
    if (!canPlace(t.piece, r, c)) {
      const gridEl = $("blox-board");
      if (gridEl) {
        gridEl.classList.add("shake");
        setTimeout(() => gridEl.classList.remove("shake"), 350);
      }
      return;
    }

    placePiece(t.piece, r, c);
    t.placed = true;
    selectedPiece = -1;

    renderBoard();
    renderTray();
    initBoardMouseTracking(); // Re-bind after re-render

    setTimeout(() => {
      clearLines();
      updateStats();
      saveState();
      syncToStore();

      if (tray.every((x) => x.placed)) {
        setTimeout(() => {
          refillTray();
          renderTray();
          saveState();
          if (!canAnyPieceFit()) {
            gameOver();
          }
        }, 200);
      } else {
        if (!canAnyPieceFit()) {
          setTimeout(gameOver, 400);
        }
      }
    }, 50);
  }

  // ── Pause / Resume overlay ──
  function showPauseOverlay() {
    gamePaused = true;
    // Unblock swipe when paused
    HUB.swipeBlocked = false;

    const overlay = $("blox-pause-overlay");
    const btnNew = $("blox-btn-new");
    const btnResume = $("blox-btn-resume");
    const btnEnd = $("blox-btn-end");
    const title = $("blox-pause-title");

    if (gameActive) {
      // Game in progress — show resume + end
      if (title) title.textContent = "⏸ Paused";
      if (btnNew) btnNew.style.display = "none";
      if (btnResume) btnResume.style.display = "";
      if (btnEnd) btnEnd.style.display = "";
    } else {
      // Check if there's a saved game
      const saved = loadState();
      if (saved && saved.gameActive) {
        if (title) title.textContent = "🧱 Building Blox";
        if (btnNew) btnNew.style.display = "";
        if (btnResume) btnResume.style.display = "";
        if (btnEnd) btnEnd.style.display = "none";
      } else {
        if (title) title.textContent = "🧱 Building Blox";
        if (btnNew) btnNew.style.display = "";
        if (btnResume) btnResume.style.display = "none";
        if (btnEnd) btnEnd.style.display = "none";
      }
    }
    if (overlay) overlay.classList.add("show");
  }

  function hidePauseOverlay() {
    gamePaused = false;
    const overlay = $("blox-pause-overlay");
    if (overlay) overlay.classList.remove("show");
    // Block swipe when playing
    if (gameActive) HUB.swipeBlocked = true;
  }

  function resumeGame() {
    if (gameActive) {
      // Already active, just hide overlay
      hidePauseOverlay();
      return;
    }
    // Try to restore from save
    const saved = loadState();
    if (saved && saved.gameActive) {
      board = saved.board;
      tray = saved.tray;
      score = saved.score;
      linesCleared = saved.linesCleared;
      highScore = saved.highScore;
      gameActive = true;
      selectedPiece = -1;

      renderBoard();
      renderTray();
      updateStats();
      initBoardMouseTracking();
      hidePauseOverlay();
      syncToStore();
    }
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

    // Close overlays
    $("blox-overlay")?.classList.remove("show");

    board = createEmptyBoard();
    score = 0;
    linesCleared = 0;
    gameActive = true;
    gamePaused = false;
    refillTray();

    renderBoard();
    renderTray();
    updateStats();
    initBoardMouseTracking();
    hidePauseOverlay();
    saveState();
    syncToStore();

    // Notify server
    const data = await api("/api/blox/start", {
      userId: HUB.userId,
      username: HUB.username,
    }).catch(() => null);

    if (data?.error === "NOT_ENOUGH_ENERGY") {
      showToast("⚡ Not enough energy!");
      gameActive = false;
      HUB.swipeBlocked = false;
      return;
    }
    if (data?.highScore !== undefined) highScore = data.highScore;
    if (data?.resources && typeof HUD !== "undefined") {
      HUD.syncFromServer(data.resources);
    }
    updateStats();
    saveState();
  }

  async function endGame() {
    if (!gameActive) return;
    gameActive = false;
    gamePaused = false;
    highScore = Math.max(highScore, score);
    HUB.swipeBlocked = false;
    clearSavedState();

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

    // Bind pause overlay buttons
    $("blox-btn-new")?.addEventListener("click", () => startGame());
    $("blox-btn-resume")?.addEventListener("click", () => resumeGame());
    $("blox-btn-end")?.addEventListener("click", () => {
      hidePauseOverlay();
      endGame();
    });

    board = createEmptyBoard();
    renderBoard();
    initBoardMouseTracking();
    updateStats();

    // Show initial overlay
    showPauseOverlay();
  }

  function onEnter() {
    updateStats();
    // Show pause overlay when entering screen (if game is active, pause it)
    if (gameActive) {
      showPauseOverlay();
    } else {
      showPauseOverlay();
    }
  }

  return { init, onEnter, startGame };
})();
