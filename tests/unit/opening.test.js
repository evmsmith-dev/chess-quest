import { test } from "node:test";
import assert from "node:assert/strict";
import { Chess } from "../../src/chess/rules.js";
import { openingReport, openingStars } from "../../src/lib/opening.js";

const play = (moves, fen) => { const g = new Chess(fen); for (const m of moves.split(" ")) g.move(m); return g; };
const passed = (report) => Object.fromEntries(report.map((c) => [c.id, c.ok]));

test("a good Italian opening passes every check", () => {
  const game = play("e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O Nbd2 a6 Re1 Ba7 Nf1 h6 Ng3 Re8");
  const report = openingReport(game, "w");
  assert.deepEqual(passed(report), { center: true, develop: true, castle: true, material: true });
  assert.equal(openingStars(report), 3);
});

test("edge pawns, a wandering rook and no castling miss the checks", () => {
  const game = play("a4 e5 h4 Nc6 Ra3 Nf6 Rb3 Bc5 Rxb7 Bxb7");
  const report = openingReport(game, "w");
  assert.deepEqual(passed(report), { center: false, develop: false, castle: false, material: false });
  assert.equal(openingStars(report), 0);
});

test("Black's report counts Black's moves, from a position after 1.e4", () => {
  const game = play("e5 Nf3 Nc6 Bc4 Nf6 d3 Be7 O-O O-O", "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1");
  const report = openingReport(game, "b");
  assert.deepEqual(passed(report), { center: true, develop: true, castle: true, material: true });
  assert.equal(report.find((c) => c.id === "develop").label, "Knights and bishops out (3 of 4)");
  assert.equal(openingStars(report), 3);
});

test("stars: four checks 3, three 2, two 1, one 0", () => {
  const r = (n) => [0, 1, 2, 3].map((i) => ({ ok: i < n }));
  assert.deepEqual([4, 3, 2, 1, 0].map((n) => openingStars(r(n))), [3, 2, 1, 0, 0]);
});
