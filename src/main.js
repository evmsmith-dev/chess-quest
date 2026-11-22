// Chess Quest: Home, the Learn path, Challenges, the Rulebook, settings and new games.
// The board screen's three modes live in src/screens/ (game.js, lesson.js, puzzle.js).
import { initOverlays, openOverlay, openScreen, onScreenShown, closeTopThen } from "./ui/overlays.js";
import { registerServiceWorker } from "./ui/update.js";
import { initInstall, refreshInstall } from "./ui/install.js";
import { hapticsAvailable } from "./ui/haptics.js";
import { unlockAudio } from "./ui/audio.js";
import { loadPieceSprite } from "./ui/board.js";
import { getSettings, updateSettings, onSettingsChange } from "./lib/settings.js";
import { readJson, writeJson } from "./storage.js";
import { dateKey } from "./lib/random.js";
import { UNITS, ALL_LESSONS } from "./content/lessons.js";
import { RULES } from "./content/rules.js";
import { warmUp } from "./chess/bot.js";
import { miniBoard } from "./screens/boardscreen.js";
import { newGame, newFriendGame, resumeGame, savedGame, savedFriendGame, setGameHooks, setNewGameOpener } from "./screens/game.js";
import { startLesson, lessonProgress, nextLesson, setLessonHooks } from "./screens/lesson.js";
import { SETS, loadPuzzles, puzzleList, solvedPuzzles, startSet, startPuzzle, dailyPuzzle, dailyRecord, dailyStreak, setPuzzleHooks } from "./screens/puzzle.js";

const byId = (id) => document.getElementById(id);
const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// ---------- Home ----------

function renderHome() {
  const saved = savedGame();
  const cont = byId("continue-btn");
  cont.hidden = !saved;
  if (saved) {
    const moves = Math.ceil(saved.moves.length / 2);
    cont.innerHTML = `<span class="continue-emoji" aria-hidden="true">♟️</span><span class="continue-text"><strong>Continue your game</strong><br>vs ${saved.level === "beginner" ? "Beginner" : "Intermediate"} bot · ${moves ? `move ${moves}` : "just started"}</span><span class="continue-go" aria-hidden="true">➜</span>`;
  }
  const friend = savedFriendGame();
  const contFriend = byId("continue-friend-btn");
  contFriend.hidden = !friend;
  if (friend) {
    const moves = Math.ceil(friend.moves.length / 2);
    contFriend.innerHTML = `<span class="continue-emoji" aria-hidden="true">👥</span><span class="continue-text"><strong>Continue the two-player game</strong><br>${escapeHtml(friend.names?.w || "White")} vs ${escapeHtml(friend.names?.b || "Black")} · ${moves ? `move ${moves}` : "just started"}</span><span class="continue-go" aria-hidden="true">➜</span>`;
  }

  // Daily puzzle.
  const today = dateKey();
  byId("daily-date").textContent = new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const daily = dailyPuzzle(today);
  const done = dailyRecord()[today]?.puzzle;
  const { streak, freezes } = dailyStreak(today);
  const set = daily && SETS.find((s) => s.id === daily.kind);
  byId("daily-status").textContent = !daily ? "Puzzles are loading…" : done ? `Solved! ${done.mistakes ? "" : "First try. "}A new puzzle arrives tomorrow.` : `Today: ${set.title}. ${set.goal}`;
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

  // Challenges.
  const solved = solvedPuzzles();
  const total = SETS.reduce((n, s) => n + puzzleList(s.id).length, 0);
  const solvedCount = SETS.reduce((n, s) => n + (solved[s.id]?.length || 0), 0);
  byId("challenge-bar").style.width = total ? `${(solvedCount / total) * 100}%` : "0";
  byId("challenge-summary").textContent = total ? `${solvedCount} of ${total} solved` : "";

  // Games.
  const games = readJson("games", {});
  const parts = ["beginner", "intermediate"].filter((l) => games[l]).map((l) => `${l === "beginner" ? "🐣" : "🦉"} ${games[l].w}W ${games[l].l}L ${games[l].d}D`);
  byId("play-summary").textContent = parts.join(" · ") || "Beginner or Intermediate";
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
  const solved = solvedPuzzles();
  const tiers = ["Beginner", "Intermediate"];
  byId("set-list").innerHTML = tiers.map((tier) => `<h3 class="tier-title">${tier}</h3>` + SETS.filter((s) => s.tier === tier).map((set) => {
    const total = puzzleList(set.id).length;
    const count = solved[set.id]?.length || 0;
    return `<button type="button" class="set-card" data-set="${set.id}" ${total ? "" : "disabled"}>
      <span class="set-emoji" aria-hidden="true">${set.emoji}</span>
      <span class="set-text"><strong>${set.title}</strong><small>${set.goal}</small>
        <span class="progress-bar small" aria-hidden="true"><span style="width:${total ? (count / total) * 100 : 0}%"></span></span></span>
      <span class="set-count">${count}/${total}</span>
    </button>`;
  }).join("")).join("");
}
byId("set-list").addEventListener("click", (e) => {
  const id = e.target.closest("[data-set]")?.dataset.set;
  if (id) startSet(id);
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

const DEFAULT_GAME = { level: "beginner", color: "w", coach: true, undo: true, hints: true };
let gameChoice = { ...DEFAULT_GAME, ...readJson("gamePrefs", {}) };

function renderNewGame() {
  for (const b of document.querySelectorAll("#level-options [data-level]")) b.setAttribute("aria-pressed", String(b.dataset.level === gameChoice.level));
  for (const b of document.querySelectorAll("#color-options [data-color]")) b.setAttribute("aria-pressed", String(b.dataset.color === gameChoice.color));
  byId("opt-coach").checked = gameChoice.coach;
  byId("opt-undo").checked = gameChoice.undo;
  byId("opt-hints").checked = gameChoice.hints;
}
byId("level-options").addEventListener("click", (e) => {
  const level = e.target.closest("[data-level]")?.dataset.level;
  if (!level) return;
  // Help is on by default for Beginner and off for Intermediate; the player can change it.
  const beginner = level === "beginner";
  gameChoice = { ...gameChoice, level, coach: beginner, undo: beginner, hints: beginner };
  renderNewGame();
});
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
  const typed = { w: byId("name-w").value.trim(), b: byId("name-b").value.trim() };
  const prefs = { names: typed, autoFlip: byId("opt-autoflip").checked, undo: byId("opt-friend-undo").checked };
  writeJson("friendPrefs", prefs);
  const names = { w: typed.w || "White", b: typed.b || "Black" };
  if (names.w === names.b) { names.w += " (W)"; names.b += " (B)"; }
  closeTopThen(() => newFriendGame({ ...prefs, names }));
});

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
  input.addEventListener("change", () => updateSettings({ [input.dataset.setting]: input.checked }));
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

byId("settings-btn").addEventListener("click", () => openOverlay("settings-overlay"));
byId("continue-btn").addEventListener("click", () => resumeGame("bot"));
byId("continue-friend-btn").addEventListener("click", () => resumeGame("friend"));
byId("friend-btn").addEventListener("click", () => openFriendGame());
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
  if (id === "home") renderHome();
  if (id === "learn") renderLearn();
  if (id === "challenges") renderChallenges();
});
setGameHooks({ onChange: () => {}, onFinish: () => {} });
setNewGameOpener(openNewGame);
setLessonHooks({ onChange: () => {} });
setPuzzleHooks({ onChange: () => {} });

// Browsers need a tap before sound can play.
addEventListener("pointerdown", unlockAudio, { capture: true });
addEventListener("keydown", unlockAudio, { capture: true });

// The daily puzzle changes at midnight; refresh Home when the app comes back.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && !byId("home").hidden) renderHome();
});

async function start() {
  initOverlays();
  applyTheme();
  applySettings();
  byId("vibration-toggle").hidden = !hapticsAvailable();
  initInstall();
  renderHome();
  renderRules();
  await Promise.all([loadPieceSprite(), loadPuzzles()]);
  renderHome();
  warmUp();
  refreshInstall();
  document.body.classList.add("is-ready");
  registerServiceWorker();
}

start();
