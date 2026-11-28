// Checks the bot ladder (src/content/bots.js) two ways. Usage:
//   node scripts/ladder-check.mjs [mistakes|games|all] [count]
//
// mistakes (default): every bot picks moves in the same game positions (3 tries each); a deeper
//   search scores how much worse each move was than the best one. Prints the average loss (in
//   hundredths of a pawn) and how often the move gave away 2 pawns' worth or more. Even steps
//   between neighbors mean an even ladder. Seeded, so runs are repeatable.
// games: neighbors play each other (alternating colors). Longer than 120 moves is scored by
//   material (a lead of 3 or more wins). Shows each step is stronger, but not by how much.
import { Chess } from "chess.js";
import { Position, Searcher, chooseMove, uciString } from "../src/chess/engine.js";
import { materialBalance } from "../src/chess/rules.js";
import { BOTS } from "../src/content/bots.js";

const mode = process.argv[2] || "mistakes";
const count = Number(process.argv[3]) || 0;
const searcher = new Searcher();

function seeded(seed) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
}
const pick = (bot, fen, rand, history = [], using = searcher) => {
  const { level, ...overrides } = bot.engine;
  const pos = new Position(fen);
  pos.hashes = history.map((f) => new Position(f).hash);
  const m = chooseMove(pos, level, using, rand, overrides);
  return m ? uciString(m) : null;
};
const play = (game, uci) => game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });

function mistakes(positionCount = 80) {
  const rand = seeded(7);
  const sunny = BOTS.find((b) => b.id === "beginner");
  const positions = [];
  while (positions.length < positionCount) {
    const game = new Chess();
    for (let ply = 0; ply < 60 && !game.isGameOver(); ply++) {
      const uci = pick(sunny, game.fen(), rand);
      if (!uci) break;
      play(game, uci);
      if (ply > 6 && ply % 5 === 0 && !game.isGameOver()) positions.push(game.fen());
    }
  }
  const ref = new Searcher();
  const scored = positions.slice(0, positionCount).map((fen) => new Map(ref.rootScores(new Position(fen), { depth: 6, timeMs: 5000 }).map((r) => [uciString(r.move), r.score])));
  let previous = null;
  for (const bot of BOTS) {
    // A fresh search per bot and per position, so what one bot searched can't help another.
    const r = seeded(11);
    let loss = 0, n = 0, big = 0;
    for (let rep = 0; rep < 3; rep++) {
      positions.slice(0, positionCount).forEach((fen, i) => {
        const top = Math.max(...scored[i].values());
        const l = Math.min(1000, Math.max(0, top - (scored[i].get(pick(bot, fen, r, [], new Searcher())) ?? top - 1000)));
        loss += l; n++; if (l >= 200) big++;
      });
    }
    const avg = loss / n;
    const step = previous === null ? "" : `  step ${Math.round(previous - avg)}`;
    console.log(`${bot.emoji} ${bot.name.padEnd(8)} avg loss ${String(Math.round(avg)).padStart(4)}  big mistakes ${String(Math.round((100 * big) / n)).padStart(2)}%${step}`);
    previous = avg;
  }
}

function games(perPair = 12) {
  const rand = seeded(3);
  const playGame = (white, black) => {
    const game = new Chess();
    const fens = [];
    for (let ply = 0; ply < 240 && !game.isGameOver(); ply++) {
      const uci = pick(game.turn() === "w" ? white : black, game.fen(), rand, fens);
      if (!uci) break;
      fens.push(game.fen());
      play(game, uci);
    }
    if (game.isCheckmate()) return game.turn() === "w" ? 0 : 1;
    if (game.isGameOver()) return 0.5;
    const lead = materialBalance(game);
    return lead >= 3 ? 1 : lead <= -3 ? 0 : 0.5;
  };
  for (let i = 1; i < BOTS.length; i++) {
    const [lower, upper] = [BOTS[i - 1], BOTS[i]];
    let score = 0;
    for (let n = 0; n < perPair; n++) score += n % 2 ? 1 - playGame(lower, upper) : playGame(upper, lower);
    console.log(`${upper.emoji} ${upper.name} vs ${lower.emoji} ${lower.name}: ${score} of ${perPair}`);
  }
}

if (mode === "mistakes" || mode === "all") mistakes(count || 80);
if (mode === "games" || mode === "all") games(count || 12);
