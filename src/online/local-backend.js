// A stand-in for Firebase used by the browser tests: games live in localStorage and changes are
// announced over a BroadcastChannel, so two tabs in one browser can play each other exactly like
// two phones would through Firebase. Each tab is its own player (its id is in sessionStorage).
// It applies the same checks as the server rules, via the shared helpers in common.js.
import { makeCode, makePairId, newGameRecord, withMove, withJoin, withResult, colorOf, PAIR_LIFETIME_MS } from "./common.js";

const STORE = "chessQuest_localServer";
const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("chess-quest-online") : null;
const listeners = new Map(); // code → Set of callbacks

const readAll = () => { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; } };
// The newest copy of each game this tab has seen (from its own writes or other tabs' messages),
// which can be newer than this tab's view of localStorage.
const latest = new Map();
const read = (code) => (latest.has(code) ? latest.get(code) : readAll()[code] || null);

function write(code, game) {
  const all = readAll();
  if (game) all[code] = game; else delete all[code];
  localStorage.setItem(STORE, JSON.stringify(all));
  latest.set(code, game || null);
  notify(code, game || null);
  // Send the game itself, like Firebase does: another tab's copy of localStorage can lag behind
  // the message, so re-reading it there could show the old game.
  channel?.postMessage({ code, game: game || null });
}

function notify(code, game) {
  for (const cb of listeners.get(code) || []) setTimeout(() => cb(game), 0);
}
channel?.addEventListener("message", (e) => { latest.set(e.data.code, e.data.game); notify(e.data.code, e.data.game); });

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
    serverNow: () => Date.now(),
    async create({ color, avatar, minutes = 0 }) {
      let code;
      do code = makeCode(); while (read(code));
      write(code, newGameRecord({ uid, color, avatar, now: Date.now(), minutes }));
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
    async createPair() {
      const id = makePairId();
      write(`pair:${id}`, { expires: Date.now() + PAIR_LIFETIME_MS });
      return id;
    },
    setFriendPair: (code, id) => transact(code, (g) => (g && !g.friendPair && colorOf(g, uid) ? { ...g, friendPair: id } : null)),
    async invite(id, code) {
      write(`pair:${id}`, { expires: Date.now() + PAIR_LIFETIME_MS, invite: { code, by: uid, at: Date.now() } });
      return true;
    },
    clearInvite: (id) => transact(`pair:${id}`, (p) => (p ? { expires: p.expires } : null)),
    watchPair(id, cb) {
      const key = `pair:${id}`;
      if (!listeners.has(key)) listeners.set(key, new Set());
      listeners.get(key).add(cb);
      setTimeout(() => cb(read(key)), 0);
      return () => listeners.get(key)?.delete(cb);
    },
    async recordDaily(day, firstTry) {
      return transact(`stats:${day}`, (st) => ({ solved: (st?.solved || 0) + 1, firstTry: (st?.firstTry || 0) + (firstTry ? 1 : 0) }));
    },
    readDaily: async (day) => read(`stats:${day}`),
    async sweep() {
      const all = readAll();
      for (const [code, g] of Object.entries(all)) if (g.expires < Date.now()) write(code, null);
    },
  };
}
