/* ═══════════════════════════════════════════════════
 *  Game Hub — Trivia Module
 *  Solo mode, Duel mode, timer, results
 * ═══════════════════════════════════════════════════ */

const TriviaGame = (() => {
  let session = null; // { question, startTime, timerId }
  let duel = null; // { roomId, inviteCode, pollId }
  let view = "menu"; // menu | solo | duel-create | duel-join | duel-wait | duel-play | results

  const $ = (id) => document.getElementById(id);

  function init() {
    showMenu();
  }
  function onEnter() {
    /* trivia timer keeps running — no action needed */
  }

  /* ─── View Management ─── */
  function showView(name) {
    view = name;
    [
      "trivia-menu",
      "trivia-play",
      "trivia-duel-create",
      "trivia-duel-join",
      "trivia-duel-wait",
      "trivia-results",
    ].forEach((id) => {
      const el = $(id);
      if (el) el.style.display = "none";
    });
    const el = $(
      name === "solo" || name === "duel-play"
        ? "trivia-play"
        : `trivia-${name}`,
    );
    if (el) el.style.display = "";
  }

  function showMenu() {
    showView("menu");
    stopTimer();
  }

  /* ═══ SOLO MODE ═══ */
  async function startSolo() {
    const data = await api("/api/trivia/start", {
      userId: HUB.userId,
      username: HUB.username,
      count: 5,
    });
    if (!data.success) return;
    session = { mode: "solo", score: 0, streak: 0 };
    showView("solo");
    renderQuestion(data.question);
  }

  /* ═══ DUEL MODE ═══ */
  async function createDuel() {
    const data = await api("/api/trivia/duel/create", {
      userId: HUB.userId,
      username: HUB.username,
      count: 5,
    });
    if (!data.success) return;
    duel = { roomId: data.roomId, inviteCode: data.inviteCode };
    showView("duel-create");
    $("duel-invite-code").textContent = data.inviteCode;
    // Poll for opponent
    duel.pollId = setInterval(async () => {
      const s = await api(`/api/trivia/duel/status/${duel.roomId}`);
      if (s.status === "active" || s.players?.length >= 2) {
        clearInterval(duel.pollId);
        startDuelPlay();
      }
    }, 2000);
  }

  function showJoinDuel() {
    showView("duel-join");
    $("duel-join-input").value = "";
    $("duel-join-input").focus();
  }

  async function joinDuel() {
    const code = $("duel-join-input").value.trim().toUpperCase();
    if (!code) return;
    const data = await api("/api/trivia/duel/join", {
      userId: HUB.userId,
      username: HUB.username,
      inviteCode: code,
    });
    if (data.error) {
      showToast(`❌ ${data.error}`);
      return;
    }
    duel = { roomId: data.roomId };
    if (data.status === "active") {
      startDuelPlay();
    } else {
      showView("duel-wait");
    }
  }

  async function startDuelPlay() {
    const data = await api("/api/trivia/duel/start", {
      userId: HUB.userId,
      roomId: duel.roomId,
    });
    if (!data.success) return;
    session = {
      mode: "duel",
      score: 0,
      streak: 0,
      roomId: duel.roomId,
      opponent: data.opponent,
    };
    showView("duel-play");
    renderQuestion(data.question);
  }

  /* ═══ QUESTION RENDERING ═══ */
  function renderQuestion(q) {
    if (!q) return;
    session.question = q;
    session.answered = false;
    $("trivia-progress").textContent = `Question ${q.index + 1} / ${q.total}`;
    $("trivia-score-display").textContent = session.score;
    $("trivia-streak-display").textContent =
      session.streak > 0 ? `🔥 ${session.streak}` : "";
    $("trivia-category").textContent = `${q.category} • ${q.difficulty}`;
    $("trivia-q-text").textContent = q.question;

    const ansDiv = $("trivia-answers");
    ansDiv.innerHTML = "";
    q.answers.forEach((ans) => {
      const btn = document.createElement("button");
      btn.className = "trivia-answer-btn";
      btn.textContent = ans;
      btn.onclick = () => submitAnswer(ans);
      ansDiv.appendChild(btn);
    });

    // Start timer
    startTimer(q.timeLimit);
  }

  /* ═══ TIMER ═══ */
  let timerStart, timerDuration, timerRaf;
  function startTimer(seconds) {
    timerStart = Date.now();
    timerDuration = seconds * 1000;
    updateTimer();
  }
  function updateTimer() {
    const elapsed = Date.now() - timerStart;
    const remaining = Math.max(0, timerDuration - elapsed);
    const pct = (remaining / timerDuration) * 100;
    const sec = Math.ceil(remaining / 1000);

    $("trivia-timer-fill").style.width = pct + "%";
    const tt = $("trivia-timer-text");
    tt.textContent = sec + "s";
    tt.classList.toggle("danger", sec <= 3);

    if (remaining <= 0 && !session.answered) {
      submitAnswer(null); // Time's up
      return;
    }
    timerRaf = requestAnimationFrame(updateTimer);
  }
  function stopTimer() {
    if (timerRaf) cancelAnimationFrame(timerRaf);
  }

  /* ═══ SUBMIT ANSWER ═══ */
  async function submitAnswer(answer) {
    if (session.answered) return;
    session.answered = true;
    stopTimer();

    const timeMs = Date.now() - timerStart;
    const btns = $("trivia-answers").querySelectorAll(".trivia-answer-btn");
    btns.forEach((b) => {
      b.disabled = true;
    });

    let data;
    if (session.mode === "solo") {
      data = await api("/api/trivia/answer", {
        userId: HUB.userId,
        answer,
        timeMs,
      });
    } else {
      data = await api("/api/trivia/duel/answer", {
        userId: HUB.userId,
        roomId: session.roomId,
        answer,
        timeMs,
      });
    }

    // Highlight correct/wrong
    btns.forEach((b) => {
      if (b.textContent === data.correctAnswer) b.classList.add("correct");
      else if (b.textContent === answer && !data.correct)
        b.classList.add("wrong");
    });

    session.score = data.sessionScore;
    session.streak = data.streak;

    await sleep(1200);

    if (data.isComplete) {
      showResults(data);
    } else if (data.nextQuestion) {
      renderQuestion(data.nextQuestion);
    }
  }

  /* ═══ RESULTS ═══ */
  async function showResults(data) {
    showView("results");
    $("trivia-final-score").textContent = session.score;

    if (session.mode === "solo" && data.stats) {
      $("trivia-results-extra").innerHTML = `
        <div class="trivia-results-breakdown">
          <span>🏆 Total: ${data.stats.totalScore}</span>
          <span>🔥 Best Streak: ${data.stats.bestStreak}</span>
          <span>📊 Games: ${data.stats.totalPlayed}</span>
        </div>`;
    } else if (session.mode === "duel") {
      $("trivia-results-extra").innerHTML =
        '<div class="trivia-duel-status"><span class="spinner">⏳</span> Waiting for opponent...</div>';
      // Poll for duel results
      const pollId = setInterval(async () => {
        const s = await api(`/api/trivia/duel/status/${session.roomId}`);
        if (s.status === "finished") {
          clearInterval(pollId);
          renderDuelResults(s);
        }
      }, 2000);
    }
  }

  function renderDuelResults(s) {
    let html = '<div class="trivia-duel-results">';
    s.players.forEach((p) => {
      const isWinner = s.winner === p.username;
      html += `<div class="trivia-duel-player${isWinner ? " winner" : ""}">
        <div class="dp-name">${isWinner ? "👑 " : ""}${p.username}</div>
        <div class="dp-score">${p.score}</div>
        <div style="font-size:0.7rem;color:var(--text-dim)">${p.correctCount}/${p.totalQuestions} correct</div>
      </div>`;
    });
    html += "</div>";
    if (s.winner === "Tie")
      html +=
        '<div style="text-align:center;font-size:1.1rem;font-weight:700;color:var(--gold)">🤝 It\'s a Tie!</div>';
    $("trivia-results-extra").innerHTML = html;
  }

  function copyInviteCode() {
    const code = $("duel-invite-code").textContent;
    navigator.clipboard?.writeText(code);
    showToast("📋 Code copied!");
  }

  return {
    init,
    onEnter,
    startSolo,
    createDuel,
    showJoinDuel,
    joinDuel,
    showMenu,
    copyInviteCode,
  };
})();
