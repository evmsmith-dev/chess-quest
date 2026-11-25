// On touch screens the tap that opens a pop-up ends on the pop-up's backdrop: that mustn't close it.
import { test, expect } from "@playwright/test";
import { openApp, square } from "./helpers.js";

async function touchTap(page, name) {
  const box = await square(page, name).boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

test("tapping the promotion square on a touch screen keeps the promotion choice open", async ({ page }, info) => {
  test.skip(!info.project.use.hasTouch, "touch screens only");
  await openApp(page);
  await page.locator("#learn-btn").click();
  await page.locator('[data-lesson="promotion"]').click();
  await page.locator("#tip-overlay .primary").click();
  await touchTap(page, "e7");
  await touchTap(page, "e8");
  await expect(page.locator("#promotion-overlay")).toBeVisible();
  await page.waitForTimeout(400);
  await expect(page.locator("#promotion-overlay")).toBeVisible();
  // A fresh tap on the backdrop still closes it, and a choice still works.
  await page.locator("#promotion-overlay .overlay-backdrop").tap({ position: { x: 10, y: 10 } });
  await expect(page.locator("#promotion-overlay")).toBeHidden();
  await touchTap(page, "e7");
  await touchTap(page, "e8");
  await page.locator('[data-promo="q"]').tap();
  await expect(page.locator("#message")).toContainText("A new queen");
});
