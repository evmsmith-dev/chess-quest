import { test } from "node:test";
import assert from "node:assert/strict";
import { Searcher } from "../../src/chess/engine.js";
import { scorePosition, reviewPositions, classify, pickMoments, judgeTry } from "../../src/lib/review.js";

const searcher = new Searcher();
const names = { you: "You", them: "the bot" };
const review = (fen, uci, color = "w") => classify({ ply: 0, fen, uci, color }, scorePosition(fen, searcher), names);

test("a missed mate in one is found and explained", () => {
  const m = review("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", "a1a7");
  assert.equal(m.kind, "missed-mate");
  assert.match(m.text, /checkmate in one: Ra8#/);
  assert.equal(m.best, "a1a8");
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
