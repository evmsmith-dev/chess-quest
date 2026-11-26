// Challenges and the daily puzzle: find the best move, then the next one, until the line ends.
import { Chess, targetsFor, animationFor, checkSquare, explainIllegal, piecesFromFen, PIECE_WORD } from "../chess/rules.js";
import { judgePuzzleMove, parseUci } from "../lib/tasks.js";
import { board, useMode, setTitle, setMessage, setControls, feelMove, choosePromotion, isPromotionMove, showResult } from "./boardscreen.js";
import { openScreen, currentScreen, backTo, backToHome } from "../ui/overlays.js";
import { readJson, writeJson } from "../storage.js";
import { recordDaily, streakInfo } from "../lib/progress.js";
import { dateKey, hashString } from "../lib/random.js";
import { play } from "../ui/audio.js";
import { buzz } from "../ui/haptics.js";
import { getBackend, onlineConfigured } from "../online/backend.js";

/**
 * Adds this solve to today's anonymous counts (once per device per day) and returns the counts:
 * { solved, firstTry } or null if they can't be fetched (offline, or online play not set up).
 */
export async function dailyStats(day, firstTry, { record = true } = {}) {
  if (!onlineConfigured()) return null;
  try {
    const backend = await getBackend();
    if (!backend) return null;
    if (record && readJson("statsSent", null) !== day) {
      if (await backend.recordDaily(day, firstTry)) writeJson("statsSent", day);
    }
    return await backend.readDaily(day);
  } catch {
    return null;
  }
}

/** "68% of players solved it on the first try (124 players)", or "" with too few to say. */
export function statsLine(stats) {
  if (!stats?.solved) return "";
  const pct = Math.round((100 * (stats.firstTry || 0)) / stats.solved);
  if (stats.solved === 1) return "You're the first to solve it today!";
  if (stats.solved === 2) return "You're one of the first two to solve it today!";
  return `${pct}% of players solved it on the first try (${stats.solved} players).`;
}

export const SETS = [
  { id: "mate1", title: "Mate in 1", tier: "Beginner", emoji: "♛", goal: "Find checkmate in one move." },
  { id: "hanging", title: "Free pieces", tier: "Beginner", emoji: "🎁", goal: "Win a piece that isn't protected." },
  { id: "mate2", title: "Mate in 2", tier: "Intermediate", emoji: "♚", goal: "Force checkmate in two moves." },
  { id: "fork", title: "Forks", tier: "Intermediate", emoji: "🍴", goal: "Attack two pieces at once and win one." },
  { id: "material", title: "Win material", tier: "Intermediate", emoji: "💰", goal: "Find the move that wins material." },
  { id: "pin", title: "Pins & skewers", tier: "Intermediate", emoji: "📌", goal: "Line up two enemy pieces with a pin or a skewer, and win one." },
  { id: "discovered", title: "Discovered attacks", tier: "Intermediate", emoji: "🔦", goal: "Move one piece to uncover an attack from another, and win material." },
  { id: "mate3", title: "Mate in 3", tier: "Intermediate", emoji: "3️⃣", goal: "Force checkmate in three moves." },
  { id: "defend", title: "Defend!", tier: "Intermediate", emoji: "🛡️", goal: "Your opponent is threatening something. Find the only move that saves you." },
];
export const DAILY_IDS = ["puzzle"];
const DAILY_ROTATION = ["mate2", "fork", "hanging", "material", "mate1"];
// From this day on the new sets join the rotation. A fixed date keeps every device (old version
// or new) on the same daily puzzle until then.
const ROTATION_2_FROM = "2026-12-01";
const DAILY_ROTATION_2 = ["mate2", "fork", "hanging", "pin", "material", "defend", "mate1", "discovered", "mate3"];

let puzzles = null;
let P = null;
let hooks = { onChange: () => {} };
export function setPuzzleHooks(h) { hooks = { ...hooks, ...h }; }

export async function loadPuzzles() {
  if (puzzles) return puzzles;
  try {
    puzzles = await (await fetch("data/puzzles.json")).json();
  } catch {
    puzzles = {};
  }
  return puzzles;
}
export const puzzleList = (kind) => puzzles?.[kind] || [];

/** Solved puzzle indexes per set: { mate1: [0, 3], … }. */
export const solvedPuzzles = () => readJson("puzzles", {});
/**
 * Puzzles solved on the first try (no mistakes, no hints), same shape. First-try solves weren't
 * recorded before this was added, so earlier solves count as first-try rather than as misses.
 */
export function cleanPuzzles() {
  const clean = readJson("puzzlesClean", null);
  if (clean) return clean;
  const legacy = solvedPuzzles();
  writeJson("puzzlesClean", legacy);
  return legacy;
}
/** Best speed-drill score per set: { mate1: 14, … }. */
export const drillBests = () => readJson("drillBest", {});

/** The set to suggest after finishing one: the learning path. */
export const NEXT_SET = { mate1: "hanging", hanging: "mate2", mate2: "fork", fork: "material", material: "pin", pin: "discovered", discovered: "mate3", mate3: "defend", defend: null };
export const DRILL_MS = 3 * 60 * 1000;
export const DRILL_LIVES = 3;

/** Where the player stands in a set. `missed` = puzzles not yet solved on the first try. */
export function setStatus(kind) {
  const total = puzzleList(kind).length;
  const solved = new Set(solvedPuzzles()[kind] || []);
  const clean = new Set(cleanPuzzles()[kind] || []);
  const missed = puzzleList(kind).map((_, i) => i).filter((i) => !clean.has(i));
  return { total, solved: solved.size, clean: clean.size, complete: total > 0 && solved.size >= total, perfect: total > 0 && clean.size >= total, missed };
}

function shuffled(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** A shuffled round of every puzzle in a finished set. */
export function startPractice(kind) {
  const order = shuffled(puzzleList(kind).map((_, i) => i));
  startRound(kind, "practice", order);
}

/** A round of the puzzles not yet solved on the first try. */
export function startRetry(kind) {
  const order = shuffled(setStatus(kind).missed);
  if (order.length) startRound(kind, "retry", order);
}

function startRound(kind, mode, order) {
  const round = { mode, queue: order.slice(1), total: order.length, done: 0, clean: 0 };
  startPuzzle(kind, order[0], { round });
}

/** Today's puzzle: the same on every device. */
export function dailyPuzzle(day = dateKey()) {
  const dayNumber = Math.round(new Date(`${day}T12:00:00`).getTime() / 86400000);
  const rotation = day >= ROTATION_2_FROM ? DAILY_ROTATION_2 : DAILY_ROTATION;
  const kind = rotation[((dayNumber % rotation.length) + rotation.length) % rotation.length];
  const list = puzzleList(kind).length ? puzzleList(kind) : puzzleList("mate1");
  if (!list.length) return null;
  const index = hashString(day) % list.length;
  return { kind: puzzleList(kind).length ? kind : "mate1", index, puzzle: list[index] };
}

export const dailyRecord = () => readJson("daily", {});
export const dailyStreak = (day = dateKey()) => streakInfo(dailyRecord(), day, DAILY_IDS);

/** Opens the next unsolved puzzle of a set (or the first). */
export function startSet(kind) {
  const solved = new Set(solvedPuzzles()[kind] || []);
  const list = puzzleList(kind);
  let index = list.findIndex((_, i) => !solved.has(i));
  if (index < 0) index = 0;
  startPuzzle(kind, index);
}

export function startPuzzle(kind, index, { daily = null, round = null, drill = null } = {}) {
  const puzzle = puzzleList(kind)[index];
  if (!puzzle) return;
  const set = SETS.find((s) => s.id === kind);
  P = { kind, index, puzzle, set, daily, round, drill, step: 0, mistakes: 0, hints: 0, token: 0, game: new Chess(puzzle.fen), locked: false };
  if (currentScreen() !== "play") openScreen("play", { onLeave: () => { if (P) P.token++; P = null; stopDrillTimer(); } });
  useMode(mode);
  const color = P.game.turn();
  P.color = color;
  if (drill) setTitle("⚡ Speed drill", drillLine(drill));
  else if (round) setTitle(set.title, `${round.mode === "retry" ? "Retry missed" : "Practice"} · ${round.done + 1} of ${round.total}`);
  else setTitle(daily ? "Daily puzzle" : set.title, daily ? `${set.title} · ${dateLabel(daily)}` : `${set.tier} · Puzzle ${index + 1} of ${puzzleList(kind).length}`);
  board.setOrientation(color);
  board.setPieces(piecesFromFen(puzzle.fen), { animate: false });
  board.setHighlights({ check: checkSquare(P.game) });
  board.setMovable(color);
  prompt();
  controls();
}

function dateLabel(day) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function prompt(extra = "") {
  const side = P.color === "w" ? "White" : "Black";
  setMessage(`${extra}<strong>${side} to move.</strong> ${P.set.goal}`);
}

function controls(done = false) {
  if (P.drill) {
    setControls([{ label: "⏹ Stop", id: "ctl-stop", onClick: () => endDrill(P.drill) }]);
    return;
  }
  if (done && P.round && !P.round.queue.length) {
    setControls([{ label: "Finish ➜", kind: "primary", id: "ctl-next", onClick: next }]);
    return;
  }
  if (done) {
    setControls(P.daily
      ? [{ label: "🏠 Home", onClick: () => backToHome() }, { label: "🎯 Challenges", kind: "primary", onClick: () => backToHome(() => document.getElementById("challenges-btn").click()) }]
      : [{ label: "↺ Again", onClick: () => startPuzzle(P.kind, P.index) }, { label: "Next ➜", kind: "primary", id: "ctl-next", onClick: next }]);
    return;
  }
  setControls([
    { label: "💡 Hint", id: "ctl-hint", onClick: hint },
    { label: "⇅ Flip", ariaLabel: "Flip the board", onClick: () => board.setOrientation(board.orientation === "w" ? "b" : "w") },
    ...(P.daily ? [] : [{ label: "Skip ➜", onClick: next }]),
  ]);
}

function next() {
  if (P.round) {
    const round = P.round;
    if (!P.locked) round.done++; // skipped
    if (round.queue.length) startPuzzle(P.kind, round.queue[0], { round: { ...round, queue: round.queue.slice(1) } });
    else finishRound(round);
    return;
  }
  const list = puzzleList(P.kind);
  const solved = new Set(solvedPuzzles()[P.kind] || []);
  // The next unsolved one; once the whole set is solved, simply the next in order.
  for (let k = 1; k <= list.length; k++) {
    const i = (P.index + k) % list.length;
    if (!solved.has(i)) { startPuzzle(P.kind, i); return; }
  }
  startPuzzle(P.kind, (P.index + 1) % list.length);
}

/** The end of a practice or retry round. */
function finishRound(round) {
  const { kind, set } = P;
  const status = setStatus(kind);
  const retry = round.mode === "retry";
  const all = round.clean === round.total;
  if (all) window.confetti?.({ particleCount: 90, spread: 70, origin: { y: 0.6 }, disableForReducedMotion: true });
  showResult({
    emoji: status.perfect ? "👑" : all ? "🌟" : "✅",
    title: retry ? "Retry round done!" : "Practice round done!",
    text: status.perfect ? `Every ${set.title} puzzle solved on the first try. You've earned the crown!`
      : retry ? `${status.missed.length ? `${status.missed.length} left to get on the first try.` : ""}` : "Nicely done.",
    stats: [["First try", `${round.clean} of ${round.total}`]],
    secondary: ["See the board", null],
    primary: ["Back to Challenges", () => backTo("challenges")],
  });
}

function hint() {
  if (!P || P.locked || P.drill) return;
  P.hints++;
  const expected = P.puzzle.line[P.step];
  const from = expected.slice(0, 2), to = expected.slice(2, 4);
  const piece = P.game.get(from);
  // First hint: which piece. Second: where it goes.
  if (P.hintStep !== P.step) {
    P.hintStep = P.step;
    board.setHighlights({ hint: [from], check: checkSquare(P.game) });
    setMessage(`💡 Look at your ${PIECE_WORD[piece.type]} on ${from}.`, "info");
  } else {
    board.setHighlights({ hint: [from, to], check: checkSquare(P.game) });
    setMessage(`💡 Move the ${PIECE_WORD[piece.type]} from ${from} to ${to}.`, "info");
  }
}

/** What to look for, after a wrong move: depends on the set and on how far into the line it is. */
function wrongTip() {
  const left = Math.ceil((P.puzzle.line.length - P.step) / 2); // the player's moves still to come
  if (["mate1", "mate2", "mate3"].includes(P.kind)) {
    return left === 1 ? "That isn't checkmate." : `That doesn't force checkmate in ${left}.`;
  }
  if (P.step > 0) return "Now take what you've won.";
  return {
    hanging: "Look for a piece you can take for free.",
    fork: "Look for a move that attacks two pieces at once.",
    material: "Look for a move that wins material.",
    pin: "Look for a bishop, rook or queen move that lines up two enemy pieces.",
    discovered: "Which of your pieces is standing in front of your own bishop, rook or queen?",
    defend: "That doesn't stop your opponent's threat. What do they want to play next?",
  }[P.kind] || "";
}

const mode = {
  getTargets(from) { return !P || P.locked ? [] : targetsFor(P.game, from); },
  async onMove(from, to) {
    if (!P) return;
    let promotion;
    if (isPromotionMove(board.pieces, from, to)) {
      promotion = await choosePromotion(P.color);
      if (!promotion) { board.setPieces(piecesFromFen(P.game.fen()), { animate: false }); return; }
    }
    const uci = from + to + (promotion || "");
    const verdict = judgePuzzleMove(P.puzzle, P.step, P.game.fen(), uci);
    const move = P.game.move({ from, to, promotion });
    board.setPieces(piecesFromFen(P.game.fen()), { moves: animationFor(move) });
    feelMove(move, P.game.inCheck());
    if (verdict === "wrong" && P.drill) { drillMiss(move); return; }
    if (verdict === "wrong") {
      P.mistakes++;
      P.locked = true;
      board.setMovable(null);
      board.setHighlights({ lastMove: [from, to], bad: to, check: checkSquare(P.game) });
      play("wrong");
      buzz("wrong");
      board.shake();
      setMessage(`❌ ${move.san} isn't it. ${wrongTip()} Try again!`, "bad");
      const token = P.token;
      setTimeout(() => {
        if (!P || P.token !== token) return;
        P.game.undo();
        board.setPieces(piecesFromFen(P.game.fen()), { moves: animationFor(move).map(([a, b]) => [b, a]) });
        board.setHighlights({ check: checkSquare(P.game) });
        P.locked = false;
        board.setMovable(P.color);
      }, 900);
      return;
    }
    if (verdict === "done" && P.drill) { drillHit(move); return; }
    if (verdict === "done") { solved(move); return; }
    // Correct: the other side replies, then it's the player's turn again.
    P.step += 2;
    P.locked = true;
    board.setMovable(null);
    board.setHighlights({ lastMove: [from, to], good: to });
    play("correct");
    setMessage(`✅ ${move.san}! Keep going…`, "good");
    const token = P.token;
    setTimeout(() => {
      if (!P || P.token !== token) return;
      const reply = P.game.move(parseUci(P.puzzle.line[P.step - 1]));
      board.setPieces(piecesFromFen(P.game.fen()), { moves: animationFor(reply) });
      board.setHighlights({ lastMove: [reply.from, reply.to], check: checkSquare(P.game) });
      feelMove(reply, P.game.inCheck());
      P.locked = false;
      board.setMovable(P.color);
      prompt(`${reply.san}. `);
    }, 650);
  },
  onIllegal(from, to) {
    if (!P) return;
    const reason = explainIllegal(P.game.fen(), from, to);
    if (reason) { play("illegal"); setMessage(reason, "info"); }
  },
  onTap(square) {
    const piece = P?.game.get(square);
    if (piece && piece.color !== P.color) setMessage(`You're playing ${P.color === "w" ? "White" : "Black"} in this puzzle.`, "info");
  },
  leave() {},
};

/** For a Defend! puzzle: what the opponent was threatening, shown once it's solved. */
function threatNote() {
  const { puzzle } = P;
  if (P.kind !== "defend" || !puzzle.threat) return "";
  try {
    const parts = puzzle.fen.split(" ");
    parts[1] = parts[1] === "w" ? "b" : "w";
    parts[3] = "-";
    const san = new Chess(parts.join(" ")).move({ from: puzzle.threat.slice(0, 2), to: puzzle.threat.slice(2, 4), promotion: puzzle.threat[4] }).san;
    return ` It stopped the threat ${san}${puzzle.mate ? " (checkmate)" : ""}.`;
  } catch {
    return "";
  }
}

function solved(move) {
  P.locked = true;
  board.setMovable(null);
  board.setHighlights({ lastMove: [move.from, move.to], good: move.to, check: checkSquare(P.game) });
  play("win");
  buzz("win");
  const wasComplete = setStatus(P.kind).complete;
  const clean = P.mistakes === 0 && P.hints === 0;
  const all = solvedPuzzles();
  const set = new Set(all[P.kind] || []);
  set.add(P.index);
  all[P.kind] = [...set].sort((a, b) => a - b);
  writeJson("puzzles", all);
  if (clean && !P.daily) {
    const cleanAll = cleanPuzzles();
    cleanAll[P.kind] = [...new Set([...(cleanAll[P.kind] || []), P.index])].sort((a, b) => a - b);
    writeJson("puzzlesClean", cleanAll);
  }
  if (P.round) { P.round.done++; if (clean) P.round.clean++; }
  setMessage(`🎉 ${move.san}${P.game.isCheckmate() ? " is checkmate" : ""}! ${clean ? "Solved on the first try." : "Solved!"}${threatNote()}`, "good");
  controls(true);
  if (P.daily) {
    const record = recordDaily(dailyRecord(), P.daily, "puzzle", { mistakes: P.mistakes, hints: P.hints });
    writeJson("daily", record);
    const { streak } = dailyStreak(P.daily);
    window.confetti?.({ particleCount: 100, spread: 70, origin: { y: 0.6 }, disableForReducedMotion: true });
    // Today's anonymous stats arrive a moment later, if online play is available.
    dailyStats(P.daily, clean).then((stats) => {
      const line = statsLine(stats);
      const el = document.getElementById("result-text");
      if (line && el && !document.getElementById("result-overlay").hidden) el.textContent = `${el.textContent} ${line}`;
    });
    showResult({
      emoji: "🔥",
      title: "Daily puzzle solved!",
      text: clean ? "First try, no hints. Brilliant!" : "Nicely done. Come back tomorrow for a new one.",
      stats: [["Streak", `${streak} day${streak === 1 ? "" : "s"}`], ["Mistakes", P.mistakes]],
      secondary: ["See the board", null],
      primary: ["Home", () => backToHome()],
    });
  } else if (!P.round && !wasComplete && setStatus(P.kind).complete) {
    setComplete();
  } else {
    document.getElementById("ctl-next")?.focus({ preventScroll: true });
  }
  hooks.onChange();
}

/** The whole set is solved for the first time: celebrate, and point to what's next. */
function setComplete() {
  const { kind, set } = P;
  const status = setStatus(kind);
  const nextSet = SETS.find((x) => x.id === NEXT_SET[kind] && !setStatus(x.id).complete)
    || SETS.find((x) => !setStatus(x.id).complete && puzzleList(x.id).length);
  window.confetti?.({ particleCount: 140, spread: 80, origin: { y: 0.6 }, disableForReducedMotion: true });
  const missed = status.total - status.clean;
  showResult({
    emoji: status.perfect ? "👑" : "🏆",
    title: `${set.title} complete!`,
    text: status.perfect ? "Every puzzle on the first try. You've earned the crown!"
      : `${missed} of them took more than one try. Retry those from Challenges to earn the 👑 crown.`,
    stats: [["Solved", `${status.solved}/${status.total}`], ["First try", `${status.clean}/${status.total}`]],
    secondary: ["See the board", null],
    primary: nextSet ? [`Try ${nextSet.title} ➜`, () => startSet(nextSet.id)] : ["⚡ Speed drill", () => startDrill(kind)],
  });
}

// ---------- Speed drill: as many puzzles as you can in 3 minutes, with 3 lives ----------

let drillTimer = null;

function stopDrillTimer() {
  clearInterval(drillTimer);
  drillTimer = null;
}

const formatTime = (ms) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};
const drillLine = (d) => `${SETS.find((x) => x.id === d.kind).title} · ⏱ ${formatTime(d.ends - Date.now())} · ${"❤️".repeat(d.lives)}${"🤍".repeat(DRILL_LIVES - d.lives)} · ✅ ${d.solved}`;

export function startDrill(kind) {
  stopDrillTimer();
  const d = { kind, order: shuffled(puzzleList(kind).map((_, i) => i)), at: 0, solved: 0, lives: DRILL_LIVES, ends: Date.now() + DRILL_MS, over: false };
  drillPuzzle(d);
  setMessage(`⚡ <strong>Go!</strong> Solve as many as you can in ${DRILL_MS / 60000} minutes. ${DRILL_LIVES} mistakes and the drill ends.`);
  drillTimer = setInterval(() => {
    if (!P?.drill || P.drill !== d) return;
    setTitle("⚡ Speed drill", drillLine(d));
    if (Date.now() >= d.ends) endDrill(d);
  }, 250);
}

function drillPuzzle(d) {
  if (d.at >= d.order.length) { d.order = shuffled(d.order); d.at = 0; } // went through them all: go round again
  startPuzzle(d.kind, d.order[d.at++], { drill: d });
}

function drillHit(move) {
  const d = P.drill;
  if (d.over) return;
  d.solved++;
  P.locked = true;
  board.setMovable(null);
  board.setHighlights({ lastMove: [move.from, move.to], good: move.to, check: checkSquare(P.game) });
  play("correct");
  setMessage(`✅ ${move.san}! <strong>${d.solved} solved.</strong>`, "good");
  setTitle("⚡ Speed drill", drillLine(d));
  const token = P.token;
  setTimeout(() => { if (P && P.token === token && !d.over) drillPuzzle(d); }, 450);
}

function drillMiss(move) {
  const d = P.drill;
  if (d.over) return;
  d.lives--;
  P.locked = true;
  board.setMovable(null);
  play("wrong");
  buzz("wrong");
  board.shake();
  // Show the right move, so a miss still teaches something.
  const expected = P.puzzle.line[P.step];
  P.game.undo();
  const right = P.game.move(parseUci(expected));
  board.setPieces(piecesFromFen(P.game.fen()), { animate: false });
  board.setHighlights({ lastMove: [right.from, right.to], good: right.to, bad: move.to, check: checkSquare(P.game) });
  setMessage(`❌ ${move.san} isn't it. The answer was <strong>${right.san}</strong>.`, "bad");
  setTitle("⚡ Speed drill", drillLine(d));
  const token = P.token;
  if (d.lives <= 0) { setTimeout(() => { if (!d.over) endDrill(d); }, 1200); return; }
  setTimeout(() => { if (P && P.token === token && !d.over) drillPuzzle(d); }, 1400);
}

function endDrill(d) {
  if (!d || d.over) return;
  d.over = true;
  stopDrillTimer();
  if (P) { P.locked = true; P.token++; }
  board.setMovable(null);
  const bests = drillBests();
  const previous = bests[d.kind] || 0;
  const best = d.solved > previous;
  if (best) { bests[d.kind] = d.solved; writeJson("drillBest", bests); }
  const set = SETS.find((x) => x.id === d.kind);
  const why = d.lives <= 0 ? "Out of lives." : Date.now() >= d.ends ? "Time's up!" : "Drill stopped.";
  setTitle("⚡ Speed drill", `${set.title} · ✅ ${d.solved}`);
  setMessage(`${why} You solved <strong>${d.solved}</strong>.`, "info");
  setControls([{ label: "↺ Again", kind: "primary", onClick: () => startDrill(d.kind) }, { label: "🎯 Challenges", onClick: () => backTo("challenges") }]);
  if (best && d.solved > 0) {
    play("win");
    window.confetti?.({ particleCount: 120, spread: 75, origin: { y: 0.6 }, disableForReducedMotion: true });
  }
  showResult({
    emoji: best && d.solved > 0 ? "🏅" : "⚡",
    title: `${d.solved} solved!`,
    text: `${why} ${best && d.solved > 0 ? (previous ? `New best! (Old best: ${previous})` : "Your first score. Can you beat it?") : `Your best: ${previous}.`}`,
    stats: [["Solved", d.solved], ["Mistakes", DRILL_LIVES - d.lives], ["Best", Math.max(previous, d.solved)]],
    secondary: ["Done", () => backTo("challenges")],
    primary: ["↺ Go again", () => startDrill(d.kind)],
  });
  hooks.onChange();
}

export { backTo };
