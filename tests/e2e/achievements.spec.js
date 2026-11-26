// Badges: earned from progress, celebrated with a banner, shown on the badge wall.
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { openApp, tapMove } from "./helpers.js";

const PUZZLES = JSON.parse(readFileSync(new URL("../../data/puzzles.json", import.meta.url)));

test("solving a first puzzle earns a badge: banner, badge wall, Home summary", async ({ page }) => {
  await openApp(page, { storage: { achievements: {} } });
  await expect(page.locator("#achievements-summary")).toHaveText("Badges for the chess skills you learn");
  await page.locator("#challenges-btn").click();
  await page.locator('[data-set="mate1"]').click();
  const uci = PUZZLES.mate1[0].line[0];
  await tapMove(page, uci.slice(0, 2), uci.slice(2, 4));
  await page.clock.runFor(1000);
  await expect(page.locator("#badge-banner")).toBeVisible();
  await expect(page.locator("#badge-banner")).toContainText("Badge earned: 🧩 Puzzle solver");
  await page.locator("#badge-banner-body").click();
  await expect(page.locator("#achievements")).toBeVisible();
  await expect(page.locator('[data-badge="first-puzzle"]')).toHaveClass(/is-earned/);
  await expect(page.locator('[data-badge="first-lesson"]')).toHaveClass(/is-locked/);
  await expect(page.locator('[data-badge="first-lesson"]')).toContainText("Finish your first lesson.");
  await expect(page.locator("#achievements-intro")).toContainText("You've earned 1 of");
  await page.goBack();
  await page.goBack();
  await page.goBack();
  await expect(page.locator("#achievements-summary")).toContainText("1 of");
});

test("progress from before badges existed gets one summary, not a flood", async ({ page }) => {
  await openApp(page, { storage: { lessons: { "pawn": { stars: 3 }, "rook": { stars: 3 } }, games: { beginner: { w: 2, l: 1, d: 0 } } } });
  await expect(page.locator("#badge-banner")).toContainText("You've already earned 3 badges!");
  await page.locator("#badge-banner-close").click();
  await expect(page.locator("#badge-banner")).toBeHidden();
  await page.locator("#achievements-btn").click();
  await expect(page.locator(".badge.is-earned")).toHaveCount(3);
});

test("the banner goes away by itself, and the Tip Card has the coach", async ({ page }) => {
  await openApp(page, { storage: { achievements: {} } });
  await page.locator("#learn-btn").click();
  await page.locator('[data-lesson="rook"]').click();
  await expect(page.locator("#tip-overlay .tip-coach svg")).toBeVisible();
  await expect(page.locator("#tip-overlay .tip-kicker")).toContainText("Coach Knightly");
  await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem("chessQuest_lessons") || "{}");
    p.rook = { stars: 3 };
    localStorage.setItem("chessQuest_lessons", JSON.stringify(p));
    dispatchEvent(new Event("chessquest:progress"));
  });
  await page.clock.runFor(1000);
  await expect(page.locator("#badge-banner")).toContainText("First step");
  await page.clock.runFor(7000);
  await expect(page.locator("#badge-banner")).toBeHidden();
});
