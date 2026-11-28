// Chess Quest: Home, the Learn path, Challenges, the Rulebook, settings and new games.
// The board screen's three modes live in src/screens/ (game.js, lesson.js, puzzle.js).
import { initOverlays, openOverlay, openScreen, onScreenShown, closeTopThen, currentScreen, backToHome } from "./ui/overlays.js";
import { BADGES, BADGE_GROUPS, checkBadges, earnedBadges, best } from "./lib/achievements.js";
import { coachSvg, coachLine } from "./ui/coach.js";
import { registerServiceWorker } from "./ui/update.js";
import { initInstall, refreshInstall } from "./ui/install.js";
import { hapticsAvailable } from "./ui/haptics.js";
import { alertPlayer, notificationPermission, enableNotifications } from "./ui/turnalert.js";
import { unlockAudio, play } from "./ui/audio.js";
import { loadPieceSprite } from "./ui/board.js";
import { getSettings, updateSettings, onSettingsChange, setting } from "./lib/settings.js";
import { readJson, writeJson } from "./storage.js";
import { dateKey } from "./lib/random.js";
import { UNITS, ALL_LESSONS } from "./content/lessons.js";
import { RULES } from "./content/rules.js";
import { warmUp } from "./chess/bot.js";
import { miniBoard } from "./screens/boardscreen.js";
import { newGame, newFriendGame, resumeGame, savedGame, savedFriendGame, setGameHooks, setNewGameOpener } from "./screens/game.js";
import { startLesson, lessonProgress, nextLesson, setLessonHooks, startBoss, bossProgress } from "./screens/lesson.js";
import { BOSSES, OPENING_BOSSES } from "./content/bosses.js";
import { BOTS, BOT_START, botById, botWins, nextUpBot } from "./content/bots.js";
import { openOnlineGame, savedOnlineGame, setOnlineHooks, friends, saveFriends, toast, friendRecords, forgetFriendRecord } from "./screens/online.js";
import { getBackend, onlineConfigured } from "./online/backend.js";
import { isOffline, onConnectionChange, withTimeout } from "./online/connection.js";
import { AVATARS, cleanCode, INVITE_FRESH_MS } from "./online/common.js";
import { dailyStats, statsLine } from "./screens/puzzle.js";
import { SETS, loadPuzzles, puzzleList, solvedPuzzles, setStatus, drillBests, startPractice, startRetry, startDrill, startSet, startPuzzle, dailyPuzzle, dailyRecord, dailyStreak, setPuzzleHooks } from "./screens/puzzle.js";

const byId = (id) => document.getElementById(id);
const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// ---------- Home ----------

function renderHome() {
  const saved = savedGame();
  const cont = byId("continue-btn");
  cont.hidden = !saved;
  if (saved) {
    const moves = Math.ceil(saved.moves.length / 2);
    const bot = botById(saved.level) || BOTS[0];
    cont.innerHTML = `<span class="continue-emoji" aria-hidden="true">${bot.emoji}</span><span class="continue-text"><strong>Continue your game</strong><br>vs ${bot.name} the ${bot.kind} · ${moves ? `move ${moves}` : "just started"}</span><span class="continue-go" aria-hidden="true">➜</span>`;
  }
  const friend = savedFriendGame();
  const contFriend = byId("continue-friend-btn");
  contFriend.hidden = !friend;
  if (friend) {
    const moves = Math.ceil(friend.moves.length / 2);
    contFriend.innerHTML = `<span class="continue-emoji" aria-hidden="true">👥</span><span class="continue-text"><strong>Continue the two-player game</strong><br>${escapeHtml(friend.names?.w || "White")} vs ${escapeHtml(friend.names?.b || "Black")} · ${moves ? `move ${moves}` : "just started"}</span><span class="continue-go" aria-hidden="true">➜</span>`;
  }

  const online = savedOnlineGame();
  const contOnline = byId("continue-online-btn");
  contOnline.hidden = !online;
  if (online) contOnline.innerHTML = `<span class="continue-emoji" aria-hidden="true">🌐</span><span class="continue-text"><strong>Continue your online game</strong><br>Game code ${escapeHtml(online.code)}</span><span class="continue-go" aria-hidden="true">➜</span>`;

  // Daily puzzle.
  const today = dateKey();
  byId("daily-date").textContent = new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const daily = dailyPuzzle(today);
  const done = dailyRecord()[today]?.puzzle;
  const { streak, freezes } = dailyStreak(today);
  const set = daily && SETS.find((s) => s.id === daily.kind);
  byId("daily-status").textContent = !daily ? "Puzzles are loading…" : done ? `Solved! ${done.mistakes ? "" : "First try. "}A new puzzle arrives tomorrow.` : `Today: ${set.title}. ${set.goal}`;
  if (done && onlineConfigured()) {
    // Add today's anonymous stats once they arrive (without counting this device again).
    dailyStats(today, false, { record: false }).then((stats) => {
      const line = statsLine(stats);
      if (line && dateKey() === today) byId("daily-status").textContent = `Solved! ${line}`;
    });
  }
  byId("daily-btn").textContent = done ? "Play again" : "Solve";
  byId("daily-btn").disabled = !daily;
  byId("daily-streak").textContent = streak ? `🔥 ${streak}-day streak${freezes ? ` · 🧊 ${freezes}` : ""}` : "Solve daily to build a streak";

  // Learn.
  const progress = lessonProgress();
  const doneCount = ALL_LESSONS.filter((l) => progress[l.id]).length;
  const next = nextLesson();
  byId("learn-bar").style.width = `${(doneCount / ALL_LESSONS.length) * 100}%`;
  byId("learn-summary").textContent = `${doneCount} of ${ALL_LESSONS.length} lessons`;
  byId("learn-btn").textContent = doneCount === 0 ? "Start" : next ? "Continue" : "Review";
  // Brand-new players: point them at the first lesson.
  byId("start-here").hidden = doneCount > 0;
  byId("learn-card").classList.toggle("is-featured", doneCount === 0);

  // Challenges.
  const solved = solvedPuzzles();
  const total = SETS.reduce((n, s) => n + puzzleList(s.id).length, 0);
  const solvedCount = SETS.reduce((n, s) => n + (solved[s.id]?.length || 0), 0);
  byId("challenge-bar").style.width = total ? `${(solvedCount / total) * 100}%` : "0";
  byId("challenge-summary").textContent = total ? `${solvedCount} of ${total} solved` : "";

  // Achievements.
  const earned = earnedBadges() || {};
  const badgeCount = BADGES.filter((b) => earned[b.id]).length;
  byId("achievements-summary").textContent = badgeCount ? `${badgeCount} of ${BADGES.length} badges earned` : "Badges for the chess skills you learn";

  // Games.
  const games = readJson("games", {});
  const won = BOTS.filter((b) => botWins(games, b.id)).length;
  const nextBot = nextUpBot(games);
  byId("play-summary").textContent = !Object.keys(games).some(botById) ? `A full game of chess against ${BOTS.length} friendly bots. Who's your opponent?`
    : `Bot ladder: won against ${won} of ${BOTS.length}${nextBot ? ` · next up: ${nextBot.emoji} ${nextBot.name}` : " 🪜"}`;
}

// ---------- Learn ----------

function renderLearn() {
  const progress = lessonProgress();
  const next = nextLesson();
  let number = 0;
  byId("unit-list").innerHTML = UNITS.map((unit) => {
    const lessons = unit.lessons.map((lesson) => {
      number++;
      const p = progress[lesson.id];
      const isNext = next && next.id === lesson.id;
      const stars = p ? `<span class="lesson-stars" aria-label="${p.stars} of 3 stars">${"★".repeat(p.stars)}<span class="dim">${"★".repeat(3 - p.stars)}</span></span>` : isNext ? '<span class="lesson-next">Next</span>' : "";
      return `<button type="button" class="lesson-node${p ? " is-done" : ""}${isNext ? " is-next" : ""}" data-lesson="${lesson.id}">
        <span class="lesson-num" aria-hidden="true">${p ? "✓" : number}</span>
        <span class="lesson-text"><strong>${escapeHtml(lesson.title)}</strong><small>${lesson.tasks.length} task${lesson.tasks.length === 1 ? "" : "s"}</small></span>
        ${stars}
      </button>`;
    }).join("");
    const doneHere = unit.lessons.filter((l) => progress[l.id]).length;
    return `<section class="unit"><h3 class="unit-title"><span aria-hidden="true">${unit.emoji}</span> ${escapeHtml(unit.title)} <small>${doneHere}/${unit.lessons.length}</small></h3><div class="lesson-path">${lessons}</div></section>`;
  }).join("");
}
byId("unit-list").addEventListener("click", (e) => {
  const id = e.target.closest("[data-lesson]")?.dataset.lesson;
  if (id) startLesson(id);
});

// ---------- Challenges ----------

function renderChallenges() {
  const tiers = ["Beginner", "Intermediate"];
  const drill = `<button type="button" class="set-card drill-card" id="drill-btn">
      <span class="set-emoji" aria-hidden="true">⚡</span>
      <span class="set-text"><strong>Speed drill</strong><small>As many puzzles as you can in 3 minutes</small></span>
      <span class="set-count" aria-hidden="true">➜</span>
    </button>`;
  byId("set-list").innerHTML = drill + tiers.map((tier) => `<h3 class="tier-title">${tier}</h3>` + SETS.filter((s) => s.tier === tier).map((set) => {
    const status = setStatus(set.id);
    const { total, solved: count } = status;
    const badge = status.perfect ? "👑 " : status.complete ? "✓ " : "";
    const note = status.perfect ? "Perfect: every one on the first try" : status.complete ? `Complete · ${status.clean}/${total} on the first try` : set.goal;
    return `<button type="button" class="set-card${status.complete ? " is-complete" : ""}" data-set="${set.id}" ${total ? "" : "disabled"}>
      <span class="set-emoji" aria-hidden="true">${set.emoji}</span>
      <span class="set-text"><strong>${set.title}</strong><small>${note}</small>
        <span class="progress-bar small" aria-hidden="true"><span style="width:${total ? (count / total) * 100 : 0}%"></span></span></span>
      <span class="set-count">${badge}${count}/${total}</span>
    </button>`;
  }).join("")).join("") + renderBosses();
}

function renderBosses() {
  const progress = bossProgress();
  const card = (b, best) => {
    const p = progress[b.id];
    const stars = p?.stars || 0;
    return `<button type="button" class="set-card${stars === 3 ? " is-complete" : ""}" data-boss="${b.id}">
      <span class="set-emoji" aria-hidden="true">${b.emoji}</span>
      <span class="set-text"><strong>${b.title}</strong><small>${b.text}${p ? ` · Best: ${best(p)}` : ""}</small></span>
      <span class="set-count" aria-label="${stars} of 3 stars">${"⭐".repeat(stars)}${"☆".repeat(3 - stars)}</span>
    </button>`;
  };
  return `<h3 class="tier-title">Opening bosses</h3>` + OPENING_BOSSES.map((b) => card(b, (p) => `${p.best} of 4 checks`)).join("")
    + `<h3 class="tier-title">Endgame bosses</h3>` + BOSSES.map((b) => card(b, (p) => `${p.best} moves`)).join("");
}
byId("set-list").addEventListener("click", (e) => {
  if (e.target.closest("#drill-btn")) { openDrillPicker(); return; }
  const boss = e.target.closest("[data-boss]")?.dataset.boss;
  if (boss) { startBoss(boss); return; }
  const id = e.target.closest("[data-set]")?.dataset.set;
  if (!id) return;
  if (setStatus(id).complete) openSetMenu(id);
  else startSet(id);
});

let setMenuKind = null;

/** A finished set: retry the misses, practice shuffled, or a speed drill. */
function openSetMenu(kind) {
  const set = SETS.find((s) => s.id === kind);
  const status = setStatus(kind);
  setMenuKind = kind;
  byId("set-heading").textContent = `${status.perfect ? "👑" : set.emoji} ${set.title}`;
  byId("set-summary").textContent = status.perfect
    ? `Perfect! All ${status.total} solved on the first try.`
    : `Complete! ${status.clean} of ${status.total} solved on the first try. Get the rest on the first try to earn the 👑 crown.`;
  const missed = status.missed.length;
  byId("set-retry").hidden = !missed;
  byId("set-retry").innerHTML = `🎯 Retry missed (${missed})<small>The ones that took more than one try</small>`;
  const best = drillBests()[kind];
  byId("set-drill").innerHTML = `⚡ Speed drill<small>${best ? `Your best: ${best}` : "3 minutes, 3 lives"}</small>`;
  openOverlay("set-overlay", { focus: missed ? "#set-retry" : "#set-practice" });
}
byId("set-retry").addEventListener("click", () => { const k = setMenuKind; closeTopThen(() => startRetry(k)); });
byId("set-practice").addEventListener("click", () => { const k = setMenuKind; closeTopThen(() => startPractice(k)); });
byId("set-drill").addEventListener("click", () => { const k = setMenuKind; closeTopThen(() => startDrill(k)); });

function openDrillPicker() {
  const bests = drillBests();
  byId("drill-list").innerHTML = SETS.filter((s) => puzzleList(s.id).length).map((s) =>
    `<button type="button" class="menu-item" data-drill="${s.id}">${s.emoji} ${s.title}<small>${s.tier}${bests[s.id] ? ` · Best: ${bests[s.id]}` : ""}</small></button>`).join("");
  openOverlay("drill-overlay", { focus: "[data-drill]" });
}
byId("drill-list").addEventListener("click", (e) => {
  const id = e.target.closest("[data-drill]")?.dataset.drill;
  if (id) closeTopThen(() => startDrill(id));
});

// ---------- Rulebook ----------

function renderRules() {
  const groups = [...new Set(RULES.map((r) => r.group))];
  byId("rules-index").innerHTML = RULES.map((r) => `<a href="#rule-${r.id}" data-rule-link="${r.id}">${escapeHtml(r.title)}</a>`).join("");
  byId("rules-list").innerHTML = groups.map((group) => `<h3 class="rules-group" data-group="${group}">${group}</h3>` + RULES.filter((r) => r.group === group).map((rule) => `
    <article class="rule-card" id="rule-${rule.id}" data-rule="${rule.id}" data-search="${escapeHtml(`${rule.title} ${rule.text.join(" ")} ${rule.keywords || ""}`.toLowerCase())}" data-group-of="${group}">
      <h4>${escapeHtml(rule.title)}</h4>
      ${rule.text.map((p) => `<p>${escapeHtml(p)}</p>`).join("")}
      ${(rule.examples || []).map((ex) => `<figure class="rule-example">${miniBoard(ex.fen, ex.highlight || [])}${ex.caption ? `<figcaption>${escapeHtml(ex.caption)}</figcaption>` : ""}</figure>`).join("")}
    </article>`).join("")).join("");
}
byId("rules-search").addEventListener("input", (e) => {
  const words = e.target.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
  let shown = 0;
  for (const card of document.querySelectorAll(".rule-card")) {
    const match = words.every((w) => card.dataset.search.includes(w));
    card.hidden = !match;
    if (match) shown++;
  }
  for (const h of document.querySelectorAll(".rules-group")) {
    h.hidden = ![...document.querySelectorAll(`.rule-card[data-group-of="${h.dataset.group}"]`)].some((c) => !c.hidden);
  }
  byId("rules-index").hidden = words.length > 0;
  byId("rules-empty").hidden = shown > 0;
});
byId("rules-index").addEventListener("click", (e) => {
  const id = e.target.closest("[data-rule-link]")?.dataset.ruleLink;
  if (!id) return;
  e.preventDefault(); // keep the URL (and history) clean for the Back gesture
  byId(`rule-${id}`).scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
});

function openRules() {
  byId("rules-search").value = "";
  byId("rules-search").dispatchEvent(new Event("input"));
  openScreen("rules");
}

// ---------- New game ----------

const DEFAULT_GAME = { level: "pip", color: "w", coach: true, undo: true, hints: true };
let gameChoice = { ...DEFAULT_GAME, ...readJson("gamePrefs", {}) };

// The opponent picker: one row of bot faces, in tier groups (Beginner, Intermediate, …), easiest
// first. Every bot is open; "Next up" marks the next step on the ladder. If more bots are added the
// row scrolls sideways, and it opens scrolled to the chosen bot.
function renderNewGame() {
  const games = readJson("games", {});
  if (!botById(gameChoice.level)) gameChoice.level = BOTS[0].id;
  const next = nextUpBot(games);
  const groups = [...new Set(BOTS.map((b) => b.group))];
  byId("bot-picker").innerHTML = groups.map((group) => `<div class="bot-group" role="group" aria-label="${group}">
      <span class="bot-group-label" aria-hidden="true">${group}</span>
      <div class="bot-group-row">${BOTS.filter((b) => b.group === group).map((b) => {
        const won = botWins(games, b.id) > 0;
        const isNext = next?.id === b.id;
        const label = `${b.name} the ${b.kind}, ${group}${won ? ", won" : ""}${isNext ? ", next up" : ""}`;
        return `<button type="button" role="radio" class="bot-chip${isNext ? " is-next" : ""}" data-bot="${b.id}" aria-checked="${b.id === gameChoice.level}" aria-label="${label}">
          <span class="bot-face" aria-hidden="true">${b.emoji}${won ? '<span class="bot-star">⭐</span>' : ""}</span>
          <span class="bot-name" aria-hidden="true">${b.name}</span>
          ${isNext ? '<span class="bot-next" aria-hidden="true">Next</span>' : ""}
        </button>`;
      }).join("")}</div>
    </div>`).join("");
  const bot = botById(gameChoice.level);
  const index = BOTS.indexOf(bot);
  const record = games[bot.id];
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : word.endsWith("s") ? "es" : "s"}`;
  byId("bot-about").innerHTML = `<strong>${bot.emoji} ${bot.name} the ${bot.kind}</strong> · ${bot.about}`
    + `<small>${bot.group} · ${index + 1} of ${BOTS.length}${next?.id === bot.id ? " · Next up on the ladder" : ""}</small>`
    + `<small>${bot.plays}</small>`
    + `<small>${record ? `You: ${plural(record.w, "win")} · ${plural(record.l, "loss")}${record.d ? ` · ${plural(record.d, "draw")}` : ""}` : "You haven't played yet."}</small>`;
  // Keep the chosen bot in view when the row scrolls.
  byId("bot-picker").querySelector('[aria-checked="true"]')?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  for (const b of document.querySelectorAll("#color-options [data-color]")) b.setAttribute("aria-pressed", String(b.dataset.color === gameChoice.color));
  byId("opt-coach").checked = gameChoice.coach;
  byId("opt-undo").checked = gameChoice.undo;
  byId("opt-hints").checked = gameChoice.hints;
}
function chooseBot(id) {
  const bot = botById(id);
  // Help starts on for the easier bots and off for the harder ones; the player can change it.
  gameChoice = { ...gameChoice, level: bot.id, coach: bot.helpers, undo: bot.helpers, hints: bot.helpers };
}
byId("bot-picker").addEventListener("click", (e) => {
  const chip = e.target.closest("[data-bot]");
  if (!chip) return;
  chooseBot(chip.dataset.bot);
  renderNewGame();
});

// The one-time question: asked the first time Play the computer opens, unless this player has
// already played a bot or picked one. It only picks the starting bot.
byId("botstart-options").innerHTML = BOT_START.map((a) => {
  const bot = botById(a.bot);
  return `<button type="button" class="set-card" data-start="${a.id}"><span class="set-emoji" aria-hidden="true">${bot.emoji}</span><span class="set-text"><strong>${a.label}</strong><small>Start with ${bot.name} the ${bot.kind}</small></span></button>`;
}).join("");
const needsBotStart = () => !readJson("botStart", null) && !readJson("gamePrefs", null) && !Object.keys(readJson("games", {})).some(botById);
function answerBotStart(answer) {
  writeJson("botStart", answer?.id || "skipped");
  if (answer) chooseBot(answer.bot);
  closeTopThen(() => openNewGame());
}
byId("botstart-options").addEventListener("click", (e) => {
  const id = e.target.closest("[data-start]")?.dataset.start;
  if (id) answerBotStart(BOT_START.find((a) => a.id === id));
});
byId("botstart-skip").addEventListener("click", () => answerBotStart(null));
byId("color-options").addEventListener("click", (e) => {
  const color = e.target.closest("[data-color]")?.dataset.color;
  if (color) { gameChoice.color = color; renderNewGame(); }
});
for (const [id, key] of [["opt-coach", "coach"], ["opt-undo", "undo"], ["opt-hints", "hints"]]) {
  byId(id).addEventListener("change", (e) => { gameChoice[key] = e.target.checked; });
}
byId("start-game-btn").addEventListener("click", () => {
  writeJson("gamePrefs", gameChoice);
  const choice = { ...gameChoice };
  closeTopThen(() => newGame(choice));
});
function openNewGame(kind = "bot") {
  if (kind === "friend") { openFriendGame(); return; }
  if (needsBotStart()) { openOverlay("botstart-overlay", { focus: "#botstart-options button" }); return; }
  const last = readJson("gamePrefs", {}).level;
  if (last && last !== gameChoice.level && botById(last)) chooseBot(last);
  renderNewGame();
  openOverlay("newgame-overlay", { focus: "#start-game-btn" });
}

// ---------- Two players ----------

const DEFAULT_FRIEND = { names: { w: "", b: "" }, autoFlip: true, undo: true };
function openFriendGame() {
  const prefs = { ...DEFAULT_FRIEND, ...readJson("friendPrefs", {}) };
  byId("name-w").value = prefs.names.w || "";
  byId("name-b").value = prefs.names.b || "";
  byId("opt-autoflip").checked = prefs.autoFlip;
  byId("opt-friend-undo").checked = prefs.undo;
  openOverlay("friend-overlay", { focus: "#start-friend-btn" });
}
byId("swap-names").addEventListener("click", () => {
  const w = byId("name-w").value;
  byId("name-w").value = byId("name-b").value;
  byId("name-b").value = w;
});
byId("name-w").addEventListener("keydown", (e) => { if (e.key === "Enter") byId("name-b").focus(); });
byId("name-b").addEventListener("keydown", (e) => { if (e.key === "Enter") byId("start-friend-btn").click(); });
byId("start-friend-btn").addEventListener("click", () => {
  // Names only ever appear on this device, but keep them to plain text anyway.
  const plain = (text) => text.replace(/[<>&"'`]/g, "").trim();
  const typed = { w: plain(byId("name-w").value), b: plain(byId("name-b").value) };
  const prefs = { names: typed, autoFlip: byId("opt-autoflip").checked, undo: byId("opt-friend-undo").checked };
  writeJson("friendPrefs", prefs);
  const names = { w: typed.w || "White", b: typed.b || "Black" };
  if (names.w === names.b) { names.w += " (W)"; names.b += " (B)"; }
  closeTopThen(() => newFriendGame({ ...prefs, names }));
});

// ---------- Online ----------

let onlineColor = readJson("onlineColor", "random");
let onlineMinutes = readJson("onlineClock", 0);
let onlineAvatar = readJson("onlineAvatar", AVATARS[0]);
byId("avatar-options").innerHTML = AVATARS.map((a) => `<button type="button" data-avatar="${a}" aria-label="Avatar ${a}">${a}</button>`).join("");

/** "You 3 – 2 · 1 draw" for a friend's card, or "No games yet". */
function recordLine(record) {
  if (!record || !(record.w + record.l + record.d)) return "No games yet";
  return `${record.w} win${record.w === 1 ? "" : "s"} · ${record.l} loss${record.l === 1 ? "" : "es"}${record.d ? ` · ${record.d} draw${record.d === 1 ? "" : "s"}` : ""}`;
}

function renderOnline() {
  for (const b of document.querySelectorAll("[data-avatar]")) b.setAttribute("aria-pressed", String(b.dataset.avatar === onlineAvatar));
  for (const b of document.querySelectorAll("[data-online-color]")) b.setAttribute("aria-pressed", String(b.dataset.onlineColor === onlineColor));
  for (const b of document.querySelectorAll("[data-clock-minutes]")) b.setAttribute("aria-pressed", String(Number(b.dataset.clockMinutes) === onlineMinutes));
  const list = friends();
  byId("friends-section").hidden = !list.length;
  const records = friendRecords();
  byId("friend-list").innerHTML = list.map((f) => `<li><span class="friend-avatar" aria-hidden="true">${AVATARS[f.avatar] || "🙂"}</span><span class="friend-name">${escapeHtml(f.name)}<small class="friend-record">${recordLine(records[f.id])}</small></span><button type="button" class="primary" data-challenge="${f.id}">Challenge</button><button type="button" class="friend-remove" data-unfriend="${f.id}" aria-label="Remove ${escapeHtml(f.name)}">✕</button></li>`).join("");
}
byId("online-clock").addEventListener("click", (e) => {
  const minutes = e.target.closest("[data-clock-minutes]")?.dataset.clockMinutes;
  if (minutes === undefined) return;
  onlineMinutes = Number(minutes);
  writeJson("onlineClock", onlineMinutes);
  renderOnline();
});
byId("friend-list").addEventListener("click", async (e) => {
  const remove = e.target.closest("[data-unfriend]")?.dataset.unfriend;
  if (remove) {
    const gone = friends().find((f) => f.id === remove);
    saveFriends(friends().filter((f) => f.id !== remove));
    forgetFriendRecord(remove);
    renderOnline();
    if (gone) toast(`${gone.name} removed`);
    return;
  }
  const id = e.target.closest("[data-challenge]")?.dataset.challenge;
  const friend = id && friends().find((f) => f.id === id);
  if (!friend) return;
  onlineError("");
  setOnlineBusy(true);
  try {
    const backend = await readyBackend();
    const color = onlineColor === "random" ? (Math.random() < 0.5 ? "w" : "b") : onlineColor;
    const code = await withTimeout(backend.create({ color, avatar: onlineAvatar, minutes: onlineMinutes }), TIMEOUT_MS);
    if (!(await withTimeout(backend.invite(friend.id, code), TIMEOUT_MS))) throw new Error("invite");
    backend.setFriendPair(code, friend.id); // the game carries the link, so both devices can line up on it
    closeTopThen(() => openOnlineGame(code, color, { friendName: friend.name, inviteId: friend.id }));
  } catch (error) {
    onlineError(errorText(error));
    setOnlineBusy(false);
  }
});
function onlineError(text) {
  byId("online-error").textContent = text || "";
  byId("online-error").hidden = !text;
}
let onlineBusy = false;
function setOnlineBusy(busy) {
  onlineBusy = busy;
  const off = busy || isOffline();
  byId("online-create").disabled = off;
  byId("online-join").disabled = off;
  for (const b of document.querySelectorAll("[data-challenge]")) b.disabled = off;
}
// Offline: say so in the online pop-up and disable its buttons until the connection is back.
onConnectionChange((offline) => {
  byId("online-offline").hidden = !offline;
  if (offline) onlineError("");
  setOnlineBusy(onlineBusy);
});
const OFFLINE_ERROR = "You're offline. Online play needs the internet.";
const TIMEOUT_MS = 10000;
/** The backend, or an error the pop-up can show (offline, can't connect). */
async function readyBackend() {
  if (isOffline()) throw new Error("offline");
  return withTimeout(getBackend(), TIMEOUT_MS);
}
const errorText = (error) => (error?.message === "offline" ? OFFLINE_ERROR : CONNECT_ERROR);

// ---------- Challenges from friends (shown on Home) ----------
// With friends saved, the app listens to their private friend links; a fresh challenge (less
// than 30 minutes old, not from this device) shows as a card on Home.
const invites = new Map(); // friend link id → its latest value
const watched = new Map(); // friend link id → stop function
let inviteBackend = null;

async function watchFriends() {
  const list = friends();
  for (const [id, stop] of watched) if (!list.some((f) => f.id === id)) { stop(); watched.delete(id); invites.delete(id); }
  if (!list.length || !onlineConfigured()) { renderInvite(); return; }
  try {
    inviteBackend = await getBackend();
  } catch {
    return; // offline: try again when the app comes back
  }
  for (const f of list) {
    if (!watched.has(f.id)) watched.set(f.id, inviteBackend.watchPair(f.id, (value) => { invites.set(f.id, value); renderInvite(); }));
  }
}

function currentInvite() {
  if (!inviteBackend) return null;
  const dismissed = readJson("dismissedInvites", []);
  const now = inviteBackend.serverNow();
  let best = null;
  for (const [id, value] of invites) {
    const inv = value?.invite;
    const friend = friends().find((f) => f.id === id);
    if (!inv || !friend || inv.by === inviteBackend.uid || now - inv.at > INVITE_FRESH_MS || dismissed.includes(inv.code)) continue;
    if (savedOnlineGame()?.code === inv.code) continue;
    if (!best || inv.at > best.at) best = { ...inv, id, friend };
  }
  return best;
}

function renderInvite() {
  const inv = currentInvite();
  byId("invite-card").hidden = !inv;
  if (!inv) return;
  byId("invite-avatar").textContent = AVATARS[inv.friend.avatar] || "🙂";
  byId("invite-text").textContent = `${inv.friend.name} challenged you to a game!`;
  if (byId("invite-card").dataset.code !== inv.code) alertPlayer("A friend challenged you", `${inv.friend.name} wants to play. Tap to open Chess Quest.`);
  byId("invite-card").dataset.code = inv.code;
  popInvite(inv);
}

function dismissInvite(code) {
  writeJson("dismissedInvites", [code, ...readJson("dismissedInvites", [])].slice(0, 20));
  renderInvite();
}

/** Joins the friend's challenge that's showing. `button` is disabled while it connects. */
async function joinInvite(button) {
  const inv = currentInvite();
  if (!inv) { toast("That challenge isn't available any more."); return; }
  if (isOffline()) { toast(OFFLINE_ERROR); return; }
  if (button) button.disabled = true;
  try {
    const { color } = await withTimeout(inviteBackend.join(inv.code, onlineAvatar), TIMEOUT_MS);
    inviteBackend.clearInvite(inv.id);
    dismissInvite(inv.code);
    await openOnlineGame(inv.code, color, { friendName: inv.friend.name, friendId: inv.friend.id });
  } catch (error) {
    if (error?.message === "timeout") { toast(CONNECT_ERROR); return; }
    dismissInvite(inv.code);
    toast("That challenge isn't available any more.");
  } finally {
    if (button) button.disabled = false;
  }
}
byId("invite-join").addEventListener("click", () => joinInvite(byId("invite-join")));
byId("challenge-join").addEventListener("click", () => closeTopThen(() => joinInvite(null)));

// A new challenge pops up wherever the player is (once per challenge), not only on Home's card.
// During a game it's a banner instead, so the game isn't covered.
const poppedInvites = new Set();
function popInvite(inv) {
  if (poppedInvites.has(inv.code)) return;
  if (currentScreen() === "play") {
    poppedInvites.add(inv.code);
    pushBanner({
      html: `<strong>${AVATARS[inv.friend.avatar] || "🙂"} ${escapeHtml(inv.friend.name)} challenged you!</strong><small>Tap to see the challenge.</small>`,
      onTap: () => backToHome(() => showChallengePopup()),
      ms: 20000,
      coach: false,
    });
    return;
  }
  if (document.querySelector(".overlay:not([hidden])")) return; // don't stack pop-ups: try again soon
  poppedInvites.add(inv.code);
  showChallengePopup();
}
function showChallengePopup() {
  const inv = currentInvite();
  if (!inv || !byId("challenge-overlay").hidden) return;
  byId("challenge-avatar").textContent = AVATARS[inv.friend.avatar] || "🙂";
  byId("challenge-text").textContent = `${inv.friend.name} challenged you to a game!`;
  openOverlay("challenge-overlay", { focus: "#challenge-join" });
}
byId("invite-later").addEventListener("click", () => {
  const code = byId("invite-card").dataset.code;
  if (code) dismissInvite(code);
});
setInterval(renderInvite, 30000); // challenges expire after 30 minutes

function openOnline(code = "") {
  const ready = onlineConfigured();
  byId("online-unavailable").hidden = ready;
  byId("online-setup").hidden = !ready;
  byId("online-code").value = code;
  onlineError("");
  setOnlineBusy(false);
  renderOnline();
  openOverlay("online-overlay", { focus: code ? "#online-join" : "#online-create" });
  // Tidy up old games while we're here (best effort).
  if (ready) getBackend().then((b) => b?.sweep()).catch(() => {});
}

byId("avatar-options").addEventListener("click", (e) => {
  const avatar = e.target.closest("[data-avatar]")?.dataset.avatar;
  if (!avatar) return;
  onlineAvatar = avatar;
  writeJson("onlineAvatar", avatar);
  renderOnline();
});
byId("online-color").addEventListener("click", (e) => {
  const color = e.target.closest("[data-online-color]")?.dataset.onlineColor;
  if (!color) return;
  onlineColor = color;
  writeJson("onlineColor", color);
  renderOnline();
});

const CONNECT_ERROR = "Couldn't connect. Check your internet connection and try again.";

byId("online-create").addEventListener("click", async () => {
  onlineError("");
  setOnlineBusy(true);
  try {
    const backend = await readyBackend();
    const color = onlineColor === "random" ? (Math.random() < 0.5 ? "w" : "b") : onlineColor;
    const code = await withTimeout(backend.create({ color, avatar: onlineAvatar, minutes: onlineMinutes }), TIMEOUT_MS);
    closeTopThen(() => openOnlineGame(code, color));
  } catch (error) {
    onlineError(errorText(error));
    setOnlineBusy(false);
  }
});

async function joinOnline() {
  const code = cleanCode(byId("online-code").value);
  if (!code) { onlineError("A game code has 6 letters and numbers, like K7QF2M."); return; }
  onlineError("");
  setOnlineBusy(true);
  try {
    const backend = await readyBackend();
    const { color } = await withTimeout(backend.join(code, onlineAvatar), TIMEOUT_MS);
    closeTopThen(() => openOnlineGame(code, color));
  } catch (error) {
    onlineError(error?.message === "not-found" ? "There's no game with that code. Check it, or ask for a new one."
      : error?.message === "full" ? "That game already has two players." : errorText(error));
    setOnlineBusy(false);
  }
}
byId("online-join").addEventListener("click", joinOnline);
byId("online-code").addEventListener("keydown", (e) => { if (e.key === "Enter") joinOnline(); });

// ---------- Settings ----------

function applySettings() {
  const s = getSettings();
  document.documentElement.classList.toggle("large-text", s.largeText);
  document.documentElement.dataset.board = s.board;
  document.documentElement.classList.toggle("no-coords", !s.coordinates);
  for (const input of document.querySelectorAll("[data-setting]")) input.checked = Boolean(s[input.dataset.setting]);
  for (const b of document.querySelectorAll("[data-board-choice]")) b.setAttribute("aria-pressed", String(b.dataset.boardChoice === s.board));
  const theme = readJson("theme", "auto");
  for (const b of document.querySelectorAll("[data-theme-choice]")) b.setAttribute("aria-pressed", String(b.dataset.themeChoice === theme));
}

function applyTheme() {
  const pref = readJson("theme", "auto");
  const dark = pref === "dark" || (pref === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]').content = dark ? "#0f1f19" : "#1f5c45";
}

for (const input of document.querySelectorAll("[data-setting]")) {
  input.addEventListener("change", () => { updateSettings({ [input.dataset.setting]: input.checked }); renderNotifyButton(); });
}
byId("board-options").addEventListener("click", (e) => {
  const choice = e.target.closest("[data-board-choice]")?.dataset.boardChoice;
  if (choice) updateSettings({ board: choice });
});
byId("theme-options").addEventListener("click", (e) => {
  const choice = e.target.closest("[data-theme-choice]")?.dataset.themeChoice;
  if (!choice) return;
  writeJson("theme", choice);
  applyTheme();
  applySettings();
});
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", applyTheme);
onSettingsChange(applySettings);

// ---------- Wiring ----------

byId("settings-btn").addEventListener("click", () => { renderNotifyButton(); openOverlay("settings-overlay"); });

/** The Settings button for "Your move" notifications, which shows whether they're allowed. */
function renderNotifyButton() {
  const btn = byId("notify-btn");
  const state = notificationPermission();
  btn.hidden = state === "unsupported" || !setting("turnAlerts");
  btn.disabled = state !== "default";
  btn.textContent = state === "granted" ? "🔔 Notifications are on" : state === "denied" ? "🔕 Notifications are blocked in this browser's site settings" : "🔔 Also show a notification";
}
byId("notify-btn").addEventListener("click", async () => {
  await enableNotifications();
  renderNotifyButton();
});
// Share the app: the phone's share sheet with a link to the website, where people can open it
// and install it. Without a share sheet (most computers), the link is copied instead.
const APP_URL = new URL("./", location.href).href;
byId("share-app-btn").addEventListener("click", async () => {
  const text = "Learn chess, solve puzzles and play friends with Chess Quest. Free, and it works offline.";
  if (navigator.share) {
    try {
      await navigator.share({ title: "Chess Quest", text, url: APP_URL });
      return;
    } catch (error) {
      if (error?.name === "AbortError") return; // closed the share sheet
    }
  }
  try {
    await navigator.clipboard.writeText(APP_URL);
    toast("Link copied: paste it anywhere to share");
  } catch {
    toast(APP_URL);
  }
});

// Privacy opens on top of Settings; closing it returns to Settings.
byId("privacy-btn").addEventListener("click", () => openOverlay("privacy-overlay"));
byId("continue-btn").addEventListener("click", () => resumeGame("bot"));
byId("continue-friend-btn").addEventListener("click", () => resumeGame("friend"));
byId("friend-btn").addEventListener("click", () => openFriendGame());
byId("online-btn").addEventListener("click", () => openOnline());
byId("continue-online-btn").addEventListener("click", async () => {
  const saved = savedOnlineGame();
  if (!saved) return;
  try {
    await withTimeout(openOnlineGame(saved.code, saved.color, { friendId: saved.friendId || null }), TIMEOUT_MS);
  } catch (error) {
    toast(errorText(error));
  }
});
byId("new-game-btn").addEventListener("click", () => openNewGame("bot"));
byId("learn-btn").addEventListener("click", () => openScreen("learn"));
byId("challenges-btn").addEventListener("click", () => openScreen("challenges"));
byId("rules-btn").addEventListener("click", openRules);
byId("play-rules-btn").addEventListener("click", openRules);
byId("daily-btn").addEventListener("click", () => {
  const daily = dailyPuzzle();
  if (daily) startPuzzle(daily.kind, daily.index, { daily: dateKey() });
});

onScreenShown((id) => {
  if (id === "achievements") renderAchievements();
  if (id === "home") renderHome();
  if (id === "learn") renderLearn();
  if (id === "challenges") renderChallenges();
});
setGameHooks({ onChange: () => {}, onFinish: () => {} });
setNewGameOpener(openNewGame);
setLessonHooks({ onChange: () => {} });
setPuzzleHooks({ onChange: () => {} });
setOnlineHooks({ onChange: () => { watchFriends(); } });

// Browsers need a tap before sound can play.
addEventListener("pointerdown", unlockAudio, { capture: true });
addEventListener("keydown", unlockAudio, { capture: true });

// The daily puzzle changes at midnight; refresh Home when the app comes back.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && !byId("home").hidden) { renderHome(); watchFriends(); }
});

// ---------- Achievements ----------

let puzzlesReady = false;
const setSizes = () => Object.fromEntries(SETS.map((s) => [s.id, puzzleList(s.id).length]));

function runBadgeCheck() {
  if (!puzzlesReady) return; // set sizes are needed first
  const { fresh, first } = checkBadges(setSizes());
  if (first && fresh.length) {
    // Progress from before badges existed: one summary, not a flood.
    showBadgeBanner(`<strong>🏅 You've already earned ${fresh.length} badge${fresh.length === 1 ? "" : "s"}!</strong><small>${cheer()}Tap to see them.</small>`);
  } else {
    for (const badge of fresh) showBadgeBanner(`<strong>🏅 Badge earned: ${badge.emoji} ${badge.title}</strong><small>${cheer()}Tap to see all your badges.</small>`);
  }
  if (fresh.length) {
    if (currentScreen() === "home") renderHome();
    if (currentScreen() === "achievements") renderAchievements();
  }
}
/** The coach's cheer before the banner's instructions, or nothing with the coach turned off. */
const cheer = () => (setting("coach") ? `${coachLine("badge")} ` : "");
let badgeTimer = null;
addEventListener("chessquest:progress", () => {
  clearTimeout(badgeTimer);
  badgeTimer = setTimeout(runBadgeCheck, 600);
});

// The banner at the top: badges earned, and a friend's challenge during a game. Each entry:
// { html, onTap, ms, coach }.
const bannerQueue = [];
let bannerHide = null;
let bannerTap = null;
function pushBanner(entry) {
  bannerQueue.push(entry);
  if (byId("badge-banner").hidden) nextBanner();
}
function showBadgeBanner(html) {
  if (!setting("badgePopups")) return; // still earned: they're on the badge wall
  pushBanner({ html, onTap: openAchievements, ms: 6000, coach: true });
}
function nextBanner() {
  const banner = byId("badge-banner");
  clearTimeout(bannerHide);
  const entry = bannerQueue.shift();
  if (!entry) { banner.hidden = true; bannerTap = null; return; }
  byId("badge-banner-body").innerHTML = entry.html;
  bannerTap = entry.onTap;
  banner.classList.toggle("no-coach-banner", !entry.coach || !setting("coach"));
  banner.hidden = false;
  play("correct");
  bannerHide = setTimeout(nextBanner, entry.ms);
}
byId("badge-banner-close").addEventListener("click", nextBanner);
byId("badge-banner-body").addEventListener("click", () => {
  const tap = bannerTap;
  nextBanner();
  tap?.();
});
function openAchievements() {
  bannerQueue.splice(0, bannerQueue.length, ...bannerQueue.filter((e) => e.onTap !== openAchievements));
  if (currentScreen() === "achievements") return;
  // A pop-up (like "Lesson complete!") may be open: close it first, then show the badges.
  if (document.querySelector(".overlay:not([hidden])")) closeTopThen(() => openScreen("achievements"));
  else openScreen("achievements");
}

function renderAchievements() {
  const earned = earnedBadges() || {};
  const count = BADGES.filter((b) => earned[b.id]).length;
  document.querySelector("#achievements .coach-row").classList.toggle("no-coach", !setting("coach"));
  byId("achievements-intro").textContent = !setting("coach") ? `${count} of ${BADGES.length} badges earned.` : count === 0
    ? "Every badge here is a chess skill. Let's earn the first one together!"
    : count === BADGES.length
      ? "You've earned every badge. Bravo, champion!"
      : `You've earned ${count} of ${BADGES.length} badges. Each one is a skill you've learned!`;
  byId("badge-wall").innerHTML = BADGE_GROUPS.map((group) => {
    const list = BADGES.filter((b) => b.group === group);
    const got = list.filter((b) => earned[b.id]).length;
    return `<section class="badge-group"><h3>${group} · ${got} of ${list.length}</h3><div class="badge-grid">${list.map((b) => {
      const when = earned[b.id];
      return `<div class="badge ${when ? "is-earned" : "is-locked"}" data-badge="${b.id}">
        <span class="badge-emoji" aria-hidden="true">${b.emoji}</span>
        <span class="badge-title">${when ? "" : '<span class="visually-hidden">Locked: </span>'}${b.title}</span>
        <span class="badge-hint">${when ? `Earned ${new Date(when).toLocaleDateString()}` : b.hint}</span>
      </div>`;
    }).join("")}</div></section>`;
  }).join("");
}
byId("achievements-btn").addEventListener("click", () => openScreen("achievements"));
for (const id of ["achievements-coach", "tip-coach", "badge-banner-coach"]) byId(id).innerHTML = coachSvg(64, id === "achievements-coach" ? "cheer" : "happy");

async function start() {
  initOverlays();
  applyTheme();
  applySettings();
  byId("vibration-toggle").hidden = !hapticsAvailable();
  initInstall();
  renderHome();
  renderRules();
  await Promise.all([loadPieceSprite(), loadPuzzles()]);
  puzzlesReady = true;
  best("bestStreak", dailyStreak().streak);
  runBadgeCheck();
  renderHome();
  warmUp();
  watchFriends();
  refreshInstall();
  document.body.classList.add("is-ready");
  // A join link (…?join=K7QF2M) opens the online pop-up with the code filled in.
  const joinCode = cleanCode(new URLSearchParams(location.search).get("join"));
  if (joinCode || new URLSearchParams(location.search).has("join")) {
    history.replaceState(history.state, "", location.pathname);
    if (joinCode) openOnline(joinCode);
  }
  registerServiceWorker();
}

start();
