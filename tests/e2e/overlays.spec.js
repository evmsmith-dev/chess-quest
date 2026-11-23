// Every pop-up must be dismissable four ways: its ✕, a tap outside it, Escape, and Back.
import { test, expect } from "@playwright/test";
import { openApp, tapMove } from "./helpers.js";

const OPENERS = {
  "settings-overlay": async (page) => page.locator("#settings-btn").click(),
  "privacy-overlay": async (page) => {
    await page.locator("#settings-btn").click();
    await page.locator("#privacy-btn").click();
  },
  "newgame-overlay": async (page) => page.locator("#new-game-btn").click(),
  "friend-overlay": async (page) => page.locator("#friend-btn").click(),
  "online-overlay": async (page) => page.locator("#online-btn").click(),
  "addfriend-overlay": async (page) => {
    // Finish a quick online game against a second tab, then tap Add friend.
    const guest = await page.context().newPage();
    await openApp(guest);
    await page.locator("#online-btn").click();
    await page.locator("#online-create").click();
    const code = (await page.locator(".game-code").textContent()).trim();
    await guest.locator("#online-btn").click();
    await guest.locator("#online-code").fill(code);
    await guest.locator("#online-join").click();
    await page.locator("#controls").getByRole("button", { name: /Resign/ }).click();
    await page.locator("#confirm-ok").click();
    await page.clock.runFor(1500);
    await page.locator("#result-overlay .overlay-close").click();
    await page.locator("#ctl-friend").click();
  },
  "tip-overlay": async (page) => {
    await page.locator("#learn-btn").click();
    await page.locator('[data-lesson="rook"]').click();
  },
  "menu-overlay": async (page) => {
    await page.locator("#new-game-btn").click();
    await page.locator("#start-game-btn").click();
    await page.getByRole("button", { name: "Game menu" }).click();
  },
  "confirm-overlay": async (page) => {
    await page.locator("#new-game-btn").click();
    await page.locator("#start-game-btn").click();
    await page.getByRole("button", { name: "Game menu" }).click();
    await page.locator("#menu-resign").click();
  },
  "promotion-overlay": async (page) => {
    await page.evaluate(() => localStorage.setItem("chessQuest_current", JSON.stringify({ level: "beginner", color: "w", coach: false, undo: true, hints: true, moves: ["a2a4", "b7b5", "a4b5", "a7a6", "b5a6", "c8b7", "a6b7", "h7h6"] })));
    await page.reload();
    await page.locator("#continue-btn").click();
    await tapMove(page, "b7", "a8");
  },
  "result-overlay": async (page) => {
    await page.locator("#new-game-btn").click();
    await page.locator("#start-game-btn").click();
    await page.getByRole("button", { name: "Game menu" }).click();
    await page.locator("#menu-resign").click();
    await page.locator("#confirm-ok").click();
    await page.clock.runFor(1500);
  },
};

const WAYS = {
  "the ✕ button": async (page, id) => page.locator(`#${id} .overlay-close`).click(),
  "a tap outside": async (page) => page.mouse.click(4, 4),
  Escape: async (page) => page.keyboard.press("Escape"),
  Back: async (page) => page.goBack(),
};

for (const [id, open] of Object.entries(OPENERS)) {
  for (const [way, close] of Object.entries(WAYS)) {
    test(`${id} closes with ${way}`, async ({ page }) => {
      await openApp(page);
      await open(page);
      await expect(page.locator(`#${id}`)).toBeVisible();
      await close(page, id);
      await expect(page.locator(`#${id}`)).toBeHidden();
    });
  }
}
