// Talks to the bot in its Web Worker. If workers aren't available, the bot thinks on the main
// thread instead (the board pauses briefly, but everything still works).
import { Position, Searcher, chooseMove, uciString } from "./engine.js";

/* global __WORKER_URL__, __WORKER_TYPE__ */
// The build bundles the worker as a classic script; from the source it runs as a module.
const WORKER_URL = typeof __WORKER_URL__ !== "undefined" ? __WORKER_URL__ : "src/chess/worker.js";
const WORKER_TYPE = typeof __WORKER_TYPE__ !== "undefined" ? __WORKER_TYPE__ : "module";

let worker = null;
let failed = false;
let nextId = 1;
const pending = new Map();
const progressHandlers = new Map();
let fallbackSearcher = null;

function getWorker() {
  if (worker || failed) return worker;
  try {
    worker = new Worker(WORKER_URL, { type: WORKER_TYPE });
    worker.addEventListener("message", (e) => {
      if (e.data.progress !== undefined) { progressHandlers.get(e.data.id)?.(e.data.progress); return; }
      const resolve = pending.get(e.data.id);
      pending.delete(e.data.id);
      progressHandlers.delete(e.data.id);
      resolve?.(e.data);
    });
    worker.addEventListener("error", () => {
      failed = true;
      worker = null;
      for (const [id, resolve] of pending) { pending.delete(id); resolve({ move: null, error: "worker" }); }
    });
  } catch {
    failed = true;
    worker = null;
  }
  return worker;
}

function runHere({ type, fen, history = [], level, overrides, fens, depth, timeMs }) {
  fallbackSearcher ||= new Searcher();
  if (type === "review") {
    return { scores: fens.map((f) => fallbackSearcher.rootScores(new Position(f), { depth, timeMs }).map((r) => ({ uci: uciString(r.move), score: r.score }))) };
  }
  const pos = new Position(fen);
  pos.hashes = history.map((f) => new Position(f).hash);
  if (type === "move") {
    const m = chooseMove(pos, level, fallbackSearcher, Math.random, overrides);
    return { move: m ? uciString(m) : null };
  }
  const r = fallbackSearcher.bestMove(pos, { depth: 5, timeMs: 1000 });
  return { move: r.move ? uciString(r.move) : null, score: r.score };
}

function ask(message, onProgress) {
  const w = getWorker();
  if (!w) return Promise.resolve(runHere(message));
  return new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, (data) => resolve(data.error ? runHere(message) : data));
    if (onProgress) progressHandlers.set(id, onProgress);
    w.postMessage({ id, ...message });
  });
}

/**
 * Scores every legal move in each position (for game review). `onProgress(fraction)` is called
 * as positions are done. Resolves an array (one per FEN) of [{ uci, score }], best first.
 */
export async function scorePositions(fens, { depth = 3, timeMs = 220 } = {}, onProgress) {
  return (await ask({ type: "review", fens, depth, timeMs }, onProgress)).scores;
}

/** The bot's move for `fen` at `level`, as "e2e4" (or null if it has none). */
export async function botMove(fen, history, level, overrides = {}) {
  return (await ask({ type: "move", fen, history, level, overrides })).move;
}

/** A strong move for the side to move, for hints: { move, score }. */
export function bestMove(fen, history) {
  return ask({ type: "hint", fen, history });
}

/** Starts the worker early so the first move isn't slow. */
export function warmUp() {
  getWorker();
}
