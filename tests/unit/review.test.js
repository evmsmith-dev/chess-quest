import { test } from "node:test";
import assert from "node:assert/strict";
import { Searcher } from "../../src/chess/engine.js";
import { scorePosition, reviewPositions, classify, pickMoments, judgeTry, mateLine, mateMoves } from "../../src/lib/review.js";

const searcher = new Searcher();
const names = { you: "You", them: "the bot" };
const review = (fen, uci, color = "w") => classify({ ply: 0, fen, uci, color }, scorePosition(fen, searcher), names);

test("a missed mate in one is found and explained", () => {
  const m = review("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", "a1a7");
  assert.equal(m.kind, "missed-mate");
  assert.match(m.text, /checkmate in one: Ra8#/);
  assert.equal(m.best, "a1a8");
});

test("a missed mate in two says so and gives the whole line", () => {
  // From a real game: Qf7+ leaves only Kd8, then Qe8 is checkmate.
  const fen = "r1b2b1r/2qpk3/3N3p/pPp1pP2/P1Q1NnP1/1P1P1P2/8/R1K2B1R w - - 0 30";
  const m = review(fen, "f5f6");
  assert.equal(m.kind, "missed-mate");
  assert.equal(m.mateIn, 2);
  assert.deepEqual(m.line, ["c4f7", "e7d8", "f7e8"]);
  assert.deepEqual(m.lineSan, ["Qf7+", "Kd8", "Qe8#"]);
  assert.match(m.text, /checkmate in 2\. After Qf7\+, Black's only move is Kd8, and then Qe8 is checkmate/);
});

test("mate scores convert to moves, and a line that isn't forced is refused", () => {
  assert.equal(mateMoves(99999), 1);
  assert.equal(mateMoves(99997), 2);
  assert.equal(mateMoves(-99998), 1);
  assert.equal(mateLine("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", "a1a7", 1), null);
  assert.deepEqual(mateLine("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", "a1a8", 1), ["a1a8"]);
});

test("leaving a piece where it can be taken is explained", () => {
  // 1.e4 d5: Qg4 puts the queen where the c8 bishop takes it.
  const m = review("rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", "d1g4");
  assert.equal(m.kind, "blunder");
  assert.match(m.text, /your queen on g4 where it could be taken/);
});

test("a missed free piece is explained", () => {
  const m = review("4k3/8/8/3q4/8/8/3R4/4K3 w - - 0 1", "d2d3");
  assert.ok(["blunder", "mistake"].includes(m.kind));
  assert.match(m.text, /queen on d5 could be won: Rxd5/);
});

test("good moves and small slips aren't moments", () => {
  assert.equal(review("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "e2e4"), null);
  assert.equal(review("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "d2d4"), null);
});

test("positions, picking the biggest moments, and trying moves", () => {
  const positions = reviewPositions(["e2e4", "e7e5", "g1f3"], ["w"]);
  assert.deepEqual(positions.map((p) => p.uci), ["e2e4", "g1f3"]);
  const moments = pickMoments([{ ply: 5, severity: 300 }, { ply: 1, severity: 100000 }, { ply: 9, severity: 120 }, { ply: 3, severity: 500 }, null]);
  assert.deepEqual(moments.map((m) => m.ply), [1, 3, 5]);
  const m = review("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", "a1a7");
  assert.equal(judgeTry(m, "a1a8").verdict, "best");
  const worse = judgeTry(m, "a1b1");
  assert.equal(worse.verdict, "worse");
  assert.ok(worse.mateMissed);
});
