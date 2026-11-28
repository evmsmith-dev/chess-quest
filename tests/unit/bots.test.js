import { test } from "node:test";
import assert from "node:assert/strict";
import { BOTS, BOT_START, nextUpBot, botAfter } from "../../src/content/bots.js";
import { LEVELS } from "../../src/chess/engine.js";

test("every bot is complete, with a unique id and badge", () => {
  const ids = new Set();
  const badges = new Set();
  for (const b of BOTS) {
    for (const key of ["id", "name", "kind", "emoji", "about", "hello", "tier"]) assert.ok(b[key], `${b.id}: ${key}`);
    assert.ok(LEVELS[b.engine.level], `${b.id}: engine level`);
    assert.ok(!ids.has(b.id) && !badges.has(b.badge.id), `${b.id}: duplicate`);
    ids.add(b.id);
    badges.add(b.badge.id);
  }
  // The two bots from before the ladder keep their ids, so saved games and records still work.
  assert.ok(ids.has("beginner") && ids.has("intermediate"));
});

test("Next up is the bot after the highest one won against", () => {
  assert.equal(nextUpBot({}).id, BOTS[0].id);
  assert.equal(nextUpBot({ beginner: { w: 2, l: 1, d: 0 } }).id, "shelly");
  assert.equal(nextUpBot({ pip: { w: 0, l: 3, d: 0 } }).id, BOTS[0].id); // losses don't count
  assert.equal(nextUpBot(Object.fromEntries(BOTS.map((b) => [b.id, { w: 1, l: 0, d: 0 }]))), null);
  assert.equal(botAfter("pip").id, "bramble");
  assert.equal(botAfter(BOTS.at(-1).id), null);
});

test("every bot has a tier group, and groups run easiest first without mixing", () => {
  const order = [...new Set(BOTS.map((b) => b.group))];
  assert.deepEqual(order, ["Beginner", "Intermediate"]);
  for (const g of order) {
    const idx = BOTS.map((b, i) => (b.group === g ? i : -1)).filter((i) => i >= 0);
    assert.equal(idx.at(-1) - idx[0] + 1, idx.length, `${g} is one block`);
  }
  for (const b of BOTS) assert.ok(b.plays, `${b.id}: plays`);
});

test("the one-time question starts each answer at a real bot", () => {
  assert.deepEqual(BOT_START.map((a) => a.bot), ["pip", "beginner", "hoot"]);
  for (const a of BOT_START) assert.ok(BOTS.some((b) => b.id === a.bot));
});
