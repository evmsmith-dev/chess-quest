// The computer player: a fast move generator, an evaluation and an alpha-beta search.
// chess.js (in the UI) is the referee; it's far too slow to search with (about 10,000 positions
// a second), so the bot has its own board. Both read and write FEN, so they never disagree about
// a position, and tests/unit/engine.test.js checks this move generator against chess.js.
//
// Board: a 10×12 "mailbox" so a step off the edge lands on a border square.
// a8 = 21, h8 = 28, a1 = 91, h1 = 98. White moves up the board (toward smaller numbers).
// Pieces: 1 pawn, 2 knight, 3 bishop, 4 rook, 5 queen, 6 king; black adds 8. 0 empty, 7 border.
// Positions may have no kings (the Learn path's piece-movement boards): then nothing is "check".

export const EMPTY = 0;
export const OFF = 7;
export const PAWN = 1, KNIGHT = 2, BISHOP = 3, ROOK = 4, QUEEN = 5, KING = 6;
export const BLACK = 8;
export const WHITE_SIDE = 0, BLACK_SIDE = 1;

const FLAG_CAPTURE = 1, FLAG_EP = 2, FLAG_CASTLE = 4, FLAG_DOUBLE = 8, FLAG_PROMO = 16;

const N = -10, S = 10, E = 1, W = -1;
const KNIGHT_STEPS = [-21, -19, -12, -8, 8, 12, 19, 21];
const KING_STEPS = [-11, -10, -9, -1, 1, 9, 10, 11];
const BISHOP_STEPS = [-11, -9, 9, 11];
const ROOK_STEPS = [-10, -1, 1, 10];

export const VALUE = [0, 100, 320, 330, 500, 900, 0];
const LETTERS = ".pnbrqk";

/** "e4" → mailbox square. */
export function sq(name) {
  const file = name.charCodeAt(0) - 97;
  const rank = name.charCodeAt(1) - 49;
  return 21 + file + (7 - rank) * 10;
}
/** Mailbox square → "e4". */
export function sqName(s) {
  const file = (s % 10) - 1;
  const rank = 9 - Math.floor(s / 10) + 1; // row 2 → rank 8
  return String.fromCharCode(97 + file) + String(rank);
}
const fileOf = (s) => (s % 10) - 1;
const rowOf = (s) => Math.floor(s / 10) - 2; // 0 = rank 8 … 7 = rank 1

// Castling rights: 1 white short, 2 white long, 4 black short, 8 black long. Moving from or to a
// square clears the rights that need that square untouched.
const CASTLE_MASK = new Uint8Array(120).fill(15);
CASTLE_MASK[95] = 15 & ~3; CASTLE_MASK[98] = 15 & ~1; CASTLE_MASK[91] = 15 & ~2;
CASTLE_MASK[25] = 15 & ~12; CASTLE_MASK[28] = 15 & ~4; CASTLE_MASK[21] = 15 & ~8;

// ---------- Hashing (for repetitions and the transposition table) ----------
let seed = 0x2545f491;
const rand32 = () => {
  seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
  return seed | 0;
};
const Z_PIECE = Array.from({ length: 15 }, () => Int32Array.from({ length: 120 }, rand32));
const Z_SIDE = rand32();
const Z_CASTLE = Int32Array.from({ length: 16 }, rand32);
const Z_EP = Int32Array.from({ length: 120 }, rand32);

// ---------- Position ----------

export class Position {
  constructor(fen) {
    this.board = new Int8Array(120).fill(OFF);
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) this.board[21 + f + r * 10] = EMPTY;
    this.side = WHITE_SIDE;
    this.castle = 0;
    this.ep = 0;
    this.halfmove = 0;
    this.fullmove = 1;
    this.kings = [0, 0];
    this.hash = 0;
    this.history = []; // undo records
    this.hashes = []; // earlier positions' hashes, for repetitions
    if (fen) this.load(fen);
  }

  load(fen) {
    const [placement, side = "w", castling = "-", ep = "-", half = "0", full = "1"] = fen.trim().split(/\s+/);
    const rows = placement.split("/");
    this.kings = [0, 0];
    for (let r = 0; r < 8; r++) {
      let f = 0;
      for (const ch of rows[r] || "") {
        if (/\d/.test(ch)) {
          for (let k = 0; k < Number(ch); k++) this.board[21 + f++ + r * 10] = EMPTY;
        } else {
          const type = LETTERS.indexOf(ch.toLowerCase());
          const piece = type | (ch === ch.toLowerCase() ? BLACK : 0);
          const s = 21 + f + r * 10;
          this.board[s] = piece;
          if (type === KING) this.kings[piece & BLACK ? 1 : 0] = s;
          f++;
        }
      }
    }
    this.side = side === "b" ? BLACK_SIDE : WHITE_SIDE;
    this.castle = (castling.includes("K") ? 1 : 0) | (castling.includes("Q") ? 2 : 0) | (castling.includes("k") ? 4 : 0) | (castling.includes("q") ? 8 : 0);
    this.ep = ep !== "-" ? sq(ep) : 0;
    this.halfmove = Number(half) || 0;
    this.fullmove = Number(full) || 1;
    this.history = [];
    this.hashes = [];
    this.hash = this.computeHash();
  }

  computeHash() {
    let h = 0;
    for (let s = 21; s <= 98; s++) {
      const p = this.board[s];
      if (p !== EMPTY && p !== OFF) h ^= Z_PIECE[p][s];
    }
    if (this.side) h ^= Z_SIDE;
    h ^= Z_CASTLE[this.castle];
    if (this.ep) h ^= Z_EP[this.ep];
    return h;
  }

  fen() {
    let out = "";
    for (let r = 0; r < 8; r++) {
      let gap = 0;
      for (let f = 0; f < 8; f++) {
        const p = this.board[21 + f + r * 10];
        if (p === EMPTY) { gap++; continue; }
        if (gap) { out += gap; gap = 0; }
        const letter = LETTERS[p & 7];
        out += p & BLACK ? letter : letter.toUpperCase();
      }
      if (gap) out += gap;
      if (r < 7) out += "/";
    }
    const c = (this.castle & 1 ? "K" : "") + (this.castle & 2 ? "Q" : "") + (this.castle & 4 ? "k" : "") + (this.castle & 8 ? "q" : "");
    return `${out} ${this.side ? "b" : "w"} ${c || "-"} ${this.ep ? sqName(this.ep) : "-"} ${this.halfmove} ${this.fullmove}`;
  }

  /** True if `s` is attacked by `bySide` (0 white, 1 black). */
  attacked(s, bySide) {
    const b = this.board;
    const color = bySide ? BLACK : 0;
    // Pawns: a white pawn attacks up-left and up-right, so look down from the square.
    const pawnDir = bySide ? -10 : 10;
    if (b[s + pawnDir - 1] === (PAWN | color) || b[s + pawnDir + 1] === (PAWN | color)) return true;
    for (const d of KNIGHT_STEPS) if (b[s + d] === (KNIGHT | color)) return true;
    for (const d of KING_STEPS) if (b[s + d] === (KING | color)) return true;
    for (const d of BISHOP_STEPS) {
      let t = s + d;
      while (b[t] === EMPTY) t += d;
      if (b[t] === (BISHOP | color) || b[t] === (QUEEN | color)) return true;
    }
    for (const d of ROOK_STEPS) {
      let t = s + d;
      while (b[t] === EMPTY) t += d;
      if (b[t] === (ROOK | color) || b[t] === (QUEEN | color)) return true;
    }
    return false;
  }

  inCheck(side = this.side) {
    const k = this.kings[side];
    return k ? this.attacked(k, side ^ 1) : false;
  }

  /**
   * Pseudo-legal moves (may leave the king in check) as packed integers:
   * from | to << 7 | promotion type << 14 | flags << 17. `capturesOnly` also keeps promotions.
   */
  pseudoMoves(capturesOnly = false, onlyFrom = 0) {
    const b = this.board;
    const moves = [];
    const us = this.side ? BLACK : 0;
    const them = us ^ BLACK;
    const isEnemy = (p) => p !== EMPTY && p !== OFF && (p & BLACK) === them;
    const add = (from, to, flags = 0, promo = 0) => moves.push(from | (to << 7) | (promo << 14) | (flags << 17));
    const start = onlyFrom || 21, end = onlyFrom || 98;
    for (let from = start; from <= end; from++) {
      const p = b[from];
      if (p === EMPTY || p === OFF || (p & BLACK) !== us) continue;
      const type = p & 7;
      if (type === PAWN) {
        const fwd = us ? S : N;
        const startRow = us ? 1 : 6;
        const lastRow = us ? 7 : 0;
        const one = from + fwd;
        const promoting = rowOf(one) === lastRow;
        if (b[one] === EMPTY) {
          if (promoting) for (const pr of [QUEEN, KNIGHT, ROOK, BISHOP]) add(from, one, FLAG_PROMO, pr);
          else if (!capturesOnly) {
            add(from, one);
            if (rowOf(from) === startRow && b[one + fwd] === EMPTY) add(from, one + fwd, FLAG_DOUBLE);
          }
        }
        for (const side of [W, E]) {
          const to = one + side;
          if (isEnemy(b[to])) {
            if (promoting) for (const pr of [QUEEN, KNIGHT, ROOK, BISHOP]) add(from, to, FLAG_CAPTURE | FLAG_PROMO, pr);
            else add(from, to, FLAG_CAPTURE);
          } else if (to === this.ep && this.ep) add(from, to, FLAG_CAPTURE | FLAG_EP);
        }
        continue;
      }
      const steps = type === KNIGHT ? KNIGHT_STEPS : type === BISHOP ? BISHOP_STEPS : type === ROOK ? ROOK_STEPS : KING_STEPS;
      const slides = type === BISHOP || type === ROOK || type === QUEEN;
      for (const d of steps) {
        let to = from + d;
        while (true) {
          const t = b[to];
          if (t === OFF) break;
          if (t === EMPTY) { if (!capturesOnly) add(from, to); }
          else { if ((t & BLACK) === them) add(from, to, FLAG_CAPTURE); break; }
          if (!slides) break;
          to += d;
        }
      }
      if (type === KING && !capturesOnly) {
        const enemy = this.side ^ 1;
        if (!us && from === 95) {
          if (this.castle & 1 && b[96] === EMPTY && b[97] === EMPTY && b[98] === ROOK && !this.attacked(95, enemy) && !this.attacked(96, enemy)) add(95, 97, FLAG_CASTLE);
          if (this.castle & 2 && b[94] === EMPTY && b[93] === EMPTY && b[92] === EMPTY && b[91] === ROOK && !this.attacked(95, enemy) && !this.attacked(94, enemy)) add(95, 93, FLAG_CASTLE);
        } else if (us && from === 25) {
          if (this.castle & 4 && b[26] === EMPTY && b[27] === EMPTY && b[28] === (ROOK | BLACK) && !this.attacked(25, enemy) && !this.attacked(26, enemy)) add(25, 27, FLAG_CASTLE);
          if (this.castle & 8 && b[24] === EMPTY && b[23] === EMPTY && b[22] === EMPTY && b[21] === (ROOK | BLACK) && !this.attacked(25, enemy) && !this.attacked(24, enemy)) add(25, 23, FLAG_CASTLE);
        }
      }
    }
    return moves;
  }

  /** Makes a move. Returns false (and takes it back) if it leaves the mover's king in check. */
  make(m) {
    const b = this.board;
    const from = m & 127, to = (m >> 7) & 127, promo = (m >> 14) & 7, flags = m >> 17;
    const piece = b[from];
    const us = this.side;
    let captured = b[to];
    let capSq = to;
    if (flags & FLAG_EP) {
      capSq = to + (us ? N : S);
      captured = b[capSq];
    }
    this.history.push({ m, captured, capSq, castle: this.castle, ep: this.ep, halfmove: this.halfmove, hash: this.hash, kings: this.kings[us] });
    this.hashes.push(this.hash);
    let h = this.hash;
    h ^= Z_PIECE[piece][from];
    if (captured !== EMPTY) { h ^= Z_PIECE[captured][capSq]; b[capSq] = EMPTY; }
    b[from] = EMPTY;
    const placed = promo ? promo | (piece & BLACK) : piece;
    b[to] = placed;
    h ^= Z_PIECE[placed][to];
    if (flags & FLAG_CASTLE) {
      const [rFrom, rTo] = to === 97 ? [98, 96] : to === 93 ? [91, 94] : to === 27 ? [28, 26] : [21, 24];
      const rook = b[rFrom];
      b[rFrom] = EMPTY; b[rTo] = rook;
      h ^= Z_PIECE[rook][rFrom] ^ Z_PIECE[rook][rTo];
    }
    if ((piece & 7) === KING) this.kings[us] = to;
    h ^= Z_CASTLE[this.castle];
    this.castle &= CASTLE_MASK[from] & CASTLE_MASK[to];
    h ^= Z_CASTLE[this.castle];
    if (this.ep) h ^= Z_EP[this.ep];
    this.ep = flags & FLAG_DOUBLE ? (from + to) >> 1 : 0;
    if (this.ep) h ^= Z_EP[this.ep];
    this.halfmove = (piece & 7) === PAWN || captured !== EMPTY ? 0 : this.halfmove + 1;
    if (us) this.fullmove++;
    this.side ^= 1;
    h ^= Z_SIDE;
    this.hash = h;
    if (this.inCheck(us)) {
      this.unmake();
      return false;
    }
    return true;
  }

  unmake() {
    const u = this.history.pop();
    this.hashes.pop();
    const b = this.board;
    const m = u.m;
    const from = m & 127, to = (m >> 7) & 127, promo = (m >> 14) & 7, flags = m >> 17;
    this.side ^= 1;
    const us = this.side;
    if (us) this.fullmove--;
    const moved = b[to];
    b[from] = promo ? PAWN | (moved & BLACK) : moved;
    b[to] = EMPTY;
    if (u.captured !== EMPTY) b[u.capSq] = u.captured;
    if (flags & FLAG_CASTLE) {
      const [rFrom, rTo] = to === 97 ? [98, 96] : to === 93 ? [91, 94] : to === 27 ? [28, 26] : [21, 24];
      b[rFrom] = b[rTo]; b[rTo] = EMPTY;
    }
    this.kings[us] = u.kings;
    this.castle = u.castle;
    this.ep = u.ep;
    this.halfmove = u.halfmove;
    this.hash = u.hash;
  }

  /** A move that passes the turn (for null-move pruning). */
  makeNull() {
    this.history.push({ m: 0, nul: true, ep: this.ep, hash: this.hash, halfmove: this.halfmove });
    this.hashes.push(this.hash);
    if (this.ep) this.hash ^= Z_EP[this.ep];
    this.ep = 0;
    this.side ^= 1;
    this.hash ^= Z_SIDE;
  }
  /** Takes back moves until only `length` remain in the history (after a search is cut off). */
  rewind(length) {
    while (this.history.length > length) {
      if (this.history[this.history.length - 1].nul) this.unmakeNull();
      else this.unmake();
    }
  }

  unmakeNull() {
    const u = this.history.pop();
    this.hashes.pop();
    this.side ^= 1;
    this.ep = u.ep;
    this.hash = u.hash;
    this.halfmove = u.halfmove;
  }

  legalMoves(onlyFrom = 0) {
    const out = [];
    for (const m of this.pseudoMoves(false, onlyFrom)) {
      if (this.make(m)) { out.push(m); this.unmake(); }
    }
    return out;
  }

  /** True if the current position has appeared before (since the last capture or pawn move). */
  isRepetition() {
    const n = this.hashes.length;
    for (let i = n - 2; i >= Math.max(0, n - this.halfmove); i -= 2) if (this.hashes[i] === this.hash) return true;
    return false;
  }

  /** Lowest-value piece of `bySide` attacking `s` (0 if none). For the coach and the puzzle maker. */
  lowestAttacker(s, bySide) {
    const b = this.board;
    const color = bySide ? BLACK : 0;
    const pawnDir = bySide ? -10 : 10;
    if (b[s + pawnDir - 1] === (PAWN | color) || b[s + pawnDir + 1] === (PAWN | color)) return PAWN;
    for (const d of KNIGHT_STEPS) if (b[s + d] === (KNIGHT | color)) return KNIGHT;
    let best = 0;
    for (const d of BISHOP_STEPS) {
      let t = s + d;
      while (b[t] === EMPTY) t += d;
      if (b[t] === (BISHOP | color)) return BISHOP;
      if (b[t] === (QUEEN | color)) best = QUEEN;
    }
    for (const d of ROOK_STEPS) {
      let t = s + d;
      while (b[t] === EMPTY) t += d;
      if (b[t] === (ROOK | color)) return ROOK;
      if (b[t] === (QUEEN | color)) best = QUEEN;
    }
    if (best) return best;
    for (const d of KING_STEPS) if (b[s + d] === (KING | color)) return KING;
    return 0;
  }
}

// ---------- Move helpers ----------

export const moveFrom = (m) => m & 127;
export const moveTo = (m) => (m >> 7) & 127;
export const movePromo = (m) => (m >> 14) & 7;
export const isCapture = (m) => ((m >> 17) & FLAG_CAPTURE) !== 0;
export const isPromotion = (m) => ((m >> 17) & FLAG_PROMO) !== 0;

/** Packed move → { from: "e2", to: "e4", promotion?: "q" }. */
export function toUci(m) {
  const promo = movePromo(m);
  return { from: sqName(moveFrom(m)), to: sqName(moveTo(m)), ...(promo ? { promotion: LETTERS[promo] } : {}) };
}
export const uciString = (m) => { const u = toUci(m); return u.from + u.to + (u.promotion || ""); };

/** Finds the legal move matching "e2e4" / "e7e8q" in `pos`, or 0. */
export function findMove(pos, uci) {
  for (const m of pos.legalMoves(sq(uci.slice(0, 2)))) if (uciString(m) === uci || (uciString(m) === uci + "q")) return m;
  return 0;
}

// ---------- Evaluation ----------
// Piece-square tables (from white's side, a8 first), after Tomasz Michniewski's well-known
// "simplified evaluation function". The king has a middlegame and an endgame table.
const PST = {
  [PAWN]: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
  [KNIGHT]: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
  [BISHOP]: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
  [ROOK]: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
  [QUEEN]: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
  [KING]: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
};
const KING_END = [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50];

/** Index into a table for a piece of `side` on mailbox square `s`. */
const pstIndex = (s, side) => (side ? (7 - rowOf(s)) * 8 + fileOf(s) : rowOf(s) * 8 + fileOf(s));

/** Score in centipawns from the side to move's point of view. */
export function evaluate(pos) {
  const b = pos.board;
  let score = 0;
  let nonPawn = 0;
  let wMaterial = 0, bMaterial = 0;
  let wBishops = 0, bBishops = 0;
  for (let s = 21; s <= 98; s++) {
    const p = b[s];
    if (p === EMPTY || p === OFF) continue;
    const type = p & 7;
    if (type !== PAWN && type !== KING) nonPawn += VALUE[type];
    if (type === KING) continue;
    const side = p & BLACK ? 1 : 0;
    const v = VALUE[type] + PST[type][pstIndex(s, side)];
    if (side) { score -= v; bMaterial += VALUE[type]; if (type === BISHOP) bBishops++; }
    else { score += v; wMaterial += VALUE[type]; if (type === BISHOP) wBishops++; }
  }
  if (wBishops >= 2) score += 30;
  if (bBishops >= 2) score -= 30;
  const endgame = nonPawn <= 1300;
  for (const side of [0, 1]) {
    const k = pos.kings[side];
    if (!k) continue;
    const v = (endgame ? KING_END : PST[KING])[pstIndex(k, side)];
    score += side ? -v : v;
  }
  // When one side is clearly ahead in an endgame, help it push the other king to the edge and
  // bring its own king close: that's how a lone king gets checkmated.
  if (endgame && pos.kings[0] && pos.kings[1] && Math.abs(wMaterial - bMaterial) >= 400) {
    const strong = wMaterial > bMaterial ? 0 : 1;
    const weakK = pos.kings[strong ^ 1], strongK = pos.kings[strong];
    const cf = fileOf(weakK), cr = rowOf(weakK);
    const edge = Math.max(3 - cf, cf - 4) + Math.max(3 - cr, cr - 4);
    const dist = Math.abs(fileOf(weakK) - fileOf(strongK)) + Math.abs(rowOf(weakK) - rowOf(strongK));
    const bonus = edge * 12 + (14 - dist) * 6;
    score += strong ? -bonus : bonus;
  }
  return pos.side ? -score : score;
}

// ---------- Search ----------

export const MATE = 100000;
const INF = 1000000;
const TT_BITS = 18;
const TT_SIZE = 1 << TT_BITS;
const TT_EXACT = 1, TT_LOWER = 2, TT_UPPER = 3;

class TimeUp extends Error {}

export class Searcher {
  constructor() {
    this.ttKey = new Int32Array(TT_SIZE);
    this.ttMove = new Int32Array(TT_SIZE);
    this.ttScore = new Int32Array(TT_SIZE);
    this.ttDepth = new Int8Array(TT_SIZE);
    this.ttFlag = new Int8Array(TT_SIZE);
    this.killers = [];
    this.historyScore = new Int32Array(120 * 120);
    this.nodes = 0;
  }

  clear() {
    this.ttKey.fill(0); this.ttFlag.fill(0);
    this.historyScore.fill(0);
  }

  orderMoves(pos, moves, ttMove, ply) {
    const b = pos.board;
    const k = this.killers[ply] || [];
    const scored = moves.map((m) => {
      let s = 0;
      if (m === ttMove) s = 1e9;
      else if (isCapture(m)) {
        const victim = b[moveTo(m)] & 7 || PAWN;
        s = 1e8 + VALUE[victim] * 10 - VALUE[b[moveFrom(m)] & 7];
      } else if (isPromotion(m)) s = 9e7;
      else if (m === k[0] || m === k[1]) s = 8e7;
      else s = this.historyScore[moveFrom(m) * 120 + moveTo(m)];
      return [s, m];
    });
    scored.sort((a, c) => c[0] - a[0]);
    return scored.map((x) => x[1]);
  }

  quiesce(pos, alpha, beta, ply) {
    if ((++this.nodes & 2047) === 0 && Date.now() > this.deadline) throw new TimeUp();
    const stand = evaluate(pos);
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    if (ply > 30) return stand;
    for (const m of this.orderMoves(pos, pos.pseudoMoves(true), 0, ply)) {
      if (!pos.make(m)) continue;
      const score = -this.quiesce(pos, -beta, -alpha, ply + 1);
      pos.unmake();
      if (score >= beta) return score;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  search(pos, depth, alpha, beta, ply, allowNull = true) {
    if ((++this.nodes & 2047) === 0 && Date.now() > this.deadline) throw new TimeUp();
    if (ply > 0 && (pos.halfmove >= 100 || pos.isRepetition())) return 0;
    const inCheck = pos.inCheck();
    if (inCheck) depth++;
    if (depth <= 0) return this.quiesce(pos, alpha, beta, ply);

    const idx = pos.hash & (TT_SIZE - 1);
    let ttMove = 0;
    if (this.ttFlag[idx] && this.ttKey[idx] === pos.hash) {
      ttMove = this.ttMove[idx];
      if (ply > 0 && this.ttDepth[idx] >= depth) {
        let s = this.ttScore[idx];
        if (s > MATE - 1000) s -= ply; else if (s < -MATE + 1000) s += ply;
        const f = this.ttFlag[idx];
        if (f === TT_EXACT || (f === TT_LOWER && s >= beta) || (f === TT_UPPER && s <= alpha)) return s;
      }
    }

    // Null move: if passing still beats beta, this position is good enough to cut.
    if (allowNull && !inCheck && depth >= 3 && ply > 0 && evaluate(pos) >= beta && this.hasPieces(pos)) {
      pos.makeNull();
      const s = -this.search(pos, depth - 3, -beta, -beta + 1, ply + 1, false);
      pos.unmakeNull();
      if (s >= beta) return beta;
    }

    const startAlpha = alpha;
    let best = -INF, bestMove = 0, legal = 0;
    for (const m of this.orderMoves(pos, pos.pseudoMoves(), ttMove, ply)) {
      if (!pos.make(m)) continue;
      legal++;
      let score;
      // Late moves get a shallower look first; a surprise gets the full depth.
      if (legal > 4 && depth >= 3 && !inCheck && !isCapture(m) && !isPromotion(m) && !pos.inCheck()) {
        score = -this.search(pos, depth - 2, -alpha - 1, -alpha, ply + 1);
        if (score > alpha) score = -this.search(pos, depth - 1, -beta, -alpha, ply + 1);
      } else {
        score = -this.search(pos, depth - 1, -beta, -alpha, ply + 1);
      }
      pos.unmake();
      if (score > best) { best = score; bestMove = m; }
      if (score > alpha) alpha = score;
      if (alpha >= beta) {
        if (!isCapture(m)) {
          const k = this.killers[ply] || (this.killers[ply] = [0, 0]);
          if (k[0] !== m) { k[1] = k[0]; k[0] = m; }
          this.historyScore[moveFrom(m) * 120 + moveTo(m)] += depth * depth;
        }
        break;
      }
    }
    if (!legal) return inCheck ? -MATE + ply : 0;

    let stored = best;
    if (stored > MATE - 1000) stored += ply; else if (stored < -MATE + 1000) stored -= ply;
    this.ttKey[idx] = pos.hash;
    this.ttMove[idx] = bestMove;
    this.ttScore[idx] = stored;
    this.ttDepth[idx] = depth;
    this.ttFlag[idx] = best <= startAlpha ? TT_UPPER : best >= beta ? TT_LOWER : TT_EXACT;
    return best;
  }

  hasPieces(pos) {
    const own = pos.side ? BLACK : 0;
    for (let s = 21; s <= 98; s++) {
      const p = pos.board[s];
      if (p !== EMPTY && p !== OFF && (p & BLACK) === own && (p & 7) !== PAWN && (p & 7) !== KING) return true;
    }
    return false;
  }

  /**
   * Scores every legal root move (from the mover's view) by searching each one.
   * Returns [{ move, score }] best first, using iterative deepening up to `depth` within `timeMs`.
   */
  rootScores(pos, { depth = 4, timeMs = 1500 } = {}) {
    this.deadline = Date.now() + timeMs;
    this.nodes = 0;
    this.killers = [];
    const base = pos.history.length;
    let results = pos.legalMoves().map((move) => ({ move, score: 0 }));
    if (results.length <= 1) return results;
    for (let d = 1; d <= depth; d++) {
      try {
        const next = [];
        let alpha = -INF;
        for (const r of results) {
          pos.make(r.move);
          // Full window for every root move, so each one gets a real score (needed to pick a
          // "human" second-best move); the alpha only orders ties.
          const score = -this.search(pos, d - 1, -INF, INF, 1);
          pos.unmake();
          next.push({ move: r.move, score });
          if (score > alpha) alpha = score;
        }
        next.sort((a, c) => c.score - a.score);
        results = next;
        if (Math.abs(results[0].score) > MATE - 1000) break;
      } catch (e) {
        if (!(e instanceof TimeUp)) throw e;
        pos.rewind(base);
        break; // keep the last full depth
      }
    }
    return results;
  }

  /** Best move by a normal alpha-beta search (faster than rootScores). */
  bestMove(pos, { depth = 5, timeMs = 1500 } = {}) {
    this.deadline = Date.now() + timeMs;
    this.nodes = 0;
    this.killers = [];
    const legal = pos.legalMoves();
    if (!legal.length) return { move: 0, score: pos.inCheck() ? -MATE : 0, depth: 0 };
    const base = pos.history.length;
    let best = { move: legal[0], score: 0, depth: 0 };
    for (let d = 1; d <= depth; d++) {
      try {
        let alpha = -INF, bestMove = 0;
        const idx = pos.hash & (TT_SIZE - 1);
        const ttMove = this.ttKey[idx] === pos.hash ? this.ttMove[idx] : best.move;
        for (const m of this.orderMoves(pos, legal, ttMove, 0)) {
          pos.make(m);
          const score = -this.search(pos, d - 1, -INF, -alpha, 1);
          pos.unmake();
          if (score > alpha) { alpha = score; bestMove = m; }
        }
        best = { move: bestMove, score: alpha, depth: d };
        this.ttKey[idx] = pos.hash; this.ttMove[idx] = bestMove; this.ttFlag[idx] = 0; // move only
        if (Math.abs(alpha) > MATE - 1000) break;
      } catch (e) {
        if (!(e instanceof TimeUp)) throw e;
        pos.rewind(base);
        break;
      }
    }
    return best;
  }
}

// ---------- Bot levels ----------
// Beginner looks two moves ahead and adds a lot of noise, so it usually plays sensible moves but
// often misses tactics and sometimes leaves pieces hanging. Intermediate looks four or five moves
// ahead with captures followed to the end and only a little noise: it rarely hangs pieces but can
// be outplayed. `rand` is injectable for tests.
export const LEVELS = {
  beginner: { depth: 2, timeMs: 600, noise: 140, blunder: 0.12 },
  intermediate: { depth: 5, timeMs: 1600, noise: 18, blunder: 0 },
};

function gaussian(rand) {
  let u = 0, v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Picks the bot's move. Returns a packed move (0 if there is none). */
export function chooseMove(pos, level = "beginner", searcher = new Searcher(), rand = Math.random, overrides = {}) {
  const cfg = { ...(LEVELS[level] || LEVELS.beginner), ...overrides };
  if (level === "intermediate") {
    const scores = searcher.rootScores(pos, { depth: cfg.depth - 1, timeMs: cfg.timeMs });
    if (!scores.length) return 0;
    // Never toss away a forced mate; otherwise a little noise varies its play.
    if (scores[0].score > MATE - 1000) return scores[0].move;
    let best = scores[0], bestNoisy = -INF;
    for (const s of scores.slice(0, 6)) {
      const noisy = s.score + gaussian(rand) * cfg.noise;
      if (s.score > scores[0].score - 80 && noisy > bestNoisy) { bestNoisy = noisy; best = s; }
    }
    return best.move;
  }
  const scores = searcher.rootScores(pos, { depth: cfg.depth, timeMs: cfg.timeMs });
  if (!scores.length) return 0;
  // A beginner bot still takes a mate in one most of the time, so lessons about mate threats matter.
  if (scores[0].score > MATE - 1000 && rand() < 0.75) return scores[0].move;
  if (rand() < cfg.blunder) {
    // An occasional "human" slip: any move that doesn't lose more than a minor piece.
    const ok = scores.filter((s) => s.score > scores[0].score - 350);
    return ok[Math.floor(rand() * ok.length)].move;
  }
  let best = scores[0], bestNoisy = -INF;
  for (const s of scores) {
    const noisy = s.score + gaussian(rand) * cfg.noise;
    if (noisy > bestNoisy) { bestNoisy = noisy; best = s; }
  }
  return best.move;
}

// ---------- Coach ----------

/**
 * Pieces of `side` that the other side can win: attacked and undefended, or attacked by something
 * worth less. Returns mailbox squares. Kings and pawns defended by pawns are left out.
 */
export function hangingPieces(pos, side) {
  const out = [];
  const color = side ? BLACK : 0;
  for (let s = 21; s <= 98; s++) {
    const p = pos.board[s];
    if (p === EMPTY || p === OFF || (p & BLACK) !== color) continue;
    const type = p & 7;
    if (type === KING) continue;
    const attacker = pos.lowestAttacker(s, side ^ 1);
    if (!attacker) continue;
    const defended = pos.lowestAttacker(s, side) !== 0;
    if (!defended || VALUE[attacker] < VALUE[type]) out.push(s);
  }
  return out;
}

// ---------- Puzzles ----------

/** All legal moves that give checkmate. */
export function matingMoves(pos) {
  const out = [];
  for (const m of pos.legalMoves()) {
    pos.make(m);
    if (pos.inCheck() && pos.legalMoves().length === 0) out.push(m);
    pos.unmake();
  }
  return out;
}

/** True if the side to move can force mate within `n` of its own moves. */
export function hasMateIn(pos, n) {
  for (const m of pos.legalMoves()) {
    pos.make(m);
    const replies = pos.legalMoves();
    let forced;
    if (!replies.length) forced = pos.inCheck();
    else if (n === 1) forced = false;
    else {
      forced = true;
      for (const r of replies) {
        pos.make(r);
        const ok = hasMateIn(pos, n - 1);
        pos.unmake();
        if (!ok) { forced = false; break; }
      }
    }
    pos.unmake();
    if (forced) return true;
  }
  return false;
}
