// Runs a Learn lesson: its Tip Card, then each task in turn.
import { Chess, targetsFor, animationFor, checkSquare, explainIllegal, piecesFromFen, gameOutcome, PIECE_WORD } from "../chess/rules.js";
import { botMove, bestMove } from "../chess/bot.js";
import { starTargets, starMove, starPar, judgeMove, taskStartFen, parseUci } from "../lib/tasks.js";
import { ALL_LESSONS } from "../content/lessons.js";
import { bossById, bossStars } from "../content/bosses.js";
import { openingReport, openingStars } from "../lib/opening.js";
import { coachLine } from "../ui/coach.js";
import { setting } from "../lib/settings.js";
import { board, useMode, setTitle, setMessage, setControls, setBars, feelMove, choosePromotion, isPromotionMove, showResult, miniBoard, setTaskDots, hideBoard } from "./boardscreen.js";
import { openOverlay, openScreen, currentScreen, backTo } from "../ui/overlays.js";
import { readJson, writeJson } from "../storage.js";
import { play } from "../ui/audio.js";
import { buzz } from "../ui/haptics.js";

const byId = (id) => document.getElementById(id);
const WRONG_SHOW_MS = 900;

let L = null; // the lesson in progress
let hooks = { onChange: () => {} };
export function setLessonHooks(h) { hooks = { ...hooks, ...h }; }

export const lessonProgress = () => readJson("lessons", {});

/** The first lesson not yet finished (or the last one). */
export function nextLesson() {
  const done = lessonProgress();
  return ALL_LESSONS.find((l) => !done[l.id]) || null;
}

export function startLesson(id) {
  const index = ALL_LESSONS.findIndex((l) => l.id === id);
  if (index < 0) return;
  const lesson = ALL_LESSONS[index];
  L = { lesson, index, task: 0, mistakes: 0, done: [], token: 0 };
  if (currentScreen() !== "play") openScreen("play", { onLeave: () => { if (L) L.token++; L = null; } });
  useMode(mode);
  setTitle(lesson.title, `${lesson.unit.title} · Lesson ${index + 1} of ${ALL_LESSONS.length}`);
  showTip(() => startTask(0));
}

/** Best result per endgame boss: { [id]: { stars, best } } (best = fewest moves). */
export const bossProgress = () => readJson("bosses", {});

/** An endgame boss: one play-it-out task against the bot, with stars for few moves. */
export function startBoss(id) {
  const boss = bossById(id);
  if (!boss) return;
  const opening = boss.goal === "opening";
  const lesson = { id, title: boss.title, unit: { title: opening ? "Opening boss" : "Endgame boss" }, tip: boss.tip, tasks: [{ type: "play", goal: boss.goal, moves: boss.moves, fen: boss.fen, text: boss.text }] };
  L = { lesson, index: -1, task: 0, mistakes: 0, done: [], token: 0, boss, onPlayWon: (used) => bossWon(boss, used), onOpeningDone: (game, color) => openingDone(boss, game, color) };
  if (currentScreen() !== "play") openScreen("play", { onLeave: () => { if (L) L.token++; L = null; } });
  useMode(mode);
  setTitle(`${boss.emoji} ${boss.title}`, opening ? `Opening boss · ${"⭐".repeat(3)} for all 4 checks` : `Endgame boss · ${"⭐".repeat(3)} in ${boss.par} moves`);
  showTip(() => startTask(0));
}

function bossWon(boss, used) {
  const stars = bossStars(boss, used);
  const all = bossProgress();
  const before = all[boss.id];
  all[boss.id] = { stars: Math.max(before?.stars || 0, stars), best: Math.min(before?.best ?? Infinity, used) };
  writeJson("bosses", all);
  hooks.onChange();
  L.done[0] = true;
  setTaskDots(1, 0, L.done);
  board.setMovable(null);
  play("win");
  buzz("win");
  window.confetti?.({ particleCount: 120, spread: 75, origin: { y: 0.6 }, disableForReducedMotion: true });
  const what = boss.goal === "mate" ? "Checkmate" : "Promoted";
  setMessage(`✅ ${what} in ${used} move${used === 1 ? "" : "s"}! ${"⭐".repeat(stars)}${"☆".repeat(3 - stars)}`, "good");
  const again = { label: "↺ Try again", onClick: () => startTask(0) };
  setControls([again, { label: "🎯 Challenges", kind: "primary", onClick: () => backTo("challenges") }]);
  showResult({
    emoji: stars === 3 ? "🏆" : "🎉",
    title: "Boss beaten!",
    text: `${"⭐".repeat(stars)}${"☆".repeat(3 - stars)}  ${what} in ${used} move${used === 1 ? "" : "s"}. ${stars === 3 ? "Perfect!" : `Do it in ${boss.par} or fewer for 3 stars.`}`,
    stats: [["Moves", used], ["Best", Math.min(before?.best ?? Infinity, used)], ["3 stars", `≤ ${boss.par}`]],
    secondary: ["↺ Try again", () => startTask(0)],
    primary: ["Back to Challenges", () => backTo("challenges")],
  });
}

/** An opening boss's 10 moves are played: the report card. */
function openingDone(boss, game, color) {
  const report = openingReport(game, color);
  const passed = report.filter((c) => c.ok).length;
  const stars = openingStars(report);
  const all = bossProgress();
  const before = all[boss.id];
  if (stars) all[boss.id] = { stars: Math.max(before?.stars || 0, stars), best: Math.max(before?.best || 0, passed) };
  writeJson("bosses", all);
  hooks.onChange();
  board.setMovable(null);
  const again = { label: "↺ Try again", onClick: () => startTask(0) };
  if (stars) {
    L.done[0] = true;
    setTaskDots(1, 0, L.done);
    play("win");
    buzz("win");
    if (stars === 3) window.confetti?.({ particleCount: 120, spread: 75, origin: { y: 0.6 }, disableForReducedMotion: true });
    setMessage(`✅ Opening done: ${passed} of 4 checks. ${"⭐".repeat(stars)}${"☆".repeat(3 - stars)}`, "good");
  } else {
    miss(`Only ${passed} of 4 checks. Try again!`);
  }
  setControls([again, { label: "🎯 Challenges", kind: "primary", onClick: () => backTo("challenges") }]);
  showResult({
    emoji: stars === 3 ? "🏆" : stars ? "🎉" : "📋",
    title: stars === 3 ? "A perfect opening!" : stars ? "Report card" : "Not yet!",
    text: `${"⭐".repeat(stars)}${"☆".repeat(3 - stars)}  ${passed} of 4 checks.${stars === 3 ? "" : " Get all four for 3 stars."}`,
    checks: report,
    secondary: ["↺ Try again", () => startTask(0)],
    primary: ["Back to Challenges", () => backTo("challenges")],
  });
}

/** Opens the lesson's Tip Card; `then` runs when it's closed, however it's closed. */
export function showTip(then) {
  const lesson = L.lesson;
  byId("tip-title").textContent = lesson.title;
  byId("tip-coach-line").textContent = coachLine("tip");
  byId("tip-overlay").classList.toggle("no-coach", !setting("coach"));
  byId("tip-body").innerHTML = lesson.tip.map((p) => `<p>${p}</p>`).join("") + (lesson.tipFen ? miniBoard(lesson.tipFen, lesson.tipHighlight || []) : "");
  openOverlay("tip-overlay", { onClose: () => then?.() });
}

const mode = {
  getTargets(from) { return L?.handlers?.getTargets?.(from) || []; },
  onMove(from, to) { L?.handlers?.onMove?.(from, to); },
  onIllegal(from, to) { L?.handlers?.onIllegal?.(from, to); },
  onTap(square) { L?.handlers?.onTap?.(square); },
  leave() {},
};

function startTask(i) {
  if (!L) return;
  L.task = i;
  L.token++;
  L.taskMistakes = 0;
  const task = L.lesson.tasks[i];
  setTaskDots(L.lesson.tasks.length, i, L.done);
  hideBoard(false);
  byId("controls").classList.remove("is-quiz");
  board.setHighlights();
  setBars(null, null);
  const runner = { stars: starsTask, move: moveTask, quiz: quizTask, play: playTask }[task.type];
  L.handlers = runner(task);
}

function taskControls(extra = []) {
  setControls([
    { label: "💡 Tip card", onClick: () => showTip() },
    ...extra,
  ]);
}

/** A task is done. `extra` buttons go before Next/Finish (e.g. Restart to try for fewer moves). */
function succeed(message, extra = []) {
  L.done[L.task] = true;
  setTaskDots(L.lesson.tasks.length, L.task, L.done);
  board.setMovable(null);
  play("correct");
  buzz("win");
  setMessage(`✅ ${message}`, "good");
  const last = L.task === L.lesson.tasks.length - 1;
  taskControls([...extra, { label: last ? "Finish ➜" : "Next ➜", kind: "primary", id: "ctl-next", onClick: () => (last ? finishLesson() : startTask(L.task + 1)) }]);
  document.getElementById("ctl-next")?.focus({ preventScroll: true });
}

function miss(message) {
  L.mistakes++;
  L.taskMistakes++;
  play("wrong");
  buzz("wrong");
  board.shake();
  setMessage(`❌ ${message}`, "bad");
}

function finishLesson() {
  const stars = L.mistakes === 0 ? 3 : L.mistakes <= 2 ? 2 : 1;
  const progress = lessonProgress();
  const before = progress[L.lesson.id]?.stars || 0;
  progress[L.lesson.id] = { stars: Math.max(before, stars), at: Date.now() };
  writeJson("lessons", progress);
  hooks.onChange();
  window.confetti?.({ particleCount: 90, spread: 70, origin: { y: 0.6 }, disableForReducedMotion: true });
  play("win");
  const next = ALL_LESSONS[L.index + 1];
  showResult({
    emoji: "🎓",
    title: "Lesson complete!",
    text: `${"⭐".repeat(stars)}${"☆".repeat(3 - stars)}  ${L.mistakes === 0 ? "Perfect, no mistakes!" : `${L.mistakes} mistake${L.mistakes === 1 ? "" : "s"}. Try again any time for 3 stars.`}`,
    secondary: ["All lessons", () => backTo("learn")],
    primary: next ? [`Next: ${next.title}`, () => startLesson(next.id)] : ["Done", () => backTo("learn")],
    onClose: () => backTo("learn"),
  });
}

// ---------- Stars ----------

function starsTask(task) {
  let fen = task.fen;
  let left = [...task.stars];
  let moves = 0;
  const par = task.par ?? starPar(task.fen, task.piece, task.stars);
  const color = fen.split(" ")[1];
  const status = () => `${task.text}<span class="task-meta">Moves: ${moves} · Fewest possible: ${par}</span>`;
  const show = (animate, moved) => {
    board.setOrientation(color);
    board.setPieces(piecesFromFen(fen), { animate, moves: moved ? [moved] : [] });
    board.setHighlights({ stars: left, lastMove: moved || [] });
  };
  show(false);
  board.setMovable(color);
  setMessage(status());
  const restart = () => startTask(L.task);
  taskControls([{ label: "↺ Restart", onClick: restart }]);
  return {
    getTargets(from) {
      const targets = starTargets(fen, task.piece, from);
      if (!targets.length && board.pieces[from]?.[1] !== task.piece) setMessage(`Only your ${PIECE_WORD[task.piece]} moves here. ${task.text}`, "info");
      return targets;
    },
    onMove(from, to) {
      fen = starMove(fen, from, to);
      moves++;
      const got = left.includes(to);
      left = left.filter((s) => s !== to);
      show(true, [from, to]);
      if (got) { play("star"); buzz("capture"); } else { play("move"); buzz("land"); }
      if (!left.length) {
        const best = moves <= par;
        if (best) succeed(`All stars in ${moves} move${moves === 1 ? "" : "s"}: the fewest possible!`);
        else succeed(`All stars collected in ${moves} moves. It can be done in ${par}: try ↺ Restart if you like.`, [{ label: "↺ Restart", id: "ctl-restart", onClick: restart }]);
      } else setMessage(status());
    },
    onIllegal(from, to) {
      play("illegal");
      const piece = board.pieces[from];
      const pieceWord = PIECE_WORD[piece?.[1]] || "piece";
      if (piece?.[1] === "k" && !board.pieces[to]) setMessage("The king can't move there: that square is attacked, or it's more than one step away.", "info");
      else setMessage(`The ${pieceWord} can't move there. ${HOW[piece?.[1]] || ""}`, "info");
    },
    onTap() {},
  };
}

const HOW = {
  r: "Rooks move in straight lines along rows and columns.",
  b: "Bishops move diagonally.",
  q: "The queen moves in straight lines and diagonals.",
  k: "The king moves one square at a time.",
  n: "Knights move in an L shape.",
  p: "Pawns move straight ahead and capture diagonally.",
};

// ---------- One move ----------

function moveTask(task) {
  const startFen = taskStartFen(task);
  let game = new Chess(startFen);
  const color = game.turn();
  board.setOrientation(color);
  let locked = false;
  const token = L.token;
  const ready = () => {
    board.setPieces(piecesFromFen(game.fen()), { animate: false });
    board.setHighlights({ check: checkSquare(game) });
    board.setMovable(color);
    setMessage(task.text);
  };
  if (task.pre) {
    // Show the other side's move first.
    const before = new Chess(task.fen);
    board.setPieces(piecesFromFen(task.fen), { animate: false });
    board.setMovable(null);
    setMessage("Watch the other side's move…");
    setTimeout(() => {
      if (!L || L.token !== token) return;
      const m = before.move(parseUci(task.pre));
      board.setPieces(piecesFromFen(before.fen()), { moves: animationFor(m) });
      board.setHighlights({ lastMove: [m.from, m.to] });
      play("move");
      board.setMovable(color);
      setMessage(task.text);
    }, 700);
  } else ready();
  const showHint = () => {
    const sols = solutionsFor(task, startFen);
    if (!sols.length) return;
    const from = sols[0].slice(0, 2);
    board.setHighlights({ hint: [from], check: checkSquare(game) });
    setMessage(`💡 Try moving the ${PIECE_WORD[game.get(from).type]} on ${from}. ${task.text}`, "info");
  };
  taskControls([{ label: "💡 Hint", onClick: showHint }]);
  return {
    getTargets(from) { return locked ? [] : targetsFor(game, from); },
    async onMove(from, to) {
      let promotion;
      if (isPromotionMove(board.pieces, from, to)) {
        promotion = await choosePromotion(color);
        if (!promotion) { board.setPieces(piecesFromFen(game.fen()), { animate: false }); return; }
      }
      const uci = from + to + (promotion || "");
      const verdict = judgeMove(task, game.fen(), uci);
      const move = game.move({ from, to, promotion });
      board.setPieces(piecesFromFen(game.fen()), { moves: animationFor(move) });
      feelMove(move, game.inCheck());
      if (verdict.ok) {
        board.setHighlights({ lastMove: [from, to], check: checkSquare(game), good: to });
        succeed(task.successFor?.[uci] || task.successFor?.[uci.slice(0, 4)] || task.success || "Well done!");
        return;
      }
      locked = true;
      board.setMovable(null);
      board.setHighlights({ lastMove: [from, to], bad: to, check: checkSquare(game) });
      miss(verdict.message);
      setTimeout(() => {
        if (!L || L.token !== token) return;
        game.undo();
        board.setPieces(piecesFromFen(game.fen()), { moves: animationFor(move).map(([a, b]) => [b, a]) });
        board.setHighlights({ check: checkSquare(game) });
        locked = false;
        board.setMovable(color);
      }, WRONG_SHOW_MS);
    },
    onIllegal(from, to) {
      const reason = explainIllegal(game.fen(), from, to);
      if (reason) { play("illegal"); setMessage(reason, "info"); }
    },
    onTap(square) {
      const piece = game.get(square);
      if (piece && piece.color !== color) setMessage(`You're playing ${color === "w" ? "White" : "Black"} here. ${task.text}`, "info");
    },
  };
}

function solutionsFor(task, fen) {
  const game = new Chess(fen);
  return game.moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion || "")).filter((uci) => judgeMove(task, fen, uci).ok);
}

// ---------- Quiz ----------

function quizTask(task) {
  if (task.fen) {
    board.setOrientation("w");
    board.setPieces(piecesFromFen(task.fen), { animate: false });
    board.setHighlights({ hint: task.highlight || [] });
    board.setMovable(null);
  } else hideBoard(true);
  setMessage(`<strong class="quiz-q">${task.text}</strong>`);
  const wrongTried = new Set();
  const render = () => setControls([
    { label: "💡 Tip card", onClick: () => showTip() },
    ...task.options.map((option, i) => ({
      label: option,
      kind: wrongTried.has(i) ? "wrong" : "option",
      disabled: wrongTried.has(i),
      onClick: () => {
        if (i === task.answer) {
          succeed(task.explain);
          return;
        }
        wrongTried.add(i);
        miss(`Not quite. ${task.text}`);
        render();
      },
    })),
  ]);
  render();
  document.getElementById("controls").classList.add("is-quiz");
  return { onTap() {} };
}

// ---------- Play it out ----------

function playTask(task) {
  let game = new Chess(task.fen);
  const color = game.turn();
  let thinking = false;
  const token = L.token;
  board.setOrientation(color);
  const used = () => Math.ceil(game.history().length / 2); // the player moves first
  const status = () => `${task.text}<span class="task-meta">${task.goal === "hold" ? "Moves held" : task.goal === "opening" ? "Moves played" : "Moves used"}: ${used()} of ${task.moves}</span>`;
  const won = (text) => (L.onPlayWon ? L.onPlayWon(used(), text) : succeed(text));
  const show = (move) => {
    board.setPieces(piecesFromFen(game.fen()), { moves: move ? animationFor(move) : [], animate: Boolean(move) });
    board.setHighlights({ lastMove: move ? [move.from, move.to] : [], check: checkSquare(game) });
  };
  show();
  board.setMovable(color);
  setMessage(status());
  const restart = () => startTask(L.task);
  const fail = (text) => {
    board.setMovable(null);
    miss(text);
    taskControls([{ label: "↺ Try again", kind: "primary", onClick: restart }]);
  };
  const hint = async () => {
    if (thinking || game.turn() !== color) return;
    const { move } = await bestMove(game.fen(), []);
    if (!L || L.token !== token || !move) return;
    board.setHighlights({ hint: [move.slice(0, 2), move.slice(2, 4)], check: checkSquare(game) });
    setMessage(`💡 Try ${PIECE_WORD[game.get(move.slice(0, 2)).type]} ${move.slice(0, 2)} to ${move.slice(2, 4)}.`, "info");
  };
  taskControls([{ label: "💡 Hint", onClick: hint }, { label: "↺ Restart", onClick: restart }]);
  return {
    getTargets(from) { return thinking ? [] : targetsFor(game, from); },
    async onMove(from, to) {
      let promotion;
      if (isPromotionMove(board.pieces, from, to)) {
        promotion = await choosePromotion(color);
        if (!promotion) { show(); return; }
      }
      const move = game.move({ from, to, promotion });
      show(move);
      feelMove(move, game.inCheck());
      const outcome = gameOutcome(game);
      if (task.goal === "promote" && move.promotion) {
        // Promoted: it counts if the new piece can't simply be taken.
        if (game.moves({ verbose: true }).some((m) => m.to === move.to)) { fail("Your new queen can be taken! Try again, and promote where it's safe (or protected by your king)."); return; }
        won(task.success || `Promoted in ${used()} moves!`);
        return;
      }
      if (task.goal === "hold") {
        if (outcome) { won(task.success || "Held: it's a draw!"); return; }
        if (used() >= task.moves) { won(task.success || `You held for ${task.moves} moves!`); return; }
      } else if (task.goal === "opening") {
        if (outcome?.reason === "checkmate") { L.onOpeningDone(game, color); return; }
        if (outcome) { fail("The game ended in a draw. Try again!"); return; }
      } else {
        if (outcome?.reason === "checkmate") { won(`Checkmate in ${used()} moves!`); return; }
        if (outcome) { fail(outcome.reason === "stalemate" ? "Stalemate! The king had no legal move but wasn't in check, so it's a draw. Try again, and leave the king a square until you can give mate." : "The game ended in a draw. Try again!"); return; }
        if (used() >= task.moves) { fail(task.failText ? `That's ${task.moves} moves without ${task.goal === "promote" ? "promoting" : "checkmate"}. ${task.failText}` : task.goal === "promote" ? `That's ${task.moves} moves without promoting. Try again: lead with your king.` : `That's ${task.moves} moves without checkmate. Try again: push the king to the edge first.`); return; }
      }
      thinking = true;
      board.setMovable(null);
      setMessage(status());
      const uci = await botMove(game.fen(), [], task.goal === "opening" ? "beginner" : "intermediate");
      await new Promise((r) => setTimeout(r, 350));
      if (!L || L.token !== token) return;
      thinking = false;
      const reply = game.move(parseUci(uci));
      show(reply);
      feelMove(reply, game.inCheck());
      const after = gameOutcome(game);
      if (task.goal === "hold") {
        if (reply.promotion) { fail("The pawn promoted. Try again: keep your king in front of the pawn."); return; }
        if (after) { won(task.success || "Held: it's a draw!"); return; }
      } else if (task.goal === "opening") {
        if (after) { fail(after.reason === "checkmate" ? "Checkmated! Try again: castle early and watch f7." : "The game ended in a draw. Try again!"); return; }
        if (used() >= task.moves) { L.onOpeningDone(game, color); return; }
      } else if (after) {
        fail(task.goal === "promote" ? "Your pawn is gone, so it's a draw. Try again: keep the pawn protected." : "The game ended in a draw. Try again!");
        return;
      }
      board.setMovable(color);
      setMessage(status());
    },
    onIllegal(from, to) {
      const reason = explainIllegal(game.fen(), from, to);
      if (reason) { play("illegal"); setMessage(reason, "info"); }
    },
    onTap() {},
  };
}
