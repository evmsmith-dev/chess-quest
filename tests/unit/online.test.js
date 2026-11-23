import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { makeCode, cleanCode, newGameRecord, withMove, withJoin, withResult, turnOf, avatarOf, AVATARS, CODE_LENGTH } from "../../src/online/common.js";

test("game codes", () => {
  for (let i = 0; i < 200; i++) {
    const code = makeCode();
    assert.equal(code.length, CODE_LENGTH);
    assert.match(code, /^[A-HJKMNP-Z2-9]{6}$/); // the same pattern as database.rules.json
  }
  assert.equal(cleanCode(" k7q f2m "), "K7QF2M");
  assert.equal(cleanCode("K7QF2"), null);
  assert.equal(cleanCode("K7QF2I"), null); // I isn't used
});

test("joining, turns and results", () => {
  const g0 = newGameRecord({ uid: "A", color: "w", avatar: "🦊", now: Date.now() });
  assert.equal(withMove(g0, "A", 0, "e2e4"), null, "no moves before the second player joins");
  const g1 = withJoin(g0, "B", "🐼");
  assert.equal(g1.players.b, "B");
  assert.equal(g1.status, "playing");
  assert.equal(withJoin(g1, "C", "🐸"), null, "a full game can't be joined");
  assert.equal(withJoin(g1, "B", "🐼"), g1, "rejoining your own game is fine");
  assert.equal(withMove(g1, "B", 0, "e7e5"), null, "not Black's turn");
  const g2 = withMove(g1, "A", 0, "e2e4");
  assert.equal(g2.moves, "e2e4");
  assert.equal(turnOf(g2), "b");
  assert.equal(withMove(g2, "B", 0, "e7e5"), null, "a stale move is refused");
  const g3 = withMove({ ...g2, drawOffer: "w" }, "B", 1, "e7e5");
  assert.equal(g3.moves, "e2e4 e7e5");
  assert.equal(g3.drawOffer, undefined, "a move answers a draw offer");
  const over = withResult(g3, "A", { winner: "b", reason: "resigned" });
  assert.equal(over.status, "over");
  assert.equal(withMove(over, "A", 2, "d2d4"), null, "no moves after the end");
  assert.equal(withResult(g3, "C", { winner: "C", reason: "resigned" }), null, "only players can end it");
});

test("the Firebase config is filled in and complete", async () => {
  const { FIREBASE_CONFIG } = await import("../../src/online/config.js");
  for (const key of ["apiKey", "authDomain", "databaseURL", "projectId", "appId"]) assert.ok(FIREBASE_CONFIG?.[key], `missing ${key}`);
  assert.match(FIREBASE_CONFIG.databaseURL, /^https:\/\/.+(firebaseio\.com|firebasedatabase\.app)/);
  const { APP_CHECK_SITE_KEY } = await import("../../src/online/config.js");
  assert.ok(APP_CHECK_SITE_KEY === null || (typeof APP_CHECK_SITE_KEY === "string" && APP_CHECK_SITE_KEY.length > 20), "App Check key is null or a site key");
});

test("avatars are stored as numbers and only ever shown from the list", () => {
  const g = withJoin(newGameRecord({ uid: "A", color: "w", avatar: "🐯", now: Date.now() }), "B", "<b>hi</b>");
  assert.equal(g.avatars.w, AVATARS.indexOf("🐯"));
  assert.equal(g.avatars.b, 0, "anything not on the list is stored as the first avatar");
  assert.equal(avatarOf(g, "w"), "🐯");
  assert.equal(avatarOf({ avatars: { w: "<img src=x onerror=alert(1)>" } }, "w"), "❔");
  assert.equal(avatarOf({ avatars: { w: 99 } }, "w"), "❔");
  assert.equal(avatarOf({ avatars: { w: "🦉" } }, "w"), "🦉", "older games stored the emoji");
});

test("results: resigning, accepting draws and game-ending moves are checked", () => {
  const playing = withJoin(newGameRecord({ uid: "A", color: "w", avatar: "🦊", now: Date.now() }), "B", "🐼");
  assert.equal(withResult(playing, "A", { winner: "w", reason: "resigned" }), null, "you can't resign and win");
  assert.ok(withResult(playing, "A", { winner: "b", reason: "resigned" }));
  assert.equal(withResult(playing, "A", { winner: "draw", reason: "agreed" }), null, "no draw without an offer");
  assert.equal(withResult({ ...playing, drawOffer: "w" }, "A", { winner: "draw", reason: "agreed" }), null, "you can't accept your own offer");
  assert.ok(withResult({ ...playing, drawOffer: "b" }, "A", { winner: "draw", reason: "agreed" }));
  assert.equal(withResult(playing, "A", { winner: "w", reason: "checkmate" }), null, "checkmate only comes with a move");
  assert.equal(withMove(playing, "A", 0, "e2e4", { winner: "b", reason: "checkmate" }), null, "the mover wins a checkmate");
  assert.ok(withMove(playing, "A", 0, "e2e4", { winner: "w", reason: "checkmate" }));
  assert.equal(withMove(playing, "A", 0, "e2e4", { winner: "w", reason: "stalemate" }), null, "stalemate is a draw");
  assert.ok(withMove(playing, "A", 0, "e2e4", { winner: "draw", reason: "stalemate" }));
});

test("database rules file is valid and locked down by default", () => {
  const rules = JSON.parse(readFileSync(new URL("../../database.rules.json", import.meta.url), "utf8")).rules;
  assert.equal(rules[".read"], false);
  assert.equal(rules[".write"], false);
  assert.match(rules.games.$code[".write"], /auth != null/);
});

test("clocks: time runs only for the player to move, and a flag can be claimed", async () => {
  const { clockAt, outOfTime } = await import("../../src/online/common.js");
  const t0 = 1_000_000;
  const created = newGameRecord({ uid: "A", color: "w", avatar: "🦊", now: t0, minutes: 5 });
  assert.equal(created.clock, 300000);
  const g = withJoin(created, "B", "🐼", t0);
  assert.deepEqual(clockAt(g, t0 + 10000), { w: 290000, b: 300000 });
  const g2 = withMove(g, "A", 0, "e2e4", null, t0 + 10000);
  assert.equal(g2.time.w, 290000);
  assert.equal(g2.lastMoveAt, t0 + 10000);
  assert.deepEqual(clockAt(g2, t0 + 25000), { w: 290000, b: 285000 });
  assert.equal(outOfTime(g2, t0 + 200000), false);
  assert.equal(withResult(g2, "A", { winner: "w", reason: "timeout" }, t0 + 200000), null, "no claim before the flag falls");
  const late = t0 + 10000 + 300000 + 2000;
  assert.equal(outOfTime(g2, late), true);
  assert.equal(withMove(g2, "B", 1, "e7e5", null, late), null, "no moves after your time runs out");
  assert.equal(withResult(g2, "B", { winner: "b", reason: "timeout" }, late), null, "the player out of time can't win on time");
  const over = withResult(g2, "B", { winner: "w", reason: "timeout" }, late);
  assert.equal(over.result.reason, "timeout");
  assert.equal(newGameRecord({ uid: "A", color: "w", avatar: "🦊", now: t0, minutes: 7 }).clock, undefined, "only 5, 10 or 15 minutes");
});

test("friend link ids", async () => {
  const { makePairId, PAIR_LENGTH } = await import("../../src/online/common.js");
  const id = makePairId();
  assert.equal(id.length, PAIR_LENGTH);
  assert.match(id, /^[A-HJKMNP-Z2-9]{16}$/); // the pattern in database.rules.json
});

test("seat keys are random and saved per game and color", async () => {
  globalThis.localStorage ??= { _m: new Map(), getItem(k) { return this._m.get(k) ?? null; }, setItem(k, v) { this._m.set(k, String(v)); }, removeItem(k) { this._m.delete(k); } };
  const { makeSeatKey, seatKey, rememberSeatKey, SEAT_KEY_LENGTH } = await import("../../src/online/common.js");
  const a = makeSeatKey();
  assert.equal(a.length, SEAT_KEY_LENGTH);
  assert.match(a, /^[A-HJKMNP-Z2-9]{24}$/); // the pattern in database.rules.json
  assert.notEqual(a, makeSeatKey());
  rememberSeatKey("ABCDEF", "w", a);
  assert.equal(seatKey("ABCDEF", "w"), a);
  assert.equal(seatKey("ABCDEF", "b"), null);
  for (let i = 0; i < 60; i++) rememberSeatKey(`C${String(i).padStart(5, "0")}`, "b", a);
  assert.equal(seatKey("ABCDEF", "w"), null, "only the newest 50 games are kept");
});
