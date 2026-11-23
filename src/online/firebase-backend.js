// Online play through Firebase: anonymous sign-in (no email, no password, nothing personal) and
// the Realtime Database. Loaded only when someone opens online play, so the rest of the app stays
// small and works offline. database.rules.json is the server-side half of this file.
import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider, ReCaptchaV3Provider } from "firebase/app-check";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import {
  getDatabase, ref, get, set, remove, onValue, runTransaction, onDisconnect, serverTimestamp,
  query, orderByChild, endAt, limitToFirst,
} from "firebase/database";
import { makeCode, makePairId, newGameRecord, withMove, withJoin, withResult, colorOf, PAIR_LIFETIME_MS } from "./common.js";

export async function createFirebaseBackend(config, appCheckSiteKey = null, appCheckProvider = "enterprise") {
  const app = initializeApp(config);
  if (appCheckSiteKey) {
    // On a developer's own computer, App Check prints a debug token in the console instead; add
    // it under App Check → Apps → Manage debug tokens to test against the real project.
    if (["localhost", "127.0.0.1"].includes(location.hostname)) self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    // Invisible: reCAPTCHA Enterprise scores the request in the background, players never see a
    // challenge. It must start before anything else talks to Firebase.
    const provider = appCheckProvider === "v3" ? new ReCaptchaV3Provider(appCheckSiteKey) : new ReCaptchaEnterpriseProvider(appCheckSiteKey);
    initializeAppCheck(app, { provider, isTokenAutoRefreshEnabled: true });
  }
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
  const pairRef = (id) => ref(db, `pairs/${id}`);
  const secureRandom = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
  // Clocks use the server's time, so a phone with its clock set wrong can't gain or lose time.
  let offset = 0;
  onValue(ref(db, ".info/serverTimeOffset"), (snap) => { offset = snap.val() || 0; });
  const serverNow = () => Date.now() + offset;

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
    serverNow,
    async create({ color, avatar, minutes = 0 }) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = makeCode(secureRandom);
        const record = { ...newGameRecord({ uid, color, avatar, now: serverNow(), minutes }), created: serverTimestamp() };
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
      const ok = await transact(code, (g) => { const next = withJoin(g, uid, avatar, serverNow()); return next === g ? null : next; });
      if (!ok) throw new Error("full");
      return { color: colorOf((await get(gameRef(code))).val(), uid) };
    },
    watch(code, cb) {
      return onValue(gameRef(code), (snapshot) => cb(snapshot.val()), () => cb(null));
    },
    move: (code, ply, uci, result) => transact(code, (g) => withMove(g, uid, ply, uci, result, serverNow())),
    finish: (code, result) => transact(code, (g) => withResult(g, uid, result, serverNow())),
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
    async createPair() {
      for (let attempt = 0; attempt < 5; attempt++) {
        const id = makePairId(secureRandom);
        const outcome = await runTransaction(pairRef(id), (p) => (p === null ? { expires: serverNow() + PAIR_LIFETIME_MS } : undefined));
        if (outcome.committed) return id;
      }
      throw new Error("busy");
    },
    async setFriendPair(code, id) {
      try { await set(ref(db, `games/${code}/friendPair`), id); return true; } catch { return false; }
    },
    async invite(id, code) {
      try {
        await set(pairRef(id), { expires: serverNow() + PAIR_LIFETIME_MS, invite: { code, by: uid, at: serverNow() } });
        return true;
      } catch { return false; }
    },
    async clearInvite(id) {
      try { await remove(ref(db, `pairs/${id}/invite`)); return true; } catch { return false; }
    },
    watchPair(id, cb) {
      return onValue(pairRef(id), (snap) => cb(snap.val()), () => cb(null));
    },
    async recordDaily(day, firstTry) {
      try {
        const outcome = await runTransaction(ref(db, `stats/daily/${day}`), (st) => ({ solved: (st?.solved || 0) + 1, firstTry: (st?.firstTry || 0) + (firstTry ? 1 : 0) }));
        return outcome.committed;
      } catch { return false; }
    },
    async readDaily(day) {
      try { return (await get(ref(db, `stats/daily/${day}`))).val(); } catch { return null; }
    },
    async sweep() {
      // Delete games past their 7 days (the rules allow anyone to delete an expired game).
      try {
        const deletions = [];
        for (const path of ["games", "pairs"]) {
          const old = await get(query(ref(db, path), orderByChild("expires"), endAt(serverNow() - 5 * 60 * 1000), limitToFirst(25)));
          old.forEach((child) => { deletions.push(remove(child.ref).catch(() => {})); });
        }
        await Promise.all(deletions);
      } catch {
        // Not allowed or offline: try again another time.
      }
    },
  };
}
