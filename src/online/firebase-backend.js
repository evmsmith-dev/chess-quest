// Online play through Firebase: anonymous sign-in (no email, no password, nothing personal) and
// the Realtime Database. Loaded only when someone opens online play, so the rest of the app stays
// small and works offline. database.rules.json is the server-side half of this file.
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import {
  getDatabase, ref, get, set, remove, onValue, runTransaction, onDisconnect, serverTimestamp,
  query, orderByChild, endAt, limitToFirst,
} from "firebase/database";
import { makeCode, newGameRecord, withMove, withJoin, withResult, colorOf } from "./common.js";

export async function createFirebaseBackend(config) {
  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = getDatabase(app);
  // The same anonymous id comes back on this device, so a player can rejoin their games.
  const user = await new Promise((resolve, reject) => {
    const stop = onAuthStateChanged(auth, (u) => {
      if (u) { stop(); resolve(u); return; }
      signInAnonymously(auth).catch((error) => { stop(); reject(error); });
    }, reject);
  });
  const uid = user.uid;
  const gameRef = (code) => ref(db, `games/${code}`);

  /** Runs `change(game)` as a transaction; `change` returns null to leave the game alone. */
  async function transact(code, change) {
    try {
      const outcome = await runTransaction(gameRef(code), (game) => {
        // Before the first read the local copy is null; returning null makes Firebase fetch the
        // real value and run this again (it never deletes a game that exists).
        if (game === null) return null;
        const next = change(game);
        return next === null ? undefined : next; // undefined = leave it alone
      }, { applyLocally: false });
      return outcome.committed && outcome.snapshot.exists();
    } catch {
      return false; // refused by the rules, or offline
    }
  }

  return {
    kind: "firebase",
    uid,
    async create({ color, avatar }) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = makeCode(() => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32);
        const record = { ...newGameRecord({ uid, color, avatar, now: Date.now() }), created: serverTimestamp() };
        const outcome = await runTransaction(gameRef(code), (game) => (game === null ? record : undefined));
        if (outcome.committed) return code;
      }
      throw new Error("busy");
    },
    async join(code, avatar) {
      const snapshot = await get(gameRef(code));
      const game = snapshot.val();
      if (!game || game.expires < Date.now()) throw new Error("not-found");
      if (colorOf(game, uid)) return { color: colorOf(game, uid) };
      const ok = await transact(code, (g) => { const next = withJoin(g, uid, avatar); return next === g ? null : next; });
      if (!ok) throw new Error("full");
      return { color: colorOf((await get(gameRef(code))).val(), uid) };
    },
    watch(code, cb) {
      return onValue(gameRef(code), (snapshot) => cb(snapshot.val()), () => cb(null));
    },
    move: (code, ply, uci, result) => transact(code, (g) => withMove(g, uid, ply, uci, result)),
    finish: (code, result) => transact(code, (g) => withResult(g, uid, result)),
    async offerDraw(code, color) {
      try {
        if (color) await set(ref(db, `games/${code}/drawOffer`), color);
        else await remove(ref(db, `games/${code}/drawOffer`));
        return true;
      } catch { return false; }
    },
    async setRematch(code, newCode) {
      try { await set(ref(db, `games/${code}/rematch`), newCode); return true; } catch { return false; }
    },
    setPresence(code, color) {
      const mine = ref(db, `games/${code}/presence/${color}`);
      // Mark this player online whenever the connection (re)opens; Firebase marks them offline
      // by itself if the phone loses the connection or the app is closed.
      const stop = onValue(ref(db, ".info/connected"), (snap) => {
        if (snap.val() !== true) return;
        onDisconnect(mine).set(false).then(() => set(mine, true)).catch(() => {});
      });
      return () => { stop(); set(mine, false).catch(() => {}); };
    },
    async sweep() {
      // Delete games past their 7 days (the rules allow anyone to delete an expired game).
      try {
        const old = await get(query(ref(db, "games"), orderByChild("expires"), endAt(Date.now() - 5 * 60 * 1000), limitToFirst(25)));
        const deletions = [];
        old.forEach((child) => { deletions.push(remove(child.ref).catch(() => {})); });
        await Promise.all(deletions);
      } catch {
        // Not allowed or offline: try again another time.
      }
    },
  };
}
