import { test } from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { Position, Searcher, chooseMove, uciString, hangingPieces, sq, matingMoves, hasMateIn, evaluate } from "../../src/chess/engine.js";

function perft(pos, d) {
  if (!d) return 1;
  let n = 0;
  for (const m of pos.pseudoMoves()) {
    if (!pos.make(m)) continue;
    n += perft(pos, d - 1);
    pos.unmake();
  }
  return n;
}

// Standard perft results (chessprogramming.org).
const PERFT = [
  ["rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", [20, 400, 8902, 197281]],
  ["r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1", [48, 2039, 97862]],
  ["8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1", [14, 191, 2812, 43238]],
  ["r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1", [6, 264, 9467]],
  ["rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8", [44, 1486, 62379]],
];

test("move generator matches standard perft counts", () => {
  for (const [fen, counts] of PERFT) {
    const pos = new Position(fen);
    counts.forEach((expected, i) => assert.equal(perft(pos, i + 1), expected, `${fen} depth ${i + 1}`));
    assert.equal(pos.fen().split(" ").slice(0, 4).join(" "), fen.split(" ").slice(0, 4).join(" "), "unmake restores");
  }
});

test("legal moves and FEN agree with chess.js in random games", () => {
  let rand = 7;
  const next = () => (rand = (rand * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let g = 0; g < 30; g++) {
    const game = new Chess();
    const pos = new Position(game.fen());
    for (let ply = 0; ply < 120 && !game.isGameOver(); ply++) {
      const ours = pos.legalMoves().map(uciString).sort();
      const theirs = game.moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion || "")).sort();
      assert.deepEqual(ours, theirs, game.fen());
      const pick = theirs[Math.floor(next() * theirs.length)];
      game.move({ from: pick.slice(0, 2), to: pick.slice(2, 4), promotion: pick[4] });
      pos.make(pos.legalMoves().find((m) => uciString(m) === pick));
      const noEp = (f) => f.split(" ").filter((_, i) => i !== 3).join(" ");
      assert.equal(noEp(pos.fen()), noEp(game.fen()));
      assert.equal(pos.hash, pos.computeHash());
    }
  }
});

test("search finds mate in one and wins a free queen", () => {
  const s = new Searcher();
  const mate = new Position("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1");
  assert.equal(uciString(s.bestMove(mate, { depth: 3 }).move), "a1a8");
  const free = new Position("4k3/8/8/3q4/8/8/3R4/4K3 w - - 0 1");
  assert.equal(uciString(s.bestMove(free, { depth: 3 }).move), "d2d5");
});

test("both levels take a hanging queen and find mate in one", () => {
  for (const level of ["beginner", "intermediate"]) {
    let hits = 0;
    for (let i = 0; i < 10; i++) {
      const pos = new Position("4k3/8/8/3q4/8/8/3R4/4K3 w - - 0 1");
      if (uciString(chooseMove(pos, level)) === "d2d5") hits++;
    }
    assert.ok(hits >= (level === "beginner" ? 6 : 10), `${level} took the queen ${hits}/10`);
  }
  const pos = new Position("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1");
  assert.equal(uciString(chooseMove(pos, "intermediate")), "a1a8");
});

test("intermediate beats beginner most of the time", { timeout: 600000 }, () => {
  let score = 0;
  const games = 6;
  for (let g = 0; g < games; g++) {
    const game = new Chess();
    const pos = new Position(game.fen());
    const inter = g % 2 === 0 ? "w" : "b";
    const searchers = { w: new Searcher(), b: new Searcher() };
    while (!game.isGameOver() && game.history().length < 200) {
      const side = game.turn();
      const level = side === inter ? "intermediate" : "beginner";
      const m = chooseMove(pos, level, searchers[side]);
      const u = uciString(m);
      game.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
      pos.make(m);
    }
    if (game.isCheckmate()) score += game.turn() === inter ? 0 : 1;
    else score += 0.5;
  }
  console.log(`intermediate scored ${score}/${games}`);
  assert.ok(score >= games * 0.7);
});

test("coach spots hanging pieces", () => {
  const pos = new Position("4k3/8/8/3n4/8/3N4/8/4K3 w - - 0 1");
  assert.deepEqual(hangingPieces(pos, 0), []); // d3 knight not attacked
  const pos2 = new Position("4k3/8/8/3n4/8/4N3/8/4K3 b - - 0 1");
  assert.deepEqual(hangingPieces(pos2, 1), [sq("d5")]);
});

test("mate helpers", () => {
  const pos = new Position("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1");
  assert.equal(matingMoves(pos).length, 1);
  assert.ok(hasMateIn(pos, 1));
  assert.ok(!hasMateIn(new Position("4k3/8/8/8/8/8/8/R3K3 w - - 0 1"), 1));
  assert.equal(typeof evaluate(pos), "number");
});
