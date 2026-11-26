// Merges new puzzle sets from make-more-puzzles.mjs runs into data/puzzles.json. Existing sets
// are copied unchanged (saved progress refers to puzzles by their place in a set). Each new
// puzzle is checked again with a deeper search than the generator used, and dropped if another
// first move is as good, a faster mate exists, or the line doesn't work.
// Usage: node scripts/merge-puzzles.mjs out1.json [out2.json …]
import { readFile, writeFile } from "node:fs/promises";
import { Chess } from "chess.js";
import { Position, Searcher, uciString, MATE } from "../src/chess/engine.js";

const FILE = new URL("../data/puzzles.json", import.meta.url);
const NEW = ["pin", "discovered", "mate3", "defend"];
const MAX = 30;
const data = JSON.parse(await readFile(FILE, "utf8"));
const searcher = new Searcher();
const key = (p) => p.fen.split(" ").slice(0, 2).join(" ");
const seen = new Set(Object.entries(data).filter(([k]) => !NEW.includes(k)).flatMap(([, list]) => list.map(key)));

function problem(kind, p) {
  try {
    const g = new Chess(p.fen);
    for (const u of p.line) g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
    if (kind === "mate3" && !g.isCheckmate()) return "line doesn't end in mate";
  } catch (e) {
    return `illegal line (${e.message})`;
  }
  const scores = searcher.rootScores(new Position(p.fen), { depth: kind === "mate3" ? 6 : 4, timeMs: 6000 });
  const [best, second] = scores;
  if (kind === "mate3") {
    if (best.score < MATE - 5) return "no mate in 3 found";
    if (scores.some((s) => s.score > MATE - 5)) return "a faster mate exists";
    if (second && second.score >= MATE - 5) return "two first moves mate";
    return null;
  }
  const accepted = new Set([p.line[0], ...((p.accept && p.accept[0]) || [])]);
  if (!accepted.has(uciString(best.move))) return `deeper search prefers ${uciString(best.move)}`;
  if (scores.some((s) => !accepted.has(uciString(s.move)) && s.score >= best.score - 100)) return "another first move is as good";
  return null;
}

const pieceCount = (fen) => fen.split(" ")[0].replace(/[^a-zA-Z]/g, "").length;
for (const kind of NEW) {
  const candidates = [];
  for (const f of process.argv.slice(2)) {
    const run = JSON.parse(await readFile(f, "utf8"));
    for (const p of run[kind] || []) candidates.push(p);
  }
  const kept = [];
  let dropped = 0;
  for (const p of candidates) {
    if (kept.length >= MAX || seen.has(key(p))) continue;
    const why = problem(kind, p);
    if (why) { dropped++; console.log(`  dropped ${kind}: ${why}`); continue; }
    seen.add(key(p));
    kept.push(p);
  }
  data[kind] = kept.sort((a, b) => pieceCount(a.fen) - pieceCount(b.fen));
  console.log(`${kind}: kept ${kept.length} of ${candidates.length} (${dropped} dropped)`);
}
await writeFile(FILE, JSON.stringify(data).replace(/\},\{/g, "},\n{") + "\n");
