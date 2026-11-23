import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { makeCode, cleanCode, newGameRecord, withMove, withJoin, withResult, turnOf, CODE_LENGTH } from "../../src/online/common.js";

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

test("database rules file is valid and locked down by default", () => {
  const rules = JSON.parse(readFileSync(new URL("../../database.rules.json", import.meta.url), "utf8")).rules;
  assert.equal(rules[".read"], false);
  assert.equal(rules[".write"], false);
  assert.match(rules.games.$code[".write"], /auth != null/);
});
