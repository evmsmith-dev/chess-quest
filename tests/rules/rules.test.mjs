// Tests database.rules.json against Firebase's own rules engine (the Realtime Database
// emulator). Run with `npm run test:rules`; needs Java. GitHub runs it on every change to the
// rules (.github/workflows/rules.yml). "demo-" projects never touch the real Firebase project.
import { test, before, after, beforeEach } from "node:test";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";

const TS = { ".sv": "timestamp" }; // the server's time, as Firebase fills it in
const KEY = "ABCDEFGHJKMNPQRSTUVWXYZ2"; // a seat key
const KEY2 = "BCDEFGHJKMNPQRSTUVWXYZ23";
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-chess-quest",
    database: { rules: readFileSync(new URL("../../database.rules.json", import.meta.url), "utf8"), host: "127.0.0.1", port: 9000 },
  });
});
after(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearDatabase(); });

const as = (uid) => env.authenticatedContext(uid).database();
const anon = () => env.unauthenticatedContext().database();
const seed = (path, value) => env.withSecurityRulesDisabled((ctx) => ctx.database().ref(path).set(value));

const now = () => Date.now();
const waiting = (extra = {}) => ({ created: now(), expires: now() + 86400000, players: { w: "alice" }, avatars: { w: 0 }, moves: "", ply: 0, status: "waiting", ...extra });
const playing = (extra = {}) => waiting({ players: { w: "alice", b: "bob" }, avatars: { w: 0, b: 1 }, status: "playing", ...extra });

test("nobody can read the whole database or list games", async () => {
  await seed("games/ABCDEF", waiting());
  await assertFails(anon().ref("games/ABCDEF").once("value"));
  await assertFails(as("carol").ref("games").once("value"));
  await assertFails(as("carol").ref("/").once("value"));
  await assertSucceeds(as("carol").ref("games/ABCDEF").once("value")); // knowing the code is enough
});

test("creating a game: only for yourself, with the right shape", async () => {
  const record = { ...waiting(), created: TS };
  await assertSucceeds(as("alice").ref("games/ABCDEF").set(record));
  await assertFails(as("bob").ref("games/BCDEFG").set(record)); // a seat for someone else
  await assertFails(as("alice").ref("games/CDEFGH").set({ ...record, avatars: { w: "<b>hi</b>" } }));
  await assertFails(as("alice").ref("games/DEFGHJ").set({ ...record, avatars: { w: 12 } }));
  await assertFails(as("alice").ref("games/EFGHJK").set({ ...record, chat: "hello" }));
  await assertFails(as("alice").ref("games/EFGHJ1").set(record)); // not a valid code (1)
  await assertFails(as("alice").ref("games/FGHJKM").set({ ...record, clock: 420000 })); // 7 minutes
  await assertSucceeds(as("alice").ref("games/GHJKMN").set({ ...record, clock: 300000 }));
});

test("joining: only the empty seat of a waiting game", async () => {
  await seed("games/ABCDEF", waiting());
  await assertSucceeds(as("bob").ref("games/ABCDEF").update({ "players/b": "bob", "avatars/b": 1, status: "playing" }));
  await assertFails(as("carol").ref("games/ABCDEF").update({ "players/b": "carol" }));
  await assertFails(as("carol").ref("games/ABCDEF/players/w").set("carol"));
});

test("moves: only the player to move, one move at a time, no rewriting", async () => {
  await seed("games/ABCDEF", playing());
  await assertFails(as("bob").ref("games/ABCDEF").update({ moves: "e7e5", ply: 1 })); // White moves first
  await assertFails(as("carol").ref("games/ABCDEF").update({ moves: "e2e4", ply: 1 }));
  await assertSucceeds(as("alice").ref("games/ABCDEF").update({ moves: "e2e4", ply: 1 }));
  await assertFails(as("alice").ref("games/ABCDEF").update({ moves: "e2e4 d2d4", ply: 2 })); // twice in a row
  await assertFails(as("bob").ref("games/ABCDEF").update({ moves: "e2e4 e7e5", ply: 3 })); // ply jump
  await assertFails(as("bob").ref("games/ABCDEF").update({ moves: "d2d4 e7e5", ply: 2 })); // rewrites history
  await assertFails(as("bob").ref("games/ABCDEF").update({ ply: 2 })); // ply without a move
  await assertSucceeds(as("bob").ref("games/ABCDEF").update({ moves: "e2e4 e7e5", ply: 2 }));
});

test("reactions: one of six, only your own, at most one every 2 seconds", async () => {
  await seed("games/ABCDEF", playing());
  const mine = (uid, color) => as(uid).ref(`games/ABCDEF/reactions/${color}`);
  await assertFails(mine("bob", "w").set({ i: 0, t: TS })); // someone else's
  await assertFails(mine("carol", "w").set({ i: 0, t: TS })); // not a player
  await assertFails(mine("alice", "w").set({ i: 6, t: TS })); // not one of the six
  await assertFails(mine("alice", "w").set({ i: "hi", t: TS })); // no text
  await assertFails(mine("alice", "w").set({ i: 0, t: 12345 })); // the server sets the time
  await assertFails(mine("alice", "w").set({ i: 0, t: TS, text: "hi" })); // nothing extra
  await assertSucceeds(mine("alice", "w").set({ i: 0, t: TS }));
  await assertFails(mine("alice", "w").set({ i: 1, t: TS })); // too soon
  await assertSucceeds(mine("bob", "b").set({ i: 5, t: TS }));
  await seed("games/ABCDEF/reactions/w", { i: 1, t: now() - 3000 });
  await assertSucceeds(mine("alice", "w").set({ i: 2, t: TS })); // 2 seconds later is fine
  // Rewriting the game (as a move does) keeps the other player's reaction as it is.
  await seed("games/ABCDEF/reactions/w", { i: 1, t: 1000 });
  await assertSucceeds(as("alice").ref("games/ABCDEF").update({ moves: "e2e4", ply: 1, "reactions/w": { i: 1, t: 1000 } }));
  await assertSucceeds(as("bob").ref("games/ABCDEF").update({ moves: "e2e4 e7e5", ply: 2, "reactions/w": { i: 1, t: 1000 } }));
  await assertFails(as("bob").ref("games/ABCDEF").update({ "reactions/w": { i: 3, t: 1000 } })); // but can't change it
  // Not before the game starts.
  await seed("games/GHJKMN", waiting());
  await assertFails(as("alice").ref("games/GHJKMN/reactions/w").set({ i: 0, t: TS }));
});

test("results: resigning, draws by agreement and checkmate are checked", async () => {
  await seed("games/ABCDEF", playing());
  await assertFails(as("alice").ref("games/ABCDEF").update({ status: "over", result: { winner: "w", reason: "resigned" } }));
  await assertFails(as("alice").ref("games/ABCDEF").update({ status: "over", result: { winner: "draw", reason: "agreed" } })); // no offer
  await assertFails(as("alice").ref("games/ABCDEF").update({ status: "over", result: { winner: "w", reason: "checkmate" } })); // no move
  await assertFails(as("alice").ref("games/ABCDEF").update({ status: "over" })); // no result
  await assertSucceeds(as("alice").ref("games/ABCDEF").update({ status: "over", result: { winner: "b", reason: "resigned" } }));
  await assertFails(as("bob").ref("games/ABCDEF/result/winner").set("draw")); // results can't change

  await seed("games/BCDEFG", playing({ drawOffer: "b" }));
  await assertFails(as("bob").ref("games/BCDEFG").update({ status: "over", result: { winner: "draw", reason: "agreed" } })); // own offer
  await assertSucceeds(as("alice").ref("games/BCDEFG").update({ status: "over", result: { winner: "draw", reason: "agreed" }, drawOffer: null }));

  await seed("games/CDEFGH", playing());
  await assertFails(as("alice").ref("games/CDEFGH").update({ moves: "f2f3", ply: 1, status: "over", result: { winner: "b", reason: "checkmate" } }));
  await assertSucceeds(as("alice").ref("games/CDEFGH").update({ moves: "f2f3", ply: 1, status: "over", result: { winner: "w", reason: "checkmate" } }));
});

test("a loss on time only once the clock has really run out", async () => {
  await seed("games/ABCDEF", playing({ clock: 300000, time: { w: 300000, b: 300000 }, lastMoveAt: now() }));
  await assertFails(as("bob").ref("games/ABCDEF").update({ status: "over", result: { winner: "b", reason: "timeout" } }));
  await seed("games/BCDEFG", playing({ clock: 300000, time: { w: 1000, b: 300000 }, lastMoveAt: now() - 60000 }));
  await assertFails(as("alice").ref("games/BCDEFG").update({ status: "over", result: { winner: "w", reason: "timeout" } })); // wrong winner
  await assertSucceeds(as("bob").ref("games/BCDEFG").update({ status: "over", result: { winner: "b", reason: "timeout" } }));
});

test("seat keys: unreadable, and a reclaim works once with the key", async () => {
  await seed("games/ABCDEF", playing());
  await seed(`seats/ABCDEF/w/${KEY}`, "alice");
  await assertFails(as("alice").ref("seats/ABCDEF").once("value"));
  await assertFails(as("mallory").ref("seats/ABCDEF/w").once("value"));
  // A stranger without the key can't take the seat.
  await assertFails(as("mallory").ref().update({ "games/ABCDEF/players/w": "mallory", "games/ABCDEF/reclaimWith": KEY2 }));
  // Using the key but keeping it isn't allowed (it would work again).
  await assertFails(as("alice2").ref().update({ "games/ABCDEF/players/w": "alice2", "games/ABCDEF/reclaimWith": KEY }));
  // The real reclaim: new number, old key named and deleted, fresh key added.
  await assertSucceeds(as("alice2").ref().update({
    "games/ABCDEF/players/w": "alice2",
    "games/ABCDEF/reclaimWith": KEY,
    [`seats/ABCDEF/w/${KEY}`]: null,
    [`seats/ABCDEF/w/${KEY2}`]: "alice2",
  }));
  // The used key (now visible in the game) can't be used again.
  await assertFails(as("mallory").ref().update({
    "games/ABCDEF/players/w": "mallory",
    "games/ABCDEF/reclaimWith": KEY,
    [`seats/ABCDEF/w/${KEY}`]: null,
  }));
  await assertSucceeds(as("alice2").ref("games/ABCDEF").update({ moves: "e2e4", ply: 1 }));
});

test("seat keys can only be added by the seat's player", async () => {
  await seed("games/ABCDEF", playing());
  await assertSucceeds(as("alice").ref(`seats/ABCDEF/w/${KEY}`).set("alice"));
  await assertFails(as("bob").ref(`seats/ABCDEF/w/${KEY2}`).set("bob"));
  await assertFails(as("bob").ref(`seats/ABCDEF/b/${KEY2}`).set("alice"));
  await assertSucceeds(as("bob").ref(`seats/ABCDEF/b/${KEY2}`).set("bob"));
});

test("friend links: a challenge must be signed by the sender", async () => {
  const pair = "ABCDEFGHJKMNPQRS";
  const value = (by) => ({ expires: now() + 86400000, invite: { code: "ABCDEF", by, at: now() } });
  await assertSucceeds(as("alice").ref(`pairs/${pair}`).set(value("alice")));
  await assertFails(as("alice").ref(`pairs/${pair}`).set(value("bob")));
  await assertFails(as("alice").ref(`pairs/${pair}/invite/code`).set("not a code"));
  await assertFails(as("alice").ref("pairs").once("value"));
});

test("daily stats only go up one at a time", async () => {
  const day = "stats/daily/2026-11-22";
  await assertSucceeds(as("alice").ref(day).set({ solved: 1, firstTry: 1 }));
  await assertFails(as("bob").ref(day).set({ solved: 5, firstTry: 1 }));
  await assertFails(as("bob").ref(day).set({ solved: 2, firstTry: 3 }));
  await assertSucceeds(as("bob").ref(day).set({ solved: 2, firstTry: 1 }));
  await assertFails(as("bob").ref("stats/daily/not-a-date").set({ solved: 1, firstTry: 0 }));
});

test("expired games can be cleaned up by anyone, others can't be deleted by strangers", async () => {
  await seed("games/ABCDEF", waiting({ expires: now() - 1000 }));
  await seed("games/BCDEFG", waiting());
  await assertSucceeds(as("carol").ref("games/ABCDEF").remove());
  await assertFails(as("carol").ref("games/BCDEFG").remove());
  await assertSucceeds(as("alice").ref("games/BCDEFG").remove()); // a player can (Cancel game)
});
