// The bot thinks here, off the main thread, so the board never freezes while it searches.
// Messages: { id, type: "move", fen, history, level } → { id, move: "e2e4" | null }
//           { id, type: "hint", fen, history } → { id, move, score }
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
