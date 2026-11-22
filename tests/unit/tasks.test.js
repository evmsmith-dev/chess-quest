import { test } from "node:test";
import assert from "node:assert/strict";
import { starTargets, starMove, starPar, judgeMove, solutions, judgePuzzleMove } from "../../src/lib/tasks.js";
import { explainIllegal } from "../../src/chess/rules.js";

test("star tasks: only the chosen piece moves, the turn stays", () => {
  const fen = "8/8/3P4/8/1P1R2P1/8/8/8 w - - 0 1";
  assert.deepEqual(starTargets(fen, "r", "d6"), []);
  assert.ok(starTargets(fen, "r", "d4").includes("d1"));
  assert.ok(!starTargets(fen, "r", "d4").includes("d8"));
  const next = starMove(fen, "d4", "d1");
  assert.equal(next.split(" ")[1], "w");
  assert.equal(starPar("8/8/8/8/8/8/8/R7 w - - 0 1", "r", ["a8", "h8", "h1"]), 3);
});

test("move tasks judge mate, check and escapes", () => {
  const mate = { goal: "mate", fen: "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1" };
  assert.deepEqual(solutions(mate), ["a1a8"]);
  assert.match(judgeMove(mate, mate.fen, "a1a7").message, /doesn't give check/);
  const stale = { goal: "mate", fen: "7k/8/6K1/8/8/8/8/3Q4 w - - 0 1" };
  assert.match(judgeMove(stale, stale.fen, "d1f3").message || "", /check|stalemate/);
  const block = { goal: "escape", way: "block", fen: "4k3/8/8/4r3/8/8/8/2B1K3 w - - 0 1" };
  assert.ok(judgeMove(block, block.fen, "c1e3").ok);
  assert.match(judgeMove(block, block.fen, "e1d1").message, /block the check/);
});

test("illegal moves get a reason", () => {
  assert.match(explainIllegal("4k3/8/8/4r3/8/8/8/2B1K3 w - - 0 1", "c1", "d2"), /in check/);
  assert.match(explainIllegal("4k3/4r3/8/8/8/8/4B3/4K3 w - - 0 1", "e2", "d3"), /pinned/);
  assert.match(explainIllegal("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "g1", "g3"), /in an L/);
});

test("puzzle moves: the line, any mate, or wrong", () => {
  const p = { fen: "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", line: ["a1a8"] };
  assert.equal(judgePuzzleMove(p, 0, p.fen, "a1a8"), "done");
  assert.equal(judgePuzzleMove(p, 0, p.fen, "a1a7"), "wrong");
});
