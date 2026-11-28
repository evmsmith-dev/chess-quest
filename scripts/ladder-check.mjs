// Checks that each bot on the ladder is stronger than the one below it: plays games between
// neighbors (alternating colors) and prints the score. Usage: node scripts/ladder-check.mjs [games]
// Games longer than 120 moves are scored by material (a lead of 3 or more wins).
import { Chess } from "chess.js";
import { Position, Searcher, chooseMove, uciString } from "../src/chess/engine.js";
import { materialBalance } from "../src/chess/rules.js";
import { BOTS } from "../src/content/bots.js";

const games = Number(process.argv[2]) || 12;
const searcher = new Searcher();

function playGame(white, black) {
  const game = new Chess();
  const fens = [];
  for (let ply = 0; ply < 240 && !game.isGameOver(); ply++) {
    const bot = game.turn() === "w" ? white : black;
    const { level, ...overrides } = bot.engine;
    const pos = new Position(game.fen());
    pos.hashes = fens.map((f) => new Position(f).hash);
    const m = chooseMove(pos, level, searcher, Math.random, overrides);
    if (!m) break;
    const uci = uciString(m);
    fens.push(game.fen());
    game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  }
  if (game.isCheckmate()) return game.turn() === "w" ? 0 : 1;
  if (game.isGameOver()) return 0.5;
  const lead = materialBalance(game);
  return lead >= 3 ? 1 : lead <= -3 ? 0 : 0.5;
}

for (let i = 1; i < BOTS.length; i++) {
  const lower = BOTS[i - 1];
  const upper = BOTS[i];
  let score = 0;
  for (let n = 0; n < games; n++) score += n % 2 ? 1 - playGame(lower, upper) : playGame(upper, lower);
  console.log(`${upper.emoji} ${upper.name} vs ${lower.emoji} ${lower.name}: ${score} of ${games}`);
}
