// The rules of Learn tasks and Challenges, as pure functions so the content checker
// (scripts/validate-content.mjs), the unit tests and the app all agree.
import { Chess } from "chess.js";
import { Position, sq, sqName, moveTo, moveFrom, movePromo, QUEEN, hangingPieces } from "../chess/engine.js";
import { PIECE_WORD } from "../chess/rules.js";

// ---------- Star tasks ----------
// Only pieces of one type move, the other side never moves, and capturing a piece on a star
// collects it. Positions may have no kings. A king still can't step into check.

const TYPE_NUMBER = { p: 1, n: 2, b: 3, r: 4, q: 5, k: 6 };

function starPosition(fen) {
  const pos = new Position(fen);
  pos.castle = 0;
  return pos;
}

/** Squares the piece on `from` can go to (empty if it isn't the moving piece type). */
export function starTargets(fen, piece, from) {
  const pos = starPosition(fen);
  const p = pos.board[sq(from)];
  if ((p & 7) !== TYPE_NUMBER[piece] || (p & 8 ? 1 : 0) !== pos.side) return [];
  return [...new Set(pos.legalMoves(sq(from)).map((m) => sqName(moveTo(m))))];
}

/** Plays a star-task move. Returns the new FEN (still the same side to move). */
export function starMove(fen, from, to) {
  const pos = starPosition(fen);
  const side = pos.side;
  const m = pos.legalMoves(sq(from)).find((x) => sqName(moveTo(x)) === to && (!movePromo(x) || movePromo(x) === QUEEN));
  if (!m) return null;
  pos.make(m);
  pos.side = side;
  pos.ep = 0;
  pos.halfmove = 0;
  pos.fullmove = 1;
  return pos.fen();
}

/** Fewest moves that collect every star, or Infinity if they can't all be collected. */
export function starPar(fen, piece, stars) {
  const start = { fen, left: stars.filter((s) => s !== null) };
  const key = (s) => s.fen.split(" ")[0] + "|" + [...s.left].sort().join(",");
  const seen = new Set([key(start)]);
  let frontier = [start];
  for (let depth = 1; depth <= 20 && frontier.length; depth++) {
    const next = [];
    for (const state of frontier) {
      const pieces = movingSquares(state.fen, piece);
      for (const from of pieces) {
        for (const to of starTargets(state.fen, piece, from)) {
          const fen2 = starMove(state.fen, from, to);
          const left = state.left.filter((s) => s !== to);
          if (!left.length) return depth;
          const s2 = { fen: fen2, left };
          const k = key(s2);
          if (!seen.has(k)) { seen.add(k); next.push(s2); }
        }
      }
    }
    frontier = next;
  }
  return Infinity;
}

/** Squares holding the side-to-move's pieces of type `piece`. */
export function movingSquares(fen, piece) {
  const pos = starPosition(fen);
  const out = [];
  for (let s = 21; s <= 98; s++) {
    const p = pos.board[s];
    if (p && p !== 7 && (p & 7) === TYPE_NUMBER[piece] && (p & 8 ? 1 : 0) === pos.side) out.push(sqName(s));
  }
  return out;
}

// ---------- One-move tasks ----------

const parse = (uci) => ({ from: uci.slice(0, 2), to: uci.slice(2, 4), ...(uci[4] ? { promotion: uci[4] } : {}) });
export const moveUci = (m) => m.from + m.to + (m.promotion || "");

/** The FEN the player moves from: the task's FEN after any `pre` move. */
export function taskStartFen(task) {
  if (!task.pre) return task.fen;
  const game = new Chess(task.fen);
  game.move(parse(task.pre));
  return game.fen();
}

const WAY_TEXT = { king: "move your king", block: "block the check", capture: "capture the attacker" };

/**
 * Judges a move in a "move" task. `uci` must be legal in `fen`.
 * Returns { ok, message, move } where move is chess.js's verbose move.
 */
export function judgeMove(task, fen, uci) {
  const game = new Chess(fen);
  const move = game.move(parse(uci));
  const wrongFor = () => task.wrong?.[uci] || task.wrong?.[uci.slice(0, 4)] || task.wrongDefault;
  switch (task.goal) {
    case "mate": {
      if (game.isCheckmate()) return { ok: true, move };
      if (game.isStalemate()) return { ok: false, move, message: "That's stalemate: Black has no legal move but isn't in check, so it would only be a draw!" };
      if (game.inCheck()) {
        const escape = game.moves({ verbose: true })[0];
        const how = escape.piece === "k" ? `the king can escape to ${escape.to}` : escape.captured ? `Black can capture with ${escape.san}` : `Black can block with ${escape.san}`;
        return { ok: false, move, message: wrongFor() || `That's check, but ${how}.` };
      }
      return { ok: false, move, message: wrongFor() || "That doesn't give check. Every checkmate starts with a check." };
    }
    case "check":
      return game.inCheck() ? { ok: true, move } : { ok: false, move, message: wrongFor() || "That doesn't attack the king. Look for a square where your piece can reach it." };
    case "escape": {
      const way = move.piece === "k" ? "king" : move.captured ? "capture" : "block";
      if (way === task.way) return { ok: true, move };
      return { ok: false, move, message: `That gets out of check too, but this time ${WAY_TEXT[task.way]}.` };
    }
    case "safe": {
      const pos = new Position(game.fen());
      const side = move.color === "w" ? 0 : 1;
      const hanging = hangingPieces(pos, side);
      if (!hanging.length) return { ok: true, move };
      const square = sqName(hanging[0]);
      const piece = game.get(square);
      return { ok: false, move, message: wrongFor() || `Your ${PIECE_WORD[piece.type]} on ${square} can still be captured.` };
    }
    case "promote":
      return move.promotion ? { ok: true, move } : { ok: false, move, message: wrongFor() || "Push a pawn all the way to the last row." };
    case "exact":
    default:
      if ((task.accept || []).includes(uci) || (task.accept || []).includes(uci.slice(0, 4))) return { ok: true, move };
      return { ok: false, move, message: wrongFor() || "Not quite. Try again!" };
  }
}

/** Every legal move that solves a "move" task (for the content checker and hints). */
export function solutions(task) {
  const fen = taskStartFen(task);
  const game = new Chess(fen);
  return game.moves({ verbose: true }).map(moveUci).filter((uci) => judgeMove(task, fen, uci).ok);
}

// ---------- Puzzles ----------
// A puzzle is { fen, line: ["e2e4", …] } where the player plays the even steps. For a mate, any
// mating move finishes it; `accept` can list other moves that are just as good at each step.

/** Judges the player's move at step `index` of a puzzle. Returns "ok", "done" (solved) or "wrong". */
export function judgePuzzleMove(puzzle, index, fen, uci) {
  const expected = puzzle.line[index];
  const game = new Chess(fen);
  game.move(parse(uci));
  const last = index >= puzzle.line.length - 1;
  if (game.isCheckmate()) return "done";
  const ok = uci === expected || (puzzle.accept?.[index] || []).includes(uci) || uci.slice(0, 4) === expected && expected.length === 4;
  if (!ok) return "wrong";
  return last ? "done" : "ok";
}

export { parse as parseUci, moveFrom };
