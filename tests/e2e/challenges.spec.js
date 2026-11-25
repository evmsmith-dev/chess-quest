// Finishing a set, practice and retry rounds, and the speed drill.
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { Chess } from "chess.js";
import { openApp, tapMove } from "./helpers.js";

const PUZZLES = JSON.parse(readFileSync(new URL("../../data/puzzles.json", import.meta.url)));
const range = (n) => Array.from({ length: n }, (_, i) => i);
const MATE1 = PUZZLES.mate1.length;

/** Plays the first move of a puzzle's solution. */
async function solve(page, kind, index) {
  const uci = PUZZLES[kind][index].line[0];
  await tapMove(page, uci.slice(0, 2), uci.slice(2, 4));
}

/** A legal move that isn't the puzzle's answer. */
function wrongMove(kind, index) {
  const { fen, line } = PUZZLES[kind][index];
  return new Chess(fen).moves({ verbose: true }).map((m) => m.from + m.to).find((u) => u !== line[0].slice(0, 4));
}

/** The order shuffled() gives when Math.random always returns 0. */
function zeroShuffle(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) [out[i], out[0]] = [out[0], out[i]];
  return out;
}

async function openChallenges(page) {
  await page.locator("#challenges-btn").click();
  await expect(page.locator("#challenges")).toBeVisible();
}

test("solving the last puzzle of a set celebrates and suggests the next set", async ({ page }) => {
  await openApp(page, { storage: { puzzles: { mate1: range(MATE1 - 1) }, puzzlesClean: { mate1: range(MATE1 - 1) } } });
  await openChallenges(page);
  await page.locator('[data-set="mate1"]').click();
  await expect(page.locator("#play-sub")).toContainText(`Puzzle ${MATE1} of ${MATE1}`);
  await solve(page, "mate1", MATE1 - 1);
  await expect(page.locator("#result-title")).toHaveText("Mate in 1 complete!");
  await expect(page.locator("#result-text")).toContainText("crown");
  await expect(page.locator("#result-primary")).toHaveText("Try Free pieces ➜");
  // Next no longer loops on the same puzzle: it goes on to puzzle 1.
  await page.locator("#result-secondary").click();
  await page.locator("#ctl-next").click();
  await expect(page.locator("#play-sub")).toContainText(`Puzzle 1 of ${MATE1}`);
});

test("the completion pop-up's button opens the suggested set", async ({ page }) => {
  await openApp(page, { storage: { puzzles: { mate1: range(MATE1 - 1) }, puzzlesClean: { mate1: [] } } });
  await openChallenges(page);
  await page.locator('[data-set="mate1"]').click();
  await solve(page, "mate1", MATE1 - 1);
  await expect(page.locator("#result-text")).toContainText(`${MATE1 - 1} of them took more than one try`);
  await page.locator("#result-primary").click();
  await expect(page.locator("#play-title")).toHaveText("Free pieces");
});

test("a finished set offers Retry missed, and getting them all earns the crown", async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 0; });
  await openApp(page, { storage: { puzzles: { mate1: range(MATE1) }, puzzlesClean: { mate1: range(MATE1 - 2) } } });
  await openChallenges(page);
  await expect(page.locator('[data-set="mate1"] .set-count')).toContainText("✓");
  await expect(page.locator('[data-set="mate1"]')).toContainText(`${MATE1 - 2}/${MATE1} on the first try`);
  await page.locator('[data-set="mate1"]').click();
  await expect(page.locator("#set-overlay")).toBeVisible();
  await expect(page.locator("#set-retry")).toContainText("Retry missed (2)");
  await page.locator("#set-retry").click();
  const order = zeroShuffle([MATE1 - 2, MATE1 - 1]);
  await expect(page.locator("#play-sub")).toContainText("Retry missed · 1 of 2");
  await solve(page, "mate1", order[0]);
  await page.locator("#ctl-next").click();
  await expect(page.locator("#play-sub")).toContainText("Retry missed · 2 of 2");
  await solve(page, "mate1", order[1]);
  await page.locator("#ctl-next").click(); // Finish
  await expect(page.locator("#result-title")).toHaveText("Retry round done!");
  await expect(page.locator("#result-emoji")).toHaveText("👑");
  await page.locator("#result-primary").click();
  await expect(page.locator('[data-set="mate1"] .set-count')).toContainText("👑");
});

test("Practice plays a finished set in a shuffled order", async ({ page }) => {
  await openApp(page, { storage: { puzzles: { mate1: range(MATE1) }, puzzlesClean: { mate1: range(MATE1) } } });
  await openChallenges(page);
  await page.locator('[data-set="mate1"]').click();
  await expect(page.locator("#set-retry")).toBeHidden();
  await page.locator("#set-practice").click();
  await expect(page.locator("#play-sub")).toContainText(`Practice · 1 of ${MATE1}`);
});

test("speed drill: solve, lose lives, and the best score is kept", async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 0; });
  await openApp(page);
  await openChallenges(page);
  await page.locator("#drill-btn").click();
  await page.locator('[data-drill="mate1"]').click();
  await expect(page.locator("#play-title")).toHaveText("⚡ Speed drill");
  await expect(page.locator("#ctl-hint")).toHaveCount(0);
  const order = zeroShuffle(range(MATE1));
  await solve(page, "mate1", order[0]);
  await page.clock.runFor(600);
  await expect(page.locator("#play-sub")).toContainText("✅ 1");
  // Three wrong answers end it.
  for (let k = 1; k <= 3; k++) {
    const miss = wrongMove("mate1", order[k]);
    await tapMove(page, miss.slice(0, 2), miss.slice(2, 4));
    await expect(page.locator("#message")).toContainText("The answer was");
    await page.clock.runFor(1500);
  }
  await expect(page.locator("#result-title")).toHaveText("1 solved!");
  await expect(page.locator("#result-text")).toContainText("Out of lives");
  await page.locator("#result-secondary").click(); // Done
  await expect(page.locator("#challenges")).toBeVisible();
  await page.locator("#drill-btn").click();
  await expect(page.locator('[data-drill="mate1"]')).toContainText("Best: 1");
});

test("speed drill ends when time runs out", async ({ page }) => {
  await openApp(page);
  await openChallenges(page);
  await page.locator("#drill-btn").click();
  await page.locator('[data-drill="hanging"]').click();
  await expect(page.locator("#play-sub")).toContainText("⏱ 3:00");
  await page.clock.runFor(60000);
  await expect(page.locator("#play-sub")).toContainText("⏱ 2:00");
  await page.clock.runFor(121000);
  await expect(page.locator("#result-title")).toHaveText("0 solved!");
  await expect(page.locator("#result-text")).toContainText("Time's up");
});

test("puzzles solved before first-try tracking count as first-try", async ({ page }) => {
  await openApp(page, { storage: { puzzles: { mate1: range(MATE1) } } });
  await openChallenges(page);
  await expect(page.locator('[data-set="mate1"] .set-count')).toContainText("👑");
});

/** Replaces navigator.storage with a fake that counts persist() requests. */
async function fakeStorage(page, { persisted = false } = {}) {
  await page.addInitScript((persisted) => {
    window.__persistCalls = Number(sessionStorage.getItem("persistCalls")) || 0;
    Object.defineProperty(navigator, "storage", { configurable: true, value: {
      persisted: async () => persisted,
      persist: async () => { window.__persistCalls++; sessionStorage.setItem("persistCalls", window.__persistCalls); return true; },
    } });
  }, persisted);
}

test("saving puzzle progress asks the browser to keep the data, at most once a day", async ({ page }) => {
  await fakeStorage(page);
  await openApp(page);
  expect(await page.evaluate(() => window.__persistCalls)).toBe(0); // not on first load
  await openChallenges(page);
  await page.locator('[data-set="mate1"]').click();
  await solve(page, "mate1", 0);
  await expect.poll(() => page.evaluate(() => window.__persistCalls)).toBe(1);
  // Next puzzle, and after a reload the same day: no new request.
  await page.locator("#ctl-next").click();
  await solve(page, "mate1", 1);
  await page.reload();
  await openChallenges(page);
  await page.locator('[data-set="mate1"]').click();
  await solve(page, "mate1", 2);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__persistCalls)).toBe(1);
});

test("no request when the browser already keeps the data", async ({ page }) => {
  await fakeStorage(page, { persisted: true });
  await openApp(page);
  await openChallenges(page);
  await page.locator('[data-set="mate1"]').click();
  await solve(page, "mate1", 0);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__persistCalls)).toBe(0);
});
