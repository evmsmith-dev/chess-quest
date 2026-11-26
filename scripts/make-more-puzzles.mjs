// Adds new puzzle sets to data/puzzles.json without touching the existing ones (saved progress
// records puzzles by their place in each set, so existing sets must never be reshuffled).
//   pin        Pins & skewers: a bishop, rook or queen lines up two enemy pieces and wins one.
//   discovered Discovered attacks: a piece moves out of the way and uncovers an attack (often a
//              discovered check) that wins material.
//   mate3      Mate in three: no faster mate, exactly one first move, and after the defender's
//              best reply exactly one move that forces mate next.
//   defend     Defend!: the opponent threatens mate or material, and exactly one move holds.
// Positions come from games the bots play against each other, like make-puzzles.mjs. Each kind
// keeps whatever it already has in the file and is only topped up, so the script can be run
// again (or stopped and restarted) safely.
// Usage: node scripts/make-more-puzzles.mjs [seed] [kinds,comma,separated] [output file]
// With an output file, only the new kinds are written there (to merge runs made in parallel).
import { readFile, writeFile } from "node:fs/promises";
import { Chess } from "chess.js";
import {
  Position, Searcher, chooseMove, uciString, matingMoves, VALUE, BLACK, EMPTY, OFF, KING, BISHOP, ROOK, QUEEN,
  moveTo, moveFrom, isCapture, MATE,
} from "../src/chess/engine.js";

const FILE = new URL("../data/puzzles.json", import.meta.url);
const ALL_NEW = ["pin", "discovered", "mate3", "defend"];
const NEW_KINDS = process.argv[3] ? process.argv[3].split(",") : ALL_NEW;
const OUT = process.argv[4] ? new URL(process.argv[4], `file://${process.cwd()}/`) : FILE;
const TARGET = { pin: 30, discovered: 30, mate3: 30, defend: 30 };
const data = JSON.parse(await readFile(FILE, "utf8"));
for (const k of ALL_NEW) data[k] ||= [];
// With an output file, the chosen kinds start from that file (to resume a stopped run), not from
// data/puzzles.json; positions already used anywhere are still skipped.
const seenFromFile = Object.values(data).flat().map((p) => p.fen.split(" ").slice(0, 2).join(" "));
if (OUT !== FILE) {
  for (const k of NEW_KINDS) data[k] = [];
  try {
    const earlier = JSON.parse(await readFile(OUT, "utf8"));
    for (const k of NEW_KINDS) data[k] = earlier[k] || [];
  } catch {
    // Nothing yet.
  }
}
const seen = new Set([...seenFromFile, ...Object.values(data).flat().map((p) => p.fen.split(" ").slice(0, 2).join(" "))]);
const need = (kind) => NEW_KINDS.includes(kind) && data[kind].length < TARGET[kind];
const searcher = new Searcher();

let state = Number(process.argv[2] || 777);
const rand = () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296);

const ORTHO = [1, -1, 10, -10];
const DIAG = [9, -9, 11, -11];
const rays = (type) => (type === ROOK ? ORTHO : type === BISHOP ? DIAG : type === QUEEN ? [...ORTHO, ...DIAG] : []);
const valuable = (p) => (p & 7) === KING || VALUE[p & 7] >= 300;
const sideOf = (p) => (p & BLACK ? 1 : 0);
const worth = (p) => ((p & 7) === KING ? 10000 : VALUE[p & 7]);

function material(pos, side) {
  let total = 0;
  for (let s = 21; s <= 98; s++) {
    const p = pos.board[s];
    if (p === EMPTY || p === OFF) continue;
    total += sideOf(p) === side ? VALUE[p & 7] : -VALUE[p & 7];
  }
  return total;
}

/** The first piece from `s` along direction `d` (square and piece), or null at the board's edge. */
function firstPiece(pos, s, d) {
  for (let t = s + d; ; t += d) {
    const p = pos.board[t];
    if (p === OFF) return null;
    if (p !== EMPTY) return { s: t, p };
  }
}

/** After a move to `to`: does that bishop, rook or queen pin or skewer two enemy pieces? */
function pinsOrSkewers(pos, to) {
  const piece = pos.board[to];
  const side = sideOf(piece);
  for (const d of rays(piece & 7)) {
    const front = firstPiece(pos, to, d);
    if (!front || sideOf(front.p) === side || !valuable(front.p)) continue;
    const back = firstPiece(pos, front.s, d);
    if (!back || sideOf(back.p) === side || !valuable(back.p)) continue;
    if (worth(back.p) > worth(front.p) || worth(front.p) > worth(back.p)) return true; // pin, or skewer
  }
  return false;
}

/** After a piece left `from`: is a bishop, rook or queen behind it now aiming at something big? */
function uncovers(pos, from, side) {
  for (const d of [...ORTHO, ...DIAG]) {
    const behind = firstPiece(pos, from, -d);
    if (!behind || sideOf(behind.p) !== side || !rays(behind.p & 7).includes(d)) continue;
    const ahead = firstPiece(pos, from, d);
    if (ahead && sideOf(ahead.p) !== side && valuable(ahead.p)) return true;
  }
  return false;
}

/** The moves that force mate within two moves (stops after `limit`). */
function mateInTwoFirsts(pos, limit = 2) {
  const firsts = [];
  for (const m of pos.legalMoves()) {
    pos.make(m);
    const replies = pos.legalMoves();
    let forced = replies.length > 0 ? true : pos.inCheck();
    if (replies.length) {
      for (const r of replies) {
        pos.make(r);
        const ok = matingMoves(pos).length > 0;
        pos.unmake();
        if (!ok) { forced = false; break; }
      }
    }
    pos.unmake();
    if (forced) firsts.push(m);
    if (firsts.length >= limit) break;
  }
  return firsts;
}

function tryMate3(pos, fen, key) {
  // Only worth the deep search near the enemy king: at least two checks to choose from, and a side
  // that's ahead but not crushing (crushing positions have many mates, so no single answer).
  const lead = material(pos, pos.side);
  if (lead < -100 || lead > 1000) return false;
  let checks = 0;
  for (const m of pos.legalMoves()) {
    pos.make(m);
    if (pos.inCheck()) checks++;
    pos.unmake();
  }
  if (checks < 2) return false;
  const quick = searcher.rootScores(pos, { depth: 3, timeMs: 400 });
  if (!quick.length || quick[0].score < 200) return false;
  const scores = searcher.rootScores(pos, { depth: 5, timeMs: 1500 });
  if (scores.length < 2 || scores[0].score !== MATE - 5 || scores[1].score > MATE - 1000) return false;
  const m1 = scores[0].move;
  pos.make(m1);
  // Every reply must still lose to a forced mate in two.
  let forced = true;
  for (const r of pos.legalMoves()) {
    pos.make(r);
    if (!matingMoves(pos).length && !mateInTwoFirsts(pos, 1).length) forced = false;
    pos.unmake();
    if (!forced) break;
  }
  if (!forced) { pos.unmake(); return false; }
  const reply = searcher.bestMove(pos, { depth: 4, timeMs: 1500 }).move;
  pos.make(reply);
  const seconds = matingMoves(pos).length ? [] : mateInTwoFirsts(pos, 2);
  let line = null;
  if (seconds.length === 1) {
    pos.make(seconds[0]);
    const reply2 = searcher.bestMove(pos, { depth: 3, timeMs: 1000 }).move;
    if (reply2) {
      pos.make(reply2);
      const finish = matingMoves(pos)[0];
      if (finish) line = [m1, reply, seconds[0], reply2, finish].map(uciString);
      pos.unmake();
    }
    pos.unmake();
  }
  pos.unmake();
  pos.unmake();
  if (!line) return false;
  seen.add(key);
  data.mate3.push({ fen, line });
  return true;
}

function tryDefend(pos, fen, key, before) {
  if (pos.inCheck() || Math.abs(before) > 300) return false;
  const side = pos.side;
  const quick = searcher.rootScores(pos, { depth: 2, timeMs: 300 });
  if (quick.length < 3 || quick[0].score - quick[1].score < 200 || quick[0].score - before > 150) return false;
  // What would the opponent do if it were their move? It has to hurt.
  pos.makeNull();
  const threat = searcher.bestMove(pos, { depth: 3, timeMs: 600 });
  pos.unmakeNull();
  const mateThreat = threat.score > MATE - 1000;
  if (!mateThreat && threat.score + before < 300) return false;
  const scores = searcher.rootScores(pos, { depth: 3, timeMs: 1000 });
  if (scores.length < 3) return false;
  const [best, second] = scores;
  const held = best.score - before;
  if (held < -80 || held > 150 || best.score - second.score < 250) return false;
  const ok = scores.filter((s) => s.score >= best.score - 60).map((s) => uciString(s.move));
  if (ok.length > 2) return false;
  // Keep a good share of "stop the checkmate" puzzles: material ones fill at most two thirds.
  const materialOnes = data.defend.filter((p) => !p.mate).length;
  if (!mateThreat && materialOnes >= Math.round(TARGET.defend * 2 / 3)) return false;
  seen.add(key);
  data.defend.push({ fen, line: [uciString(best.move)], accept: [ok], ...(mateThreat ? { mate: true } : {}), threat: uciString(threat.move) });
  void side;
  return true;
}

function tryTactic(pos, fen, key, before) {
  if (!need("pin") && !need("discovered")) return false;
  if (Math.abs(before) > 300) return false;
  const side = pos.side;
  const quick = searcher.rootScores(pos, { depth: 2, timeMs: 400 });
  if (quick.length < 2 || quick[0].score - before < 200) return false;
  const scores = searcher.rootScores(pos, { depth: 3, timeMs: 800 });
  if (scores.length < 2) return false;
  const [best, second] = scores;
  if (best.score > MATE - 1000 || best.score - before < 280 || best.score - second.score < 180 || best.score > 1200) return false;
  const m1 = best.move;
  const from = moveFrom(m1), to = moveTo(m1);
  const capture = isCapture(m1);
  pos.make(m1);
  // A capture only counts as a discovered attack (the uncovered piece is the point); a pin or skewer
  // must be a quiet move, or it's just a capture.
  const kind = !capture && pinsOrSkewers(pos, to) ? "pin" : uncovers(pos, from, side) ? "discovered" : null;
  if (!kind || !need(kind)) { pos.unmake(); return false; }
  const reply = searcher.bestMove(pos, { depth: 4, timeMs: 1500 }).move;
  if (!reply) { pos.unmake(); return false; }
  pos.make(reply);
  const s2 = searcher.rootScores(pos, { depth: 3, timeMs: 800 });
  const m2 = s2[0]?.move;
  const ok = s2.filter((s) => s.score >= s2[0].score - 60).map((s) => uciString(s.move));
  const gained = m2 && isCapture(m2) && material(pos, side) + VALUE[pos.board[moveTo(m2)] & 7] - before >= 250;
  pos.unmake();
  pos.unmake();
  if (!gained || ok.length > 3) return false;
  seen.add(key);
  data[kind].push({ fen, line: [uciString(m1), uciString(reply), uciString(m2)], accept: [[uciString(m1)], [], ok] });
  return true;
}

function check(fen) {
  const key = fen.split(" ").slice(0, 2).join(" ");
  if (seen.has(key)) return;
  const pos = new Position(fen);
  if (pos.legalMoves().length < 6 || matingMoves(pos).length) return;
  const before = material(pos, pos.side);
  if (need("mate3") && tryMate3(pos, fen, key)) return;
  if (need("defend") && tryDefend(pos, fen, key, before)) return;
  tryTactic(pos, fen, key, before);
}

const pieceCount = (fen) => fen.split(" ")[0].replace(/[^a-zA-Z]/g, "").length;
async function writeOut() {
  const out = OUT === FILE ? { ...data } : {};
  for (const k of NEW_KINDS) out[k] = [...data[k]].sort((a, b) => pieceCount(a.fen) - pieceCount(b.fen));
  await writeFile(OUT, JSON.stringify(out).replace(/\},\{/g, "},\n{") + "\n");
}

const pairings = [["beginner", "beginner"], ["intermediate", "beginner"], ["beginner", "intermediate"], ["intermediate", "intermediate"]];
let games = 0;
const started = Date.now();
while (NEW_KINDS.some(need) && games < 6000) {
  const [white, black] = pairings[games % pairings.length];
  games++;
  const game = new Chess();
  const pos = new Position(game.fen());
  for (let i = 0; i < 4; i++) {
    const moves = pos.legalMoves();
    const m = moves[Math.floor(rand() * moves.length)];
    const u = uciString(m);
    game.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
    pos.make(m);
  }
  while (!game.isGameOver() && game.history().length < 160) {
    if (game.history().length >= 10) check(game.fen());
    const level = game.turn() === "w" ? white : black;
    const m = chooseMove(pos, level, searcher, rand, { timeMs: 120 });
    const u = uciString(m);
    game.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
    pos.make(m);
  }
  if (games % 5 === 0) await writeOut();
  if (games % 5 === 0) console.log(`${games} games, ${Math.round((Date.now() - started) / 1000)}s: ` + NEW_KINDS.map((k) => `${k} ${data[k].length}`).join(", "));
}
await writeOut();
console.log("Done:", NEW_KINDS.map((k) => `${k} ${data[k].length}`).join(", "));
