// Checks every Learn task and puzzle: positions are legal, answers are right, stars can all be
// collected, and every move task has at least one solution. Run by `npm test`.
import { readFile } from "node:fs/promises";
import { Chess } from "chess.js";
import { UNITS } from "../src/content/lessons.js";
import { RULES } from "../src/content/rules.js";
import { starPar, solutions, taskStartFen, judgePuzzleMove, parseUci } from "../src/lib/tasks.js";

const problems = [];
const fail = (where, message) => problems.push(`${where}: ${message}`);
const ids = new Set();

for (const unit of UNITS) {
  for (const lesson of unit.lessons) {
    if (ids.has(lesson.id)) fail(lesson.id, "duplicate lesson id");
    ids.add(lesson.id);
    if (!lesson.tip?.length) fail(lesson.id, "no tip card");
    lesson.tasks.forEach((task, i) => {
      const where = `${lesson.id} task ${i + 1}`;
      try {
        if (task.type === "stars") {
          const par = starPar(task.fen, task.piece, task.stars);
          if (!Number.isFinite(par)) fail(where, "stars can't all be collected");
          else task.par = par;
        } else if (task.type === "move") {
          const fen = taskStartFen(task);
          const game = new Chess(fen);
          const legal = new Set(game.moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion || "")));
          for (const uci of [...(task.accept || []), ...Object.keys(task.wrong || {})]) {
            if (!legal.has(uci) && ![...legal].some((l) => l.startsWith(uci))) fail(where, `${uci} isn't legal`);
          }
          const sols = solutions(task);
          if (!sols.length) fail(where, "no move solves it");
          for (const w of Object.keys(task.wrong || {})) if (sols.includes(w)) fail(where, `${w} is listed as wrong but solves it`);
          for (const r of Object.keys(task.successFor || {})) if (!sols.includes(r)) fail(where, `${r} has a success message but doesn't solve it`);
          if (task.goal === "safe" && sols.length === legal.size) fail(where, "every move is safe");
        } else if (task.type === "quiz") {
          if (task.fen) new Chess(task.fen, { skipValidation: true });
          if (!(task.answer >= 0 && task.answer < task.options.length)) fail(where, "answer out of range");
        } else if (task.type === "play") {
          const game = new Chess(task.fen);
          if (game.isGameOver()) fail(where, "game already over");
        } else fail(where, `unknown type ${task.type}`);
      } catch (error) {
        fail(where, error.message);
      }
    });
  }
}

for (const rule of RULES) {
  for (const ex of rule.examples || []) {
    try { new Chess(ex.fen, { skipValidation: true }); } catch (error) { fail(`rule ${rule.id}`, error.message); }
  }
}

const puzzles = JSON.parse(await readFile(new URL("../data/puzzles.json", import.meta.url), "utf8"));
let count = 0;
for (const [kind, list] of Object.entries(puzzles)) {
  list.forEach((puzzle, i) => {
    const where = `puzzle ${kind} ${i + 1}`;
    count++;
    try {
      const game = new Chess(puzzle.fen);
      puzzle.line.forEach((uci, step) => {
        const fen = game.fen();
        if (!game.move(parseUci(uci))) throw new Error(`step ${step + 1} ${uci} illegal`);
        if (step % 2 === 0) {
          const verdict = judgePuzzleMove(puzzle, step, fen, uci);
          if (verdict === "wrong" || (verdict === "done") !== (step === puzzle.line.length - 1)) throw new Error(`step ${step + 1} judged ${verdict}`);
        }
      });
      if (/^mate\d$/.test(kind) && !game.isCheckmate()) throw new Error("doesn't end in mate");
    } catch (error) {
      fail(where, error.message);
    }
  });
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`Content OK: ${ids.size} lessons, ${RULES.length} rules, ${count} puzzles.`);
