// The bot thinks here, off the main thread, so the board never freezes while it searches.
// Messages: { id, type: "move", fen, history, level } → { id, move: "e2e4" | null }
//           { id, type: "hint", fen, history } → { id, move, score }
//           { id, type: "review", fens, depth, timeMs } → { id, progress } while working, then
//             { id, scores: [[{ uci, score }, …] for each fen] } (every legal move, best first)
// `history` is the list of earlier FENs (since the last capture or pawn move) so the bot knows
// about repetitions.
import { Position, Searcher, chooseMove, uciString } from "./engine.js";

const searcher = new Searcher();

function load(fen, history = []) {
  const pos = new Position(fen);
  // Repetition detection only needs the hashes of earlier positions.
  pos.hashes = history.map((f) => new Position(f).hash);
  return pos;
}

self.addEventListener("message", (event) => {
  const { id, type, fen, history, level } = event.data;
  try {
    if (type === "review") {
      const { fens, depth = 3, timeMs = 220 } = event.data;
      const scores = fens.map((f, i) => {
        const result = searcher.rootScores(new Position(f), { depth, timeMs }).map((r) => ({ uci: uciString(r.move), score: r.score }));
        self.postMessage({ id, progress: (i + 1) / fens.length });
        return result;
      });
      self.postMessage({ id, scores });
      return;
    }
    const pos = load(fen, history);
    if (type === "move") {
      const m = chooseMove(pos, level, searcher);
      self.postMessage({ id, move: m ? uciString(m) : null });
    } else if (type === "hint") {
      const r = searcher.bestMove(pos, { depth: 6, timeMs: 1200 });
      self.postMessage({ id, move: r.move ? uciString(r.move) : null, score: r.score });
    }
  } catch (error) {
    self.postMessage({ id, move: null, error: String(error) });
  }
});
