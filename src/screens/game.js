// A full game: against the bot, or between two players taking turns on one device
// ("pass and play", level "friend"). The two kinds are saved separately, so starting one never
// throws away an unfinished game of the other.
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

const isFriend = () => g?.level === "friend";
const slot = () => (isFriend() ? "friendGame" : "current");
export const savedGame = () => readJson("current", null);
export const savedFriendGame = () => readJson("friendGame", null);

/** Starts a new game against the bot: { level, color: "w" | "b" | "random", coach, undo, hints }. */
export function newGame(options) {
  const color = options.color === "random" ? (Math.random() < 0.5 ? "w" : "b") : options.color;
  begin({ ...options, color, moves: [] });
}

/** Starts a two-player game: { names: { w, b }, autoFlip, undo }. */
export function newFriendGame({ names, autoFlip, undo }) {
  begin({ level: "friend", color: "w", names, autoFlip, undo, coach: false, hints: false, moves: [] });
}

/** Continues a saved game: "bot" or "friend". */
export function resumeGame(kind = "bot") {
  const saved = kind === "friend" ? savedFriendGame() : savedGame();
  if (saved) begin(saved);
}

/** The color whose pieces can move now: yours against the bot, whoever's turn it is with a friend. */
const moverColor = () => (isFriend() ? g.game.turn() : g.color);
const nameOf = (color) => g.names?.[color] || (color === "w" ? "White" : "Black");
const sideWord = (color) => (color === "w" ? "White" : "Black");
/** "Alex (White)", or just "White" when the player kept the default name. */
const label = (color) => (nameOf(color) === sideWord(color) ? sideWord(color) : `${nameOf(color)} (${sideWord(color)})`);

function turnMessage(lastMove) {
  const turn = g.game.turn();
  const prefix = lastMove ? `${lastMove.san}. ` : "";
  if (g.game.inCheck()) return `${prefix}${label(turn)}, you're in check! Protect your king.`;
  return `${prefix}${label(turn)} to move.`;
}

function begin(saved) {
  const game = new Chess();
  for (const uci of saved.moves) game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  g = { ...saved, game, thinking: false, over: null, token: 0, hintsUsed: saved.hintsUsed || 0, undosUsed: saved.undosUsed || 0, coachPending: null };
  if (currentScreen() !== "play") openScreen("play", { onLeave: leave });
  useMode(mode);
  if (isFriend()) {
    setTitle("Two players", `${nameOf("w")} vs ${nameOf("b")}`);
    board.setOrientation(g.autoFlip ? game.turn() : "w");
    render(false);
    save();
    setMessage(game.history().length ? turnMessage() : `${label("w")} moves first. Pass the device after each move.`);
    return;
  }
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
  if (g.over) { writeJson(slot(), null); hooks.onChange(); return; }
  const { level, color, coach, undo, hints, hintsUsed, undosUsed, names, autoFlip } = g;
  writeJson(slot(), { level, color, coach, undo, hints, hintsUsed, undosUsed, names, autoFlip, moves: g.game.history({ verbose: true }).map((m) => m.from + m.to + (m.promotion || "")), savedAt: Date.now() });
  hooks.onChange();
}

const mode = {
  getTargets(from) {
    if (!g || g.over || g.thinking || g.coachPending || g.flipping || g.game.turn() !== moverColor()) return [];
    return targetsFor(g.game, from);
  },
  async onMove(from, to) {
    if (!g) return;
    let promotion;
    if (isPromotionMove(board.pieces, from, to)) {
      promotion = await choosePromotion(moverColor());
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
    if (isFriend()) {
      if (piece && piece.color !== g.game.turn()) setMessage(`It's ${label(g.game.turn())}'s turn.`, "info");
      return;
    }
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
  const plus = (color) => { const v = color === "w" ? balance : -balance; return v > 0 ? v : 0; };
  if (isFriend()) {
    // The player at the bottom is whoever the board faces.
    const bar = (color) => ({ name: nameOf(color), emoji: color === "w" ? "⚪" : "⚫", captured: caps[color], color, plus: plus(color), status: !g.over && game.turn() === color ? "to move" : "" });
    const bottom = board.orientation;
    setBars(bar(bottom === "w" ? "b" : "w"), bar(bottom));
    setMoveList(game.history());
    board.setMovable(!g.over && !g.flipping ? game.turn() : null);
    controls();
    return;
  }
  const bot = BOT[g.level];
  const botColor = g.color === "w" ? "b" : "w";
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
      { label: "✨ New game", onClick: () => openNewGame(isFriend() ? "friend" : "bot") },
      { label: "🔁 Rematch", kind: "primary", onClick: rematch },
    ]);
    return;
  }
  if (isFriend()) {
    setControls([
      ...(g.undo ? [{ label: "↶ Undo", id: "ctl-undo", onClick: undo, disabled: !g.game.history().length }] : []),
      { label: "⇅ Flip", ariaLabel: "Flip the board", onClick: () => { board.setOrientation(board.orientation === "w" ? "b" : "w"); render(false); } },
      { label: "⋯ More", ariaLabel: "Game menu", onClick: () => openOverlay("menu-overlay") },
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

/** A rematch: against the bot you switch colors; two players swap sides. */
function rematch() {
  if (isFriend()) newFriendGame({ names: { w: nameOf("b"), b: nameOf("w") }, autoFlip: g.autoFlip, undo: g.undo });
  else newGame({ ...g, color: g.color === "w" ? "b" : "w" });
}

/** Two players: after a move, turn the board to face the next player (if that's switched on). */
function friendMoved(move) {
  setMessage(turnMessage(move));
  if (!g.autoFlip) return;
  const token = g.token;
  g.flipping = true;
  board.setMovable(null);
  setTimeout(() => {
    if (!g || token !== g.token) return;
    g.flipping = false;
    board.setOrientation(g.game.turn());
    render(false);
  }, 700);
}

function playerMove(spec) {
  if (isFriend()) {
    const move = applyMove(spec);
    if (!finishIfOver()) friendMoved(move);
    return;
  }
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
  g.flipping = false;
  render(false);
  save();
  if (isFriend()) { friendResult(outcome); return true; }
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

/** The result of a two-player game. */
function friendResult(outcome) {
  hooks.onFinish("friend");
  setTimeout(() => {
    if (!g || g.over !== outcome) return;
    const draw = outcome.result === "draw";
    const winner = outcome.result;
    const loser = winner === "w" ? "b" : "w";
    play(draw ? "draw" : "win");
    buzz("win");
    if (!draw) window.confetti?.({ particleCount: 120, spread: 75, origin: { y: 0.6 }, disableForReducedMotion: true });
    const text = draw
      ? OUTCOME_TEXT[outcome.reason]
      : outcome.reason === "resigned" ? `${nameOf(loser)} resigned.` : `${nameOf(winner)} checkmated ${nameOf(loser)}.`;
    showResult({
      emoji: draw ? "🤝" : "🏆",
      title: draw ? "Draw" : `${nameOf(winner)} wins!`,
      text: outcome.reason === "agreed" ? "You agreed to a draw." : text,
      stats: [["Moves", Math.ceil(g.game.history().length / 2)]],
      secondary: ["See the board", null],
      primary: ["Rematch", rematch],
    });
    setMessage(draw ? "The game is a draw." : `${label(winner)} wins! 🎉`);
  }, 700);
}

function undo() {
  if (!g || g.thinking || g.over) return;
  g.token++;
  if (isFriend()) {
    // Two players: take back just the last move.
    const m = g.game.undo();
    if (!m) return;
    g.flipping = false;
    board.setPieces(piecesFromFen(g.game.fen()), { moves: [[m.to, m.from]] });
    if (g.autoFlip) board.setOrientation(g.game.turn());
    render(false);
    save();
    setMessage(`Move taken back. ${turnMessage()}`);
    return;
  }
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
  closeTopThen(() => {
    if (!g || g.over) return;
    if (isFriend()) {
      // The player whose turn it is resigns.
      const loser = g.game.turn();
      const winner = loser === "w" ? "b" : "w";
      confirm(`${nameOf(loser)}, resign?`, `${nameOf(winner)} wins this game.`, "Resign", () => finishIfOver({ result: winner, reason: "resigned" }));
      return;
    }
    confirm("Resign this game?", "The bot wins this game. You can start a new one right away.", "Resign", () => finishIfOver({ result: g.color === "w" ? "b" : "w", reason: "resigned" }));
  });
});
byId("menu-draw").addEventListener("click", () => closeTopThen(offerDraw));
async function offerDraw() {
  if (!g || g.over || g.thinking) return;
  if (isFriend()) {
    // The player to move offers; the other player answers on the same device.
    const other = g.game.turn() === "w" ? "b" : "w";
    confirm(`${nameOf(other)}, accept a draw?`, `${nameOf(g.game.turn())} offers a draw. Hand the device over so ${nameOf(other)} can answer.`, "Accept draw", () => finishIfOver({ result: "draw", reason: "agreed" }));
    return;
  }
  // The bot accepts when it isn't better.
  const { score } = await bestMove(g.game.fen(), positionsSinceReset(g.game));
  const botToMove = g.game.turn() !== g.color;
  const botScore = botToMove ? score : -score;
  if (g.game.history().length >= 20 && botScore <= 30) finishIfOver({ result: "draw", reason: "agreed" });
  else setMessage(g.game.history().length < 20 ? "The bot says: it's too early for a draw. Let's play on!" : "The bot declines: it thinks it's doing fine. Play on!", "info");
}
let openNewGame = () => openOverlay("newgame-overlay");
/** main.js supplies the function that opens the new-game pop-up: openNewGame("bot" | "friend"). */
export const setNewGameOpener = (fn) => { openNewGame = fn; };
byId("menu-new").addEventListener("click", () => closeTopThen(() => openNewGame(isFriend() ? "friend" : "bot")));

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
