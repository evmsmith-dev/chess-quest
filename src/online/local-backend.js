// A stand-in for Firebase used by the browser tests: games live in localStorage and changes are
// announced over a BroadcastChannel, so two tabs in one browser can play each other exactly like
// two phones would through Firebase. Each tab is its own player (its id is in sessionStorage).
// It applies the same checks as the server rules, via the shared helpers in common.js.
import { makeCode, newGameRecord, withMove, withJoin, withResult, colorOf } from "./common.js";

const STORE = "chessQuest_localServer";
const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("chess-quest-online") : null;
const listeners = new Map(); // code → Set of callbacks

const readAll = () => { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; } };
const read = (code) => readAll()[code] || null;

function write(code, game) {
  const all = readAll();
  if (game) all[code] = game; else delete all[code];
  localStorage.setItem(STORE, JSON.stringify(all));
  notify(code);
  channel?.postMessage({ code });
}

function notify(code) {
  const game = read(code);
  for (const cb of listeners.get(code) || []) setTimeout(() => cb(game), 0);
}
channel?.addEventListener("message", (e) => notify(e.data.code));

/** Applies `change(game)`; nothing is written if it returns null. Resolves true if written. */
function transact(code, change) {
  const next = change(read(code));
  if (!next) return Promise.resolve(false);
  write(code, next);
  return Promise.resolve(true);
}

export async function createLocalBackend() {
  let uid = sessionStorage.getItem("chessQuest_localUid");
  if (!uid) { uid = `local-${Math.random().toString(36).slice(2, 10)}`; sessionStorage.setItem("chessQuest_localUid", uid); }
  const presence = [];
  addEventListener("pagehide", () => { for (const [code, color] of presence) transact(code, (g) => g && { ...g, presence: { ...g.presence, [color]: false } }); });
  return {
    kind: "local",
    uid,
    async create({ color, avatar }) {
      let code;
      do code = makeCode(); while (read(code));
      write(code, newGameRecord({ uid, color, avatar, now: Date.now() }));
      return code;
    },
    async join(code, avatar) {
      const game = read(code);
      if (!game || game.expires < Date.now()) throw new Error("not-found");
      const next = withJoin(game, uid, avatar);
      if (!next) throw new Error("full");
      if (next !== game) write(code, next);
      return { color: colorOf(next, uid) };
    },
    watch(code, cb) {
      if (!listeners.has(code)) listeners.set(code, new Set());
      listeners.get(code).add(cb);
      setTimeout(() => cb(read(code)), 0);
      return () => listeners.get(code)?.delete(cb);
    },
    move: (code, ply, uci, result) => transact(code, (g) => withMove(g, uid, ply, uci, result)),
    finish: (code, result) => transact(code, (g) => withResult(g, uid, result)),
    offerDraw: (code, color) => transact(code, (g) => {
      if (!g || g.status !== "playing" || !colorOf(g, uid)) return null;
      const next = { ...g };
      if (color) next.drawOffer = color; else delete next.drawOffer;
      return next;
    }),
    setRematch: (code, newCode) => transact(code, (g) => (g && !g.rematch && colorOf(g, uid) ? { ...g, rematch: newCode } : null)),
    setPresence(code, color) {
      presence.push([code, color]);
      transact(code, (g) => g && { ...g, presence: { ...g.presence, [color]: true } });
      return () => transact(code, (g) => g && { ...g, presence: { ...g.presence, [color]: false } });
    },
    async sweep() {
      const all = readAll();
      for (const [code, g] of Object.entries(all)) if (g.expires < Date.now()) write(code, null);
    },
  };
}
