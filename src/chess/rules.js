// Helpers between chess.js (the referee) and the screens: the position as a map for the board,
// where a piece may go, why a move isn't allowed, captured pieces, and how a game ended.
import { Chess } from "chess.js";
import { Position, sq, EMPTY, BLACK } from "./engine.js";

export { Chess };

export const PIECE_WORD = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };
export const PIECE_VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/** The position as { e1: "wk", … }. Works for chess.js games and raw FENs (even without kings). */
export function piecesFromFen(fen) {
  const out = {};
  const rows = fen.split(" ")[0].split("/");
  rows.forEach((row, r) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) { f += Number(ch); continue; }
      out["abcdefgh"[f] + (8 - r)] = (ch === ch.toLowerCase() ? "b" : "w") + ch.toLowerCase();
      f++;
    }
  });
  return out;
}

/** Squares the piece on `from` can legally move to. */
export function targetsFor(game, from) {
  return [...new Set(game.moves({ square: from, verbose: true }).map((m) => m.to))];
}

/** Board animation pairs for a chess.js move (castling moves the rook too). */
export function animationFor(move) {
  const pairs = [[move.from, move.to]];
  if (move.flags.includes("k")) pairs.push([`h${move.from[1]}`, `f${move.from[1]}`]);
  if (move.flags.includes("q")) pairs.push([`a${move.from[1]}`, `d${move.from[1]}`]);
  return pairs;
}

/** The square of the king in check, if any. */
export function checkSquare(game) {
  if (!game.inCheck()) return null;
  const turn = game.turn();
  for (const row of game.board()) for (const cell of row) if (cell && cell.type === "k" && cell.color === turn) return cell.square;
  return null;
}

const HOW_IT_MOVES = {
  p: "Pawns move straight ahead one square (two on their first move) and capture one square diagonally forward.",
  n: "Knights move in an L: two squares one way, then one square to the side. They can jump over pieces.",
  b: "Bishops move any distance diagonally, but can't jump over pieces.",
  r: "Rooks move any distance up, down or sideways, but can't jump over pieces.",
  q: "The queen moves any distance in a straight line or diagonally, but can't jump over pieces.",
  k: "The king moves one square in any direction.",
};

/**
 * A short, friendly reason why the piece on `from` can't go to `to`. Uses the bot's move
 * generator, which also knows "moves" that would leave the king in check.
 */
export function explainIllegal(fen, from, to) {
  const pos = new Position(fen);
  const piece = pos.board[sq(from)];
  if (piece === EMPTY) return "";
  const type = ".pnbrqk"[piece & 7];
  const side = piece & BLACK ? 1 : 0;
  if (side !== pos.side) return "It's not that side's turn.";
  const target = pos.board[sq(to)];
  if (target !== EMPTY && (target & BLACK ? 1 : 0) === side) return "You can't capture your own piece.";
  // Castling first: the move generator may list it, and then the generic king message would win.
  if (type === "k" && Math.abs(from.charCodeAt(0) - to.charCodeAt(0)) === 2 && from[1] === to[1]) {
    return castleReason(fen, from, to);
  }
  const pseudo = pos.pseudoMoves(false, sq(from)).some((m) => ((m >> 7) & 127) === sq(to));
  if (pseudo) {
    if (pos.inCheck()) return "Your king is in check. You must protect it first: move the king, block the check, or capture the attacker.";
    if (type === "k") return "Your king can't move to a square where it would be in check.";
    return `That ${PIECE_WORD[type]} is pinned: moving it would put your own king in check.`;
  }
  if (pos.inCheck()) return `Your king is in check, so first deal with that. ${HOW_IT_MOVES[type]}`;
  return HOW_IT_MOVES[type];
}

/** The particular reason castling from `from` to `to` isn't allowed. */
export function castleReason(fen, from, to) {
  const game = new Chess(fen);
  const color = game.turn();
  const enemy = color === "w" ? "b" : "w";
  const rank = color === "w" ? "1" : "8";
  const kingside = to.charCodeAt(0) > from.charCodeAt(0);
  const side = kingside ? "kingside" : "queenside";
  const rookSquare = (kingside ? "h" : "a") + rank;
  const rights = game.getCastlingRights(color);
  const name = (square) => { const p = game.get(square); return p ? `the ${PIECE_WORD[p.type]} on ${square}` : square; };
  const attackedBy = (square) => game.attackers(square, enemy).map(name);
  if (from !== "e" + rank || (!rights.k && !rights.q)) return "Your king has already moved this game, so it can't castle any more.";
  if (!(kingside ? rights.k : rights.q)) return `The rook on ${rookSquare} has already moved (or been captured), so you can't castle ${side} any more.`;
  if (game.inCheck()) {
    const by = attackedBy(from);
    return `You're in check${by.length ? ` from ${by.join(" and ")}` : ""}, and you can't castle out of check. Block the check, capture the attacker, or move the king. You can castle later once you're safe.`;
  }
  const between = kingside ? ["f", "g"] : ["d", "c", "b"];
  const blockers = between.map((f) => f + rank).filter((square) => game.get(square));
  if (blockers.length) {
    const list = blockers.map(name);
    return `${list.join(" and ").replace(/^./, (c) => c.toUpperCase())} ${list.length > 1 ? "are" : "is"} in the way: the squares between the king and the rook must be empty to castle.`;
  }
  const passing = (kingside ? "f" : "d") + rank;
  const by = attackedBy(passing);
  if (by.length) return `The king can't pass through check: ${passing} is attacked by ${by.join(" and ")}.`;
  const landing = attackedBy(to);
  if (landing.length) return `The king would land in check on ${to}: it's attacked by ${landing.join(" and ")}.`;
  return "You can't castle right now. The king and rook must not have moved, the squares between them must be empty, and the king can't be in, pass through, or land in check.";
}

/** Pieces captured so far, by the color that captured them: { w: ["p", …], b: [...] }. */
export function capturedPieces(game) {
  const start = { p: 8, n: 2, b: 2, r: 2, q: 1 };
  const left = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } };
  for (const row of game.board()) for (const cell of row) if (cell && cell.type !== "k") left[cell.color][cell.type]++;
  const out = { w: [], b: [] };
  for (const type of ["q", "r", "b", "n", "p"]) {
    // Promotions can make "left" exceed the start count; then nothing of that type is missing.
    for (let i = 0; i < Math.max(0, start[type] - left.b[type]); i++) out.w.push(type);
    for (let i = 0; i < Math.max(0, start[type] - left.w[type]); i++) out.b.push(type);
  }
  return out;
}

/** Material balance in pawns from White's view. */
export function materialBalance(game) {
  let total = 0;
  for (const row of game.board()) for (const cell of row) if (cell) total += (cell.color === "w" ? 1 : -1) * PIECE_VALUE[cell.type];
  return total;
}

/** How the game ended, or null: { result: "w" | "b" | "draw", reason } */
export function gameOutcome(game) {
  if (game.isCheckmate()) return { result: game.turn() === "w" ? "b" : "w", reason: "checkmate" };
  if (game.isStalemate()) return { result: "draw", reason: "stalemate" };
  if (game.isInsufficientMaterial()) return { result: "draw", reason: "insufficient" };
  if (game.isThreefoldRepetition()) return { result: "draw", reason: "repetition" };
  if (game.isDrawByFiftyMoves()) return { result: "draw", reason: "fifty" };
  return null;
}

export const OUTCOME_TEXT = {
  checkmate: "by checkmate",
  stalemate: "Stalemate: the player to move has no legal move but isn't in check, so the game is a draw.",
  insufficient: "Neither side has enough pieces left to checkmate, so the game is a draw.",
  repetition: "The same position came up three times, so the game is a draw.",
  fifty: "Fifty moves each went by without a capture or a pawn move, so the game is a draw.",
  agreed: "You agreed to a draw.",
  resigned: "You resigned.",
};
