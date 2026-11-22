// Makes the Challenges puzzles (data/puzzles.json) from games the bots play against each other.
// Every position along the way is checked for a puzzle with exactly one right answer:
//   mate1    Mate in one: exactly one mating move.
//   hanging  Win a free piece: one capture wins material and every other move is clearly worse.
//   mate2    Mate in two: no mate in one, and exactly one first move forces mate next move.
//   fork     Fork: one move attacks two valuable pieces (or the king and a piece), winning one.
//   material Win material: any other two-move combination that wins at least a minor piece.
// A puzzle is a start FEN and a line of moves; the player plays the even steps. `accept` lists the
// moves that are as good as the line's own at each player step (for mates, any mate is accepted
// in the app instead). Seeded, so the same command always makes the same puzzles.
// Usage: node scripts/make-puzzles.mjs [scale, default 1]. The file is rewritten as puzzles are
// found, so a long run can be stopped at any point.
import { writeFile } from "node:fs/promises";
import { Chess } from "chess.js";
import {
  Position, Searcher, chooseMove, uciString, matingMoves, hasMateIn, evaluate, VALUE, BLACK, EMPTY, OFF, KING,
  moveTo, moveFrom, isCapture, MATE,
} from "../src/chess/engine.js";

const SCALE = Number(process.argv[2] || 1);
const KINDS = ["mate1", "hanging", "mate2", "fork", "material"];
const TARGET = { mate1: 60, hanging: 50, mate2: 50, fork: 30, material: 30 };
const want = (kind) => Math.round(TARGET[kind] * SCALE);
const found = Object.fromEntries(KINDS.map((k) => [k, []]));
const seen = new Set();
const searcher = new Searcher();

let state = 12345;
const rand = () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296);

function material(pos, side) {
  let total = 0;
  for (let s = 21; s <= 98; s++) {
    const p = pos.board[s];
    if (p === EMPTY || p === OFF) continue;
    const v = VALUE[p & 7];
    total += (p & BLACK ? 1 : 0) === side ? v : -v;
  }
  return total;
}

/** Enemy pieces worth a knight or more, or the king, attacked by the piece on `s`. */
function targetsFrom(pos, s) {
  const piece = pos.board[s];
  const side = piece & BLACK ? 1 : 0;
  // Ask the move generator what this piece could capture if it were its turn again.
  const saved = pos.side;
  pos.side = side;
  const caps = pos.pseudoMoves(true, s).filter(isCapture);
  pos.side = saved;
  const targets = new Set();
  for (const m of caps) {
    const victim = pos.board[moveTo(m)];
    if ((victim & 7) === KING || VALUE[victim & 7] >= 300) targets.add(moveTo(m));
  }
  return targets.size;
}

function goodMoves(pos, margin = 60) {
  const scores = searcher.rootScores(pos, { depth: 3, timeMs: 800 });
  return { scores, ok: scores.filter((s) => s.score >= scores[0].score - margin).map((s) => uciString(s.move)) };
}

function check(fen) {
  const key = fen.split(" ").slice(0, 2).join(" ");
  if (seen.has(key)) return;
  const pos = new Position(fen);
  if (pos.legalMoves().length < 6) return;
  const side = pos.side;

  // Mate in one.
  const mates = matingMoves(pos);
  if (mates.length === 1) {
    if (found.mate1.length < want("mate1")) { seen.add(key); found.mate1.push({ fen, line: [uciString(mates[0])] }); }
    return;
  }
  if (mates.length) return;

  // Mate in two.
  if (found.mate2.length < want("mate2") && hasMateIn(pos, 2)) {
    const firsts = [];
    for (const m of pos.legalMoves()) {
      pos.make(m);
      const replies = pos.legalMoves();
      let forced = replies.length > 0;
      for (const r of replies) {
        pos.make(r);
        const ok = matingMoves(pos).length > 0;
        pos.unmake();
        if (!ok) { forced = false; break; }
      }
      pos.unmake();
      if (forced) firsts.push(m);
      if (firsts.length > 1) break;
    }
    if (firsts.length === 1) {
      pos.make(firsts[0]);
      const reply = searcher.bestMove(pos, { depth: 3, timeMs: 1000 }).move;
      pos.make(reply);
      const finish = matingMoves(pos)[0];
      seen.add(key);
      found.mate2.push({ fen, line: [uciString(firsts[0]), uciString(reply), uciString(finish)] });
    }
    return;
  }

  // Material puzzles: the game must be roughly level, and one move must stand out.
  const before = material(pos, side);
  if (Math.abs(before) > 300) return;
  // A quick look first; only promising positions get the deeper one.
  const quick = searcher.rootScores(pos, { depth: 2, timeMs: 400 });
  if (quick.length < 2 || quick[0].score - before < 200) return;
  const scores = searcher.rootScores(pos, { depth: 3, timeMs: 800 });
  if (scores.length < 2) return;
  const [best, second] = scores;
  if (best.score > MATE - 1000 || best.score - before < 280 || best.score - second.score < 180 || best.score > 1200) return;
  const m1 = best.move;
  const from = moveFrom(m1), to = moveTo(m1);

  if (isCapture(m1)) {
    // A free piece: undefended, or worth more than what takes it. One move, no follow-up needed.
    const victim = pos.board[to] & 7;
    const attacker = pos.board[from] & 7;
    const defended = pos.lowestAttacker(to, side ^ 1) !== 0;
    if ((!defended || VALUE[victim] >= VALUE[attacker] + 200) && found.hanging.length < want("hanging")) {
      pos.make(m1);
      const afterOk = -searcher.bestMove(pos, { depth: 4, timeMs: 1500 }).score - before >= 250;
      pos.unmake();
      if (afterOk) {
        seen.add(key);
        found.hanging.push({ fen, line: [uciString(m1)] });
      }
    }
    return;
  }

  // Two-move combinations: our move, their best reply, our capture.
  pos.make(m1);
  const isFork = targetsFrom(pos, to) >= 2;
  const kind = isFork ? "fork" : "material";
  if (found[kind].length >= want(kind)) { pos.unmake(); return; }
  const reply = searcher.bestMove(pos, { depth: 4, timeMs: 1500 }).move;
  if (!reply) { pos.unmake(); return; }
  pos.make(reply);
  const { scores: s2, ok } = goodMoves(pos);
  const m2 = s2[0]?.move;
  const gained = m2 && isCapture(m2) && material(pos, side) + VALUE[pos.board[moveTo(m2)] & 7] - before >= 250;
  pos.unmake();
  pos.unmake();
  if (!gained || ok.length > 3) return;
  seen.add(key);
  found[kind].push({ fen, line: [uciString(m1), uciString(reply), uciString(m2)], accept: [[uciString(m1)], [], ok] });
}

// Easier first: fewer pieces on the board is easier to see.
const pieceCount = (fen) => fen.split(" ")[0].replace(/[^a-zA-Z]/g, "").length;
async function writeOut() {
  const out = {};
  for (const k of KINDS) out[k] = [...found[k]].sort((a, b) => pieceCount(a.fen) - pieceCount(b.fen));
  await writeFile(new URL("../data/puzzles.json", import.meta.url), JSON.stringify(out).replace(/\},\{/g, "},\n{") + "\n");
}

const pairings = [["beginner", "beginner"], ["intermediate", "beginner"], ["beginner", "intermediate"]];
let games = 0;
const started = Date.now();
while (KINDS.some((k) => found[k].length < want(k)) && games < 4000) {
  const [white, black] = pairings[games % pairings.length];
  games++;
  const game = new Chess();
  const pos = new Position(game.fen());
  // A couple of random opening moves so the games differ.
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
  if (games % 10 === 0) await writeOut();
  if (games % 2 === 0) {
    console.log(`${games} games, ${Math.round((Date.now() - started) / 1000)}s: ` + KINDS.map((k) => `${k} ${found[k].length}`).join(", "));
  }
}

await writeOut();
console.log("Wrote data/puzzles.json:", KINDS.map((k) => `${k} ${found[k].length}`).join(", "));
void evaluate;
