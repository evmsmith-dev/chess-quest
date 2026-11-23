// The game review screen: after a game, the engine looks at every move by the player (or by both
// players in a two-player game) and shows the few moments that mattered most. At each one you
// can see what was played, try to find a better move yourself (with instant feedback), or be
// shown it. It opens on top of the finished game; Back returns to it.
import { Chess, targetsFor, animationFor, checkSquare, explainIllegal, piecesFromFen } from "../chess/rules.js";
import { scorePositions } from "../chess/bot.js";
import { reviewPositions, classify, pickMoments, judgeTry, REVIEW_SEARCH } from "../lib/review.js";
import { board, useMode, setTitle, setMessage, setControls, setBars, feelMove, choosePromotion, isPromotionMove } from "./boardscreen.js";
import { openScreen } from "../ui/overlays.js";
import { play } from "../ui/audio.js";
import { buzz } from "../ui/haptics.js";

const byId = (id) => document.getElementById(id);
const LABEL = {
  "missed-mate": "❗ Missed checkmate",
  "allowed-mate": "❌ Allowed checkmate",
  blunder: "❌ Big mistake",
  mistake: "⚠️ Mistake",
};

let R = null;

/**
 * Opens the review of a finished game.
 * moves: ["e2e4", …]; colors: whose moves to review; nameOf(color) → "You" / "Ana";
 * opponentOf(color) → "the bot" / "Ben"; finalFen and orientation for the starting view;
 * onExit runs when the player leaves (to restore the game screen).
 */
export function startReview({ moves, colors, nameOf, opponentOf, title = "Game review", sub = "", orientation = "w", onExit }) {
  R = { moves, colors, nameOf, opponentOf, moments: null, index: 0, trying: false, token: 0 };
  const mine = R;
  openScreen("play", { onLeave: () => { if (R === mine) R = null; onExit?.(); } });
  useMode(mode);
  setTitle(title, sub);
  setBars(null, null);
  const final = new Chess();
  for (const uci of moves) final.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  board.setOrientation(orientation);
  board.setPieces(piecesFromFen(final.fen()), { animate: false });
  board.setHighlights({ check: checkSquare(final) });
  board.setMovable(null);
  byId("move-list").hidden = true;
  progress(0);
  setControls([]);
  analyse(mine);
}

function progress(fraction) {
  setMessage(`<strong>Reviewing the game…</strong><span class="review-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(fraction * 100)}"><span style="width:${Math.round(fraction * 100)}%"></span></span>`);
}

async function analyse(mine) {
  const positions = reviewPositions(mine.moves, mine.colors);
  if (!positions.length) { show(mine, []); return; }
  const scores = await scorePositions(positions.map((p) => p.fen), REVIEW_SEARCH, (f) => { if (R === mine) progress(f); });
  if (R !== mine) return;
  const moments = positions.map((p, i) => classify(p, scores[i], { you: mine.nameOf(p.color), them: mine.opponentOf(p.color) }));
  show(mine, pickMoments(moments));
}

function show(mine, moments) {
  mine.moments = moments;
  if (!moments.length) {
    const list = byId("move-list");
    list.hidden = true;
    setMessage("🎉 <strong>No big mistakes!</strong> The engine didn't find any moment where a much better move was missed. Nicely played.", "good");
    setControls([{ label: "↩︎ Back to the game", kind: "primary", onClick: () => history.back() }]);
    return;
  }
  select(0);
}

function renderChips() {
  const list = byId("move-list");
  list.hidden = false;
  list.classList.add("review-moments");
  list.setAttribute("aria-label", "Key moments");
  list.innerHTML = R.moments.map((m, i) => `<li><button type="button" class="moment-chip${i === R.index ? " is-current" : ""}" data-moment="${i}" aria-current="${i === R.index}">${LABEL[m.kind].split(" ")[0]} Move ${m.number}${m.color === "b" ? "…" : ""}</button></li>`).join("");
}
byId("move-list").addEventListener("click", (e) => {
  const i = e.target.closest("[data-moment]")?.dataset.moment;
  if (R?.moments && i !== undefined) select(Number(i));
});

function select(index) {
  R.index = index;
  R.trying = false;
  R.token++;
  const m = R.moments[index];
  R.game = new Chess(m.fen);
  board.setOrientation(m.color);
  board.setPieces(piecesFromFen(m.fen), { animate: false });
  board.setHighlights({ lastMove: [m.played.slice(0, 2), m.played.slice(2, 4)], bad: m.played.slice(2, 4), check: checkSquare(R.game) });
  board.setMovable(null);
  renderChips();
  const who = R.nameOf(m.color);
  setMessage(`<strong>${LABEL[m.kind]} · move ${m.number}</strong><span class="review-text">${who === "You" ? "You" : who} played <strong>${m.playedSan}</strong>. ${m.text}</span>`, m.kind === "mistake" ? "info" : "bad");
  controls();
}

function controls() {
  const last = R.index === R.moments.length - 1;
  setControls([
    { label: "◀", ariaLabel: "Previous moment", onClick: () => select(R.index - 1), disabled: R.index === 0 },
    { label: "🎯 Try it", id: "ctl-try", kind: R.trying ? "" : "accent", onClick: tryIt },
    { label: "💡 Show", id: "ctl-show", onClick: showBest },
    { label: "▶", ariaLabel: last ? "Back to the game" : "Next moment", onClick: () => (last ? history.back() : select(R.index + 1)) },
  ]);
}

/** Lets the player look for a better move on the board. */
function tryIt() {
  const m = R.moments[R.index];
  R.trying = true;
  R.token++;
  R.game = new Chess(m.fen);
  board.setPieces(piecesFromFen(m.fen), { animate: false });
  board.setHighlights({ check: checkSquare(R.game) });
  board.setMovable(m.color);
  const side = m.color === "w" ? "White" : "Black";
  setMessage(`🎯 <strong>Your turn as ${side}.</strong> Find a better move than ${m.playedSan}.`);
  controls();
}

function showBest() {
  const m = R.moments[R.index];
  R.trying = false;
  R.token++;
  const game = new Chess(m.fen);
  board.setPieces(piecesFromFen(m.fen), { animate: false });
  board.setMovable(null);
  const move = game.move({ from: m.best.slice(0, 2), to: m.best.slice(2, 4), promotion: m.best[4] });
  const token = R.token;
  setTimeout(() => {
    if (!R || R.token !== token) return;
    board.setPieces(piecesFromFen(game.fen()), { moves: animationFor(move) });
    board.setHighlights({ lastMove: [move.from, move.to], good: move.to, check: checkSquare(game) });
    feelMove(move, game.inCheck());
  }, 150);
  setMessage(`💡 <strong>Better: ${m.bestSan}</strong><span class="review-text">${m.text}</span>`, "good");
  controls();
}

const mode = {
  getTargets(from) { return R?.trying ? targetsFor(R.game, from) : []; },
  async onMove(from, to) {
    if (!R?.trying) return;
    const m = R.moments[R.index];
    let promotion;
    if (isPromotionMove(board.pieces, from, to)) {
      promotion = await choosePromotion(m.color);
      if (!promotion) { board.setPieces(piecesFromFen(R.game.fen()), { animate: false }); return; }
    }
    const move = R.game.move({ from, to, promotion });
    const uci = from + to + (move.promotion || "");
    board.setPieces(piecesFromFen(R.game.fen()), { moves: animationFor(move) });
    feelMove(move, R.game.inCheck());
    const result = judgeTry(m, uci);
    if (result.verdict !== "worse") {
      R.trying = false;
      board.setMovable(null);
      board.setHighlights({ lastMove: [from, to], good: to, check: checkSquare(R.game) });
      play("correct");
      buzz("win");
      setMessage(result.verdict === "best" ? `✅ <strong>That's it: ${move.san}!</strong> ${m.text}` : `✅ <strong>${move.san} works too!</strong> It's as strong as ${m.bestSan}.`, "good");
      controls();
      return;
    }
    board.setMovable(null);
    board.setHighlights({ lastMove: [from, to], bad: to, check: checkSquare(R.game) });
    play("wrong");
    buzz("wrong");
    setMessage(result.mateMissed ? `❌ ${move.san} isn't it. There's a checkmate here. Keep looking, or tap 💡 Show.`
      : `❌ ${move.san} isn't better${result.lost ? `: it gives away about ${result.lost} point${result.lost === 1 ? "" : "s"}` : ""}. Try again, or tap 💡 Show.`, "bad");
    const token = R.token;
    setTimeout(() => {
      if (!R || R.token !== token) return;
      R.game.undo();
      board.setPieces(piecesFromFen(R.game.fen()), { moves: animationFor(move).map(([a, b]) => [b, a]) });
      board.setHighlights({ check: checkSquare(R.game) });
      board.setMovable(m.color);
    }, 900);
  },
  onIllegal(from, to) {
    if (!R?.trying) return;
    const reason = explainIllegal(R.game.fen(), from, to);
    if (reason) { play("illegal"); setMessage(reason, "info"); }
  },
  onTap() {
    if (R?.moments?.length && !R.trying) setMessage(`Tap <strong>🎯 Try it</strong> to look for a better move yourself.`, "info");
  },
  leave() {
    const list = byId("move-list");
    list.classList.remove("review-moments");
    list.setAttribute("aria-label", "Moves");
  },
};
