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

export const SETS = [
  { id: "mate1", title: "Mate in 1", tier: "Beginner", emoji: "♛", goal: "Find checkmate in one move." },
  { id: "hanging", title: "Free pieces", tier: "Beginner", emoji: "🎁", goal: "Win a piece that isn't protected." },
  { id: "mate2", title: "Mate in 2", tier: "Intermediate", emoji: "♚", goal: "Force checkmate in two moves." },
  { id: "fork", title: "Forks", tier: "Intermediate", emoji: "🍴", goal: "Attack two pieces at once and win one." },
  { id: "material", title: "Win material", tier: "Intermediate", emoji: "💰", goal: "Find the move that wins material." },
];
export const DAILY_IDS = ["puzzle"];
const DAILY_ROTATION = ["mate2", "fork", "hanging", "material", "mate1"];

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

/** Today's puzzle: the same on every device. */
export function dailyPuzzle(day = dateKey()) {
  const dayNumber = Math.round(new Date(`${day}T12:00:00`).getTime() / 86400000);
  const kind = DAILY_ROTATION[((dayNumber % DAILY_ROTATION.length) + DAILY_ROTATION.length) % DAILY_ROTATION.length];
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

export function startPuzzle(kind, index, { daily = null } = {}) {
  const puzzle = puzzleList(kind)[index];
  if (!puzzle) return;
  const set = SETS.find((s) => s.id === kind);
  P = { kind, index, puzzle, set, daily, step: 0, mistakes: 0, hints: 0, token: 0, game: new Chess(puzzle.fen), locked: false };
  if (currentScreen() !== "play") openScreen("play", { onLeave: () => { if (P) P.token++; P = null; } });
  useMode(mode);
  const color = P.game.turn();
  P.color = color;
  setTitle(daily ? "Daily puzzle" : set.title, daily ? `${set.title} · ${dateLabel(daily)}` : `${set.tier} · Puzzle ${index + 1} of ${puzzleList(kind).length}`);
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
  const list = puzzleList(P.kind);
  const solved = new Set(solvedPuzzles()[P.kind] || []);
  for (let k = 1; k <= list.length; k++) {
    const i = (P.index + k) % list.length;
    if (!solved.has(i) || k === list.length) { startPuzzle(P.kind, i); return; }
  }
}

function hint() {
  if (!P || P.locked) return;
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
    if (verdict === "wrong") {
      P.mistakes++;
      P.locked = true;
      board.setMovable(null);
      board.setHighlights({ lastMove: [from, to], bad: to, check: checkSquare(P.game) });
      play("wrong");
      buzz("wrong");
      board.shake();
      setMessage(`❌ ${move.san} isn't the best move here. Try again!`, "bad");
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

function solved(move) {
  P.locked = true;
  board.setMovable(null);
  board.setHighlights({ lastMove: [move.from, move.to], good: move.to, check: checkSquare(P.game) });
  play("win");
  buzz("win");
  const all = solvedPuzzles();
  const set = new Set(all[P.kind] || []);
  set.add(P.index);
  all[P.kind] = [...set].sort((a, b) => a - b);
  writeJson("puzzles", all);
  const clean = P.mistakes === 0 && P.hints === 0;
  setMessage(`🎉 ${move.san}${P.game.isCheckmate() ? " is checkmate" : ""}! ${clean ? "Solved on the first try." : "Solved!"}`, "good");
  controls(true);
  if (P.daily) {
    const record = recordDaily(dailyRecord(), P.daily, "puzzle", { mistakes: P.mistakes, hints: P.hints });
    writeJson("daily", record);
    const { streak } = dailyStreak(P.daily);
    window.confetti?.({ particleCount: 100, spread: 70, origin: { y: 0.6 }, disableForReducedMotion: true });
    showResult({
      emoji: "🔥",
      title: "Daily puzzle solved!",
      text: clean ? "First try, no hints. Brilliant!" : "Nicely done. Come back tomorrow for a new one.",
      stats: [["Streak", `${streak} day${streak === 1 ? "" : "s"}`], ["Mistakes", P.mistakes]],
      secondary: ["See the board", null],
      primary: ["Home", () => backToHome()],
    });
  } else {
    document.getElementById("ctl-next")?.focus({ preventScroll: true });
  }
  hooks.onChange();
}

export { backTo };
