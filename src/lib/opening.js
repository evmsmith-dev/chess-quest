// The report card for an opening boss: four habits for the first moves of a game.
import { materialBalance } from "../chess/rules.js";

const CENTER = ["d4", "e4", "d5", "e5"];
const MINOR_HOMES = { w: { b1: "n", g1: "n", c1: "b", f1: "b" }, b: { b8: "n", g8: "n", c8: "b", f8: "b" } };

/**
 * Checks `color`'s play in `game` (a chess.js game started from the boss position):
 * [{ id, label, ok }] for a center pawn, 3+ knights and bishops out, castling and material kept.
 */
export function openingReport(game, color) {
  const mine = game.history({ verbose: true }).filter((m) => m.color === color);
  const developed = Object.entries(MINOR_HOMES[color])
    .filter(([square, type]) => { const p = game.get(square); return !(p && p.color === color && p.type === type); }).length;
  const balance = (color === "w" ? 1 : -1) * materialBalance(game);
  return [
    { id: "center", label: "A pawn in the center", ok: mine.some((m) => m.piece === "p" && CENTER.includes(m.to)) },
    { id: "develop", label: `Knights and bishops out (${developed} of 4)`, ok: developed >= 3 },
    { id: "castle", label: "Castled", ok: mine.some((m) => /[kq]/.test(m.flags)) },
    { id: "material", label: "Kept your pieces", ok: balance >= -1 },
  ];
}

/** Stars for a report: all four checks 3, three 2, two 1, fewer 0 (try again). */
export const openingStars = (report) => Math.max(0, report.filter((c) => c.ok).length - 1);
