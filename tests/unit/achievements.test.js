// Badges are worked out from saved progress; once earned they're kept.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
globalThis.dispatchEvent ||= () => true;
const { BADGES, checkBadges, earnedBadges, bump, best } = await import("../../src/lib/achievements.js");
const { ALL_LESSONS } = await import("../../src/content/lessons.js");
const set = (key, value) => localStorage.setItem(`chessQuest_${key}`, JSON.stringify(value));
const SIZES = { mate1: 60, hanging: 50, mate2: 50, fork: 30, material: 30, pin: 30, discovered: 30, mate3: 27, defend: 27 };

beforeEach(() => store.clear());

test("badges have unique ids, a group, a title and a hint", () => {
  const ids = new Set(BADGES.map((b) => b.id));
  assert.equal(ids.size, BADGES.length);
  for (const b of BADGES) assert.ok(b.group && b.title && b.hint && b.emoji, b.id);
});

test("nothing is earned without progress; the first check is flagged", () => {
  const { fresh, first } = checkBadges(SIZES);
  assert.equal(fresh.length, 0);
  assert.equal(first, true);
  assert.equal(checkBadges(SIZES).first, false);
});

test("progress earns the matching badges, once", () => {
  checkBadges(SIZES);
  set("lessons", { [ALL_LESSONS[0].id]: { stars: 3 } });
  set("puzzles", { mate1: [0, 1] });
  set("games", { beginner: { w: 1, l: 0, d: 0 } });
  const ids = checkBadges(SIZES).fresh.map((b) => b.id).sort();
  assert.deepEqual(ids, ["first-game", "first-lesson", "first-puzzle", "win-beginner"]);
  assert.deepEqual(checkBadges(SIZES).fresh, []);
});

test("finishing a whole set, a crown, and the mate sets", () => {
  checkBadges(SIZES);
  const all = (n) => Array.from({ length: n }, (_, i) => i);
  set("puzzles", { mate1: all(60), mate2: all(50), mate3: all(27) });
  set("puzzlesClean", { mate1: all(60) });
  const ids = checkBadges(SIZES).fresh.map((b) => b.id);
  for (const id of ["set-done", "crowned", "mate-maestro", "puzzles-50"]) assert.ok(ids.includes(id), id);
});

test("counters: online games, pass-and-play, reviews, and the best streak is kept", () => {
  checkBadges(SIZES);
  bump("onlineGames");
  bump("friendGames");
  bump("reviews");
  best("bestStreak", 7);
  best("bestStreak", 2); // a broken streak later doesn't lower it
  const ids = checkBadges(SIZES).fresh.map((b) => b.id).sort();
  assert.deepEqual(ids, ["online-first", "pass-and-play", "reviewer", "streak-7"]);
  assert.ok(earnedBadges()["streak-7"]);
});

test("a badge stays earned even if the progress behind it is later reset", () => {
  checkBadges(SIZES);
  set("lessons", { [ALL_LESSONS[0].id]: { stars: 1 } });
  checkBadges(SIZES);
  set("lessons", {});
  checkBadges(SIZES);
  assert.ok(earnedBadges()["first-lesson"]);
});
