// Game review: find the moments in a finished game that mattered most, and explain them in
// plain words. The engine scores every legal move in each position where the player moved
// (scorePosition); classify() compares the move played with the best one, and pickMoments()
// keeps the biggest few. Pure functions, so the unit tests and the worker share them.
import { Chess } from "chess.js";
import { Position, Searcher, hangingPieces, sqName, sq, MATE, uciString, VALUE, EMPTY } from "../chess/engine.js";

export const REVIEW_SEARCH = { depth: 3, timeMs: 220 };
export const MAX_MOMENTS = 3;
const MATE_ZONE = MATE - 1000;
const BLUNDER = 250; // centipawns lost: about a minor piece
const MISTAKE = 120;
const GOOD_ENOUGH = 60; // in "try it", moves this close to the best count as finding it

const PIECE = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };
const TYPE_LETTER = ".pnbrqk";

/** Every legal move in `fen` with the engine's score (mover's view), best first. */
export function scorePosition(fen, searcher = new Searcher(), search = REVIEW_SEARCH) {
  const pos = new Position(fen);
  return searcher.rootScores(pos, search).map((r) => ({ uci: uciString(r.move), score: r.score }));
}

/** The positions to review: before each move by one of `colors` ("w"/"b"). */
export function reviewPositions(moves, colors) {
  const game = new Chess();
  const out = [];
  moves.forEach((uci, ply) => {
    const color = game.turn();
    if (colors.includes(color)) out.push({ ply, fen: game.fen(), uci, color });
    game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  });
  return out;
}

const san = (fen, uci) => {
  try { return new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san; } catch { return uci; }
};
const moveNumber = (fen) => Number(fen.split(" ")[5]) || 1;
const isMate = (score) => score > MATE_ZONE;
const isMated = (score) => score < -MATE_ZONE;
const points = (cp) => Math.max(1, Math.round(cp / 100));

/**
 * Judges one move. `scores` is scorePosition() for the position before it. `names` gives
 * { you, them } for the text, e.g. { you: "You", them: "the bot" }. Returns a moment or null.
 */
export function classify({ ply, fen, uci, color }, scores, names = { you: "You", them: "your opponent" }) {
  if (!scores?.length) return null;
  const best = scores[0];
  const played = scores.find((s) => s.uci === uci) || scores.find((s) => s.uci.startsWith(uci.slice(0, 4)));
  if (!played || played.uci === best.uci) return null;
  const loss = best.score - played.score;
  let kind = null;
  let severity = loss;
  if (isMate(best.score) && !isMate(played.score)) { kind = "missed-mate"; severity = 100000; }
  else if (isMated(played.score) && !isMated(best.score)) { kind = "allowed-mate"; severity = 90000; }
  else if (isMate(best.score) || isMated(best.score)) return null; // winning or lost either way
  else if (best.score >= 900 && played.score >= 500) return null; // still clearly winning
  else if (best.score <= -900) return null; // already lost: nothing to learn here
  else if (loss >= BLUNDER) kind = "blunder";
  else if (loss >= MISTAKE) kind = "mistake";
  else return null;

  const bestSan = san(fen, best.uci);
  const playedSan = san(fen, uci);
  const text = explain({ kind, fen, uci, best, loss, bestSan, color, names });
  return {
    ply, fen, color, kind, severity,
    number: moveNumber(fen),
    played: uci, playedSan,
    best: best.uci, bestSan,
    // Moves as good as the best (within GOOD_ENOUGH), for "try to find a better move".
    good: scores.filter((s) => s.score >= best.score - GOOD_ENOUGH && !(isMate(best.score) && !isMate(s.score))).map((s) => s.uci),
    scores: Object.fromEntries(scores.map((s) => [s.uci, s.score])),
    text,
  };
}

function explain({ kind, fen, uci, best, loss, bestSan, color, names }) {
  const { you, them } = names;
  const side = color === "w" ? 0 : 1;
  if (kind === "missed-mate") {
    const inOne = best.score === MATE - 1;
    return inOne ? `${you} had checkmate in one: ${bestSan}!` : `${you} had a forced checkmate, starting with ${bestSan}.`;
  }
  if (kind === "allowed-mate") return `This let ${them} force checkmate. ${bestSan} was safer.`;

  // Did the move leave a piece where it could be won? Did the best move win something?
  // When both, say the bigger one first.
  let hangingText = null, hangingValue = 0, missedText = null, missedValue = 0;
  const after = new Position(fen);
  const m = after.legalMoves().find((x) => uciString(x) === uci || uciString(x).startsWith(uci));
  if (m) {
    after.make(m);
    const hanging = hangingPieces(after, side);
    const to = uci.slice(2, 4);
    const square = hanging.map(sqName).find((s) => s === to) || (hanging[0] ? sqName(hanging[0]) : null);
    if (square) {
      const type = after.board[sq(square)] & 7;
      if (TYPE_LETTER[type] !== "p" || loss >= BLUNDER) {
        hangingValue = VALUE[type];
        hangingText = `This left ${you === "You" ? "your" : `${you}'s`} ${PIECE[TYPE_LETTER[type]]} on ${square} where it could be taken.`;
      }
    }
  }
  const before = new Position(fen);
  const target = before.board[sq(best.uci.slice(2, 4))];
  if (target !== EMPTY && (target & 7) !== 6) {
    const defended = before.lowestAttacker(sq(best.uci.slice(2, 4)), side ^ 1) !== 0;
    const attacker = before.board[sq(best.uci.slice(0, 2))] & 7;
    if (!defended || VALUE[target & 7] > VALUE[attacker]) {
      missedValue = VALUE[target & 7];
      missedText = `${them[0].toUpperCase()}${them.slice(1)}'s ${PIECE[TYPE_LETTER[target & 7]]} on ${best.uci.slice(2, 4)} could be won: ${bestSan}.`;
    }
  }
  if (missedText && hangingText) {
    return missedValue >= hangingValue ? `${missedText} ${hangingText}` : `${hangingText} Also: ${missedText}`;
  }
  if (missedText) return missedText;
  if (hangingText) return `${hangingText} ${bestSan} was better.`;
  return `This gave away about ${points(loss)} point${points(loss) === 1 ? "" : "s"} of value. ${bestSan} was stronger.`;
}

/** The biggest moments (at most `max`), in the order they happened. */
export function pickMoments(moments, max = MAX_MOMENTS) {
  return moments.filter(Boolean).sort((a, b) => b.severity - a.severity).slice(0, max).sort((a, b) => a.ply - b.ply);
}

/** Feedback on a move tried at a review moment: "best", "good" or "worse" (with points lost). */
export function judgeTry(moment, uci) {
  const score = moment.scores[uci] ?? moment.scores[Object.keys(moment.scores).find((u) => u.startsWith(uci))];
  if (uci === moment.best || moment.good.includes(uci)) return { verdict: uci === moment.best ? "best" : "good" };
  const bestScore = moment.scores[moment.best];
  if (score === undefined) return { verdict: "worse", lost: 0 };
  return { verdict: "worse", lost: points(bestScore - score), mateMissed: isMate(bestScore) && !isMate(score) };
}
