// A full game against the bot.
import { Chess, targetsFor, animationFor, checkSquare, explainIllegal, capturedPieces, materialBalance, gameOutcome, OUTCOME_TEXT, piecesFromFen, PIECE_WORD } from "../chess/rules.js";
import { botMove, bestMove } from "../chess/bot.js";
import { Position, hangingPieces, sqName } from "../chess/engine.js";
import { board, useMode, setTitle, setMessage, setControls, setControlDisabled, setBars, setMoveList, feelMove, choosePromotion, isPromotionMove, showResult } from "./boardscreen.js";
import { openOverlay, closeTopThen, openScreen, currentScreen } from "../ui/overlays.js";
import { readJson, writeJson } from "../storage.js";
import { play } from "../ui/audio.js";
import { buzz } from "../ui/haptics.js";

const byId = (id) => document.getElementById(id);
const BOT = {
  beginner: { name: "Beginner bot", emoji: "🐣" },
  intermediate: { name: "Intermediate bot", emoji: "🦉" },
};
const MIN_THINK_MS = 450;

let g = null; // the game in progress
let hooks = { onFinish: () => {}, onChange: () => {} };

/** Lets main.js refresh Home after a game changes or ends. */
export function setGameHooks(h) { hooks = { ...hooks, ...h }; }

export const savedGame = () => readJson("current", null);

/** Starts a new game: { level, color: "w" | "b" | "random", coach, undo, hints }. */
export function newGame(options) {
  const color = options.color === "random" ? (Math.random() < 0.5 ? "w" : "b") : options.color;
  begin({ ...options, color, moves: [] });
}

/** Continues the saved game. */
export function resumeGame() {
  const saved = savedGame();
  if (saved) begin(saved);
}

function begin(saved) {
  const game = new Chess();
  for (const uci of saved.moves) game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  g = { ...saved, game, thinking: false, over: null, token: 0, hintsUsed: saved.hintsUsed || 0, undosUsed: saved.undosUsed || 0, coachPending: null };
  if (currentScreen() !== "play") openScreen("play", { onLeave: leave });
  useMode(mode);
  setTitle(BOT[g.level].name, g.color === "w" ? "You play White" : "You play Black");
  board.setOrientation(g.color);
  render(false);
  controls();
  save();
  if (game.turn() !== g.color) botTurn();
  else setMessage(game.history().length ? "Your move." : `You play ${g.color === "w" ? "White: you move first" : "Black"}. Tap a piece, or drag it.`);
}

function leave() {
  if (g) g.token++; // ignore a reply still on its way
  g = null;
  hooks.onChange();
}

function save() {
  if (!g) return;
  if (g.over) { writeJson("current", null); return; }
  const { level, color, coach, undo, hints, hintsUsed, undosUsed } = g;
  writeJson("current", { level, color, coach, undo, hints, hintsUsed, undosUsed, moves: g.game.history({ verbose: true }).map((m) => m.from + m.to + (m.promotion || "")), savedAt: Date.now() });
  hooks.onChange();
}

const mode = {
  getTargets(from) {
    if (!g || g.over || g.thinking || g.coachPending || g.game.turn() !== g.color) return [];
    return targetsFor(g.game, from);
  },
  async onMove(from, to) {
    if (!g) return;
    let promotion;
    if (isPromotionMove(board.pieces, from, to)) {
      promotion = await choosePromotion(g.color);
      if (!promotion) { render(false); return; } // dismissed: the pawn goes back
    }
    playerMove({ from, to, promotion });
  },
  onIllegal(from, to) {
    if (!g) return;
    const reason = explainIllegal(g.game.fen(), from, to);
    if (reason) { setMessage(reason, "info"); play("illegal"); buzz("wrong"); }
  },
  onTap(square) {
    if (!g || g.over) return;
    const piece = g.game.get(square);
    if (g.thinking) setMessage("The bot is thinking…");
    else if (piece && piece.color !== g.color) setMessage(`That's ${g.color === "w" ? "Black" : "White"}'s ${PIECE_WORD[piece.type]}. You play ${g.color === "w" ? "White" : "Black"}.`, "info");
  },
  leave() {},
};

function render(animate = true, lastMove = null) {
  const game = g.game;
  board.setPieces(piecesFromFen(game.fen()), { animate, moves: lastMove ? animationFor(lastMove) : [] });
  const history = game.history({ verbose: true });
  const last = lastMove || history[history.length - 1];
  board.setHighlights({ lastMove: last ? [last.from, last.to] : [], check: checkSquare(game) });
  const caps = capturedPieces(game);
  const balance = materialBalance(game);
  const bot = BOT[g.level];
  const botColor = g.color === "w" ? "b" : "w";
  const plus = (color) => { const v = color === "w" ? balance : -balance; return v > 0 ? v : 0; };
  setBars(
    { name: bot.name, emoji: bot.emoji, captured: caps[botColor], color: botColor, plus: plus(botColor), status: g.thinking ? '<span class="thinking">thinking</span>' : "" },
    { name: "You", emoji: "🙂", captured: caps[g.color], color: g.color, plus: plus(g.color) },
  );
  setMoveList(game.history());
  board.setMovable(!g.over && !g.thinking && !g.coachPending && game.turn() === g.color ? g.color : null);
  controls();
}

function controls() {
  if (!g) return;
  if (g.over) {
    setControls([
      { label: "✨ New game", onClick: () => openNewGame() },
      { label: "🔁 Rematch", kind: "primary", onClick: () => newGame({ ...g, color: g.color === "w" ? "b" : "w" }) },
    ]);
    return;
  }
  const yourMoves = g.game.history().length >= (g.color === "w" ? 1 : 2);
  setControls([
    ...(g.undo ? [{ label: "↶ Undo", id: "ctl-undo", onClick: undo, disabled: g.thinking || !yourMoves }] : []),
    ...(g.hints ? [{ label: "💡 Hint", id: "ctl-hint", onClick: hint, disabled: g.thinking || g.game.turn() !== g.color }] : []),
    { label: "⇅ Flip", ariaLabel: "Flip the board", onClick: () => board.setOrientation(board.orientation === "w" ? "b" : "w") },
    { label: "⋯ More", ariaLabel: "Game menu", onClick: () => openOverlay("menu-overlay") },
  ]);
}

function applyMove(moveSpec) {
  const move = g.game.move(moveSpec);
  feelMove(move, g.game.inCheck());
  render(true, move);
  save();
  return move;
}

function playerMove(spec) {
  const before = new Position(g.game.fen());
  const side = g.color === "w" ? 0 : 1;
  const hangingBefore = new Set(hangingPieces(before, side).map(sqName));
  const move = applyMove(spec);
  if (finishIfOver()) return;
  // The coach speaks up when this move leaves a piece (newly) unprotected.
  if (g.coach) {
    const after = new Position(g.game.fen());
    const newly = hangingPieces(after, side).map(sqName).filter((s) => !hangingBefore.has(s) || s === move.to);
    if (newly.length) {
      const square = newly.includes(move.to) ? move.to : newly[0];
      const piece = g.game.get(square);
      g.coachPending = true;
      board.setMovable(null);
      byId("coach-text").innerHTML = `🧑‍🏫 <strong>Careful!</strong> Your ${PIECE_WORD[piece.type]} on ${square} can be captured${piece.type !== "p" ? " for free" : ""}. Take the move back?`;
      byId("coach").hidden = false;
      board.setHighlights({ lastMove: [move.from, move.to], bad: square, check: checkSquare(g.game) });
      setMessage("");
      return;
    }
  }
  botTurn();
}

function coachDone(takeBack) {
  if (!g?.coachPending) return;
  g.coachPending = null;
  byId("coach").hidden = true;
  if (takeBack) {
    const move = g.game.undo();
    board.setPieces(piecesFromFen(g.game.fen()), { moves: [[move.to, move.from]] });
    render(false);
    save();
    setMessage("Move taken back. Find a safer square.");
    return;
  }
  botTurn();
}
byId("coach-undo").addEventListener("click", () => coachDone(true));
byId("coach-keep").addEventListener("click", () => coachDone(false));

async function botTurn() {
  const token = ++g.token;
  g.thinking = true;
  render(false);
  setMessage("");
  const started = Date.now();
  const game = g.game;
  const fens = positionsSinceReset(game);
  const uci = await botMove(game.fen(), fens, g.level);
  const wait = MIN_THINK_MS - (Date.now() - started);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  if (!g || token !== g.token) return; // the game changed meanwhile
  g.thinking = false;
  if (!uci) { render(false); return; }
  const move = applyMove({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  if (finishIfOver()) return;
  setMessage(g.game.inCheck() ? "You're in check! Protect your king." : `${move.san}. Your move.`);
}

/** FENs of earlier positions since the last capture or pawn move, for the bot's repetition check. */
function positionsSinceReset(game) {
  const replay = new Chess();
  const fens = [replay.fen()];
  for (const m of game.history({ verbose: true })) { replay.move(m); fens.push(replay.fen()); }
  const halfmove = Number(game.fen().split(" ")[4]);
  return fens.slice(Math.max(0, fens.length - 1 - halfmove), fens.length - 1);
}

function finishIfOver(forced) {
  const outcome = forced || gameOutcome(g.game);
  if (!outcome) return false;
  g.over = outcome;
  g.thinking = false;
  render(false);
  save();
  const won = outcome.result === g.color;
  const draw = outcome.result === "draw";
  const stats = readJson("games", {});
  const entry = stats[g.level] || { w: 0, l: 0, d: 0 };
  entry[won ? "w" : draw ? "d" : "l"]++;
  stats[g.level] = entry;
  writeJson("games", stats);
  hooks.onFinish(won ? "win" : draw ? "draw" : "loss");
  setTimeout(() => {
    if (!g || g.over !== outcome) return;
    play(won ? "win" : draw ? "draw" : "lose");
    buzz(won ? "win" : "lose");
    if (won) window.confetti?.({ particleCount: 120, spread: 75, origin: { y: 0.6 }, disableForReducedMotion: true });
    const who = g.color === "w" ? "White" : "Black";
    showResult({
      emoji: won ? "🏆" : draw ? "🤝" : "🙂",
      title: won ? "You win!" : draw ? "Draw" : "The bot wins",
      text: outcome.reason === "checkmate" ? (won ? `You checkmated the ${BOT[g.level].name}.` : `${who === "White" ? "Black" : "White"} won by checkmate. Every game teaches you something!`) : OUTCOME_TEXT[outcome.reason],
      stats: [["Moves", Math.ceil(g.game.history().length / 2)], ["Record", `${entry.w}–${entry.l}–${entry.d}`]],
      secondary: ["See the board", null],
      primary: ["Rematch", () => newGame({ ...g, color: g.color === "w" ? "b" : "w" })],
    });
    setMessage(won ? "You won! 🎉" : draw ? "The game is a draw." : "The bot won this time.");
  }, 700);
  return true;
}

function undo() {
  if (!g || g.thinking || g.over) return;
  g.token++;
  const undone = [];
  // Take back the bot's reply and your move, so it's your turn again.
  do {
    const m = g.game.undo();
    if (!m) break;
    undone.push(m);
  } while (g.game.turn() !== g.color);
  if (!undone.length) return;
  g.undosUsed++;
  byId("coach").hidden = true;
  g.coachPending = null;
  board.setPieces(piecesFromFen(g.game.fen()), { moves: undone.map((m) => [m.to, m.from]) });
  render(false);
  save();
  setMessage("Moves taken back. Your move.");
}

async function hint() {
  if (!g || g.thinking || g.game.turn() !== g.color) return;
  setControlDisabled("ctl-hint", true);
  setMessage("Thinking of a good move…");
  const token = g.token;
  const { move } = await bestMove(g.game.fen(), positionsSinceReset(g.game));
  if (!g || token !== g.token || !move) return;
  g.hintsUsed++;
  save();
  const from = move.slice(0, 2), to = move.slice(2, 4);
  const piece = g.game.get(from);
  board.setHighlights({ lastMove: [], hint: [from, to], check: checkSquare(g.game) });
  setMessage(`💡 Try moving your ${PIECE_WORD[piece.type]} from ${from} to ${to}.`, "info");
  setControlDisabled("ctl-hint", false);
}

// ---------- Game menu ----------

byId("menu-resign").addEventListener("click", () => {
  closeTopThen(() => confirm("Resign this game?", "The bot wins this game. You can start a new one right away.", "Resign", () => finishIfOver({ result: g.color === "w" ? "b" : "w", reason: "resigned" })));
});
byId("menu-draw").addEventListener("click", () => closeTopThen(offerDraw));
async function offerDraw() {
  if (!g || g.over || g.thinking) return;
  // The bot accepts when it isn't better.
  const { score } = await bestMove(g.game.fen(), positionsSinceReset(g.game));
  const botToMove = g.game.turn() !== g.color;
  const botScore = botToMove ? score : -score;
  if (g.game.history().length >= 20 && botScore <= 30) finishIfOver({ result: "draw", reason: "agreed" });
  else setMessage(g.game.history().length < 20 ? "The bot says: it's too early for a draw. Let's play on!" : "The bot declines: it thinks it's doing fine. Play on!", "info");
}
let openNewGame = () => openOverlay("newgame-overlay");
export const setNewGameOpener = (fn) => { openNewGame = fn; };
byId("menu-new").addEventListener("click", () => closeTopThen(() => openNewGame()));

let confirmAction = null;
function confirm(title, text, okLabel, action) {
  byId("confirm-title").textContent = title;
  byId("confirm-text").textContent = text;
  byId("confirm-ok").textContent = okLabel;
  confirmAction = action;
  openOverlay("confirm-overlay", { focus: "#confirm-ok" });
}
byId("confirm-ok").addEventListener("click", () => {
  const action = confirmAction;
  confirmAction = null;
  closeTopThen(() => action?.());
});

export { confirm };
