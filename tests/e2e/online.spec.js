// Online play, with two tabs in one browser standing in for two phones (the local backend).
import { test, expect } from "@playwright/test";
import { openApp, square, tapMove, pieceOn } from "./helpers.js";

async function createGame(page, color = "w") {
  await page.locator("#online-btn").click();
  await page.locator(`[data-online-color="${color}"]`).click();
  await page.locator("#online-create").click();
  await expect(page.locator(".game-code")).toBeVisible();
  return (await page.locator(".game-code").textContent()).trim();
}

async function joinGame(page, code) {
  await page.locator("#online-btn").click();
  await page.locator("#online-code").fill(code);
  await page.locator("#online-join").click();
  await expect(page.locator("#play-title")).toHaveText("Online game");
}

async function twoPlayers(context) {
  const host = await context.newPage();
  const guest = await context.newPage();
  await openApp(host, { online: true, clock: false });
  await openApp(guest, { online: true, clock: false });
  const code = await createGame(host, "w");
  await joinGame(guest, code);
  await expect(host.locator("#message")).toContainText("Your move");
  return { host, guest, code };
}

test("create, join with the code, and play moves both ways", async ({ context }) => {
  const { host, guest } = await twoPlayers(context);
  await expect(guest.locator("#message")).toContainText("Waiting for your opponent's move");
  // The guest plays Black: the board faces them.
  const a8 = await square(guest, "a8").boundingBox();
  const a1 = await square(guest, "a1").boundingBox();
  expect(a8.y).toBeGreaterThan(a1.y);
  // It's not the guest's turn: their pieces don't move.
  await tapMove(guest, "e7", "e5");
  await expect.poll(() => pieceOn(guest, "e7")).toBe("bp");
  await tapMove(host, "e2", "e4");
  await expect.poll(() => pieceOn(guest, "e4")).toBe("wp");
  await expect(guest.locator("#message")).toContainText("Your move");
  await tapMove(guest, "e7", "e5");
  await expect.poll(() => pieceOn(host, "e5")).toBe("bp");
  await expect(host.locator("#move-list")).toContainText("e5");
});

test("a join link opens the pop-up with the code filled in", async ({ context }) => {
  const host = await context.newPage();
  await openApp(host, { online: true, clock: false });
  const code = await createGame(host);
  const guest = await context.newPage();
  await openApp(guest, { online: true, clock: false, path: `index.html?join=${code}` });
  await expect(guest.locator("#online-overlay")).toBeVisible();
  await expect(guest.locator("#online-code")).toHaveValue(code);
  expect(guest.url()).not.toContain("join=");
  await guest.locator("#online-join").click();
  await expect(host.locator("#message")).toContainText("Your move");
});

test("a wrong code and a full game are explained", async ({ context }) => {
  const { code } = await twoPlayers(context);
  const third = await context.newPage();
  await openApp(third, { online: true, clock: false });
  await third.locator("#online-btn").click();
  await third.locator("#online-code").fill("ZZZZ");
  await third.locator("#online-join").click();
  await expect(third.locator("#online-error")).toContainText("6 letters");
  await third.locator("#online-code").fill("ZZZZZZ");
  await third.locator("#online-join").click();
  await expect(third.locator("#online-error")).toContainText("no game with that code");
  await third.locator("#online-code").fill(code.toLowerCase());
  await third.locator("#online-join").click();
  await expect(third.locator("#online-error")).toContainText("already has two players");
});

test("resign ends the game for both, and a rematch swaps sides", async ({ context }) => {
  const { host, guest } = await twoPlayers(context);
  await guest.locator("#controls").getByRole("button", { name: /Resign/ }).click();
  await guest.locator("#confirm-ok").click();
  await expect(host.locator("#result-title")).toHaveText("You win!");
  await expect(host.locator("#result-text")).toContainText("opponent resigned");
  await expect(guest.locator("#result-title")).toHaveText("Your opponent wins");
  await guest.locator("#result-primary").click(); // Rematch
  await expect(guest.locator(".game-code")).toBeVisible();
  await host.locator("#result-secondary").click(); // See the board
  await host.locator("#controls").getByRole("button", { name: /Join rematch/ }).click();
  // Sides swapped: the guest is White now and moves first.
  await expect(guest.locator("#message")).toContainText("Your move. You play White");
  await expect(host.locator("#message")).toContainText("Waiting for your opponent's move");
});

test("a draw offer can be accepted", async ({ context }) => {
  const { host, guest } = await twoPlayers(context);
  await host.locator("#ctl-draw").click();
  await expect(guest.locator("#offer")).toBeVisible();
  await guest.locator("#offer-accept").click();
  await expect(host.locator("#result-title")).toHaveText("Draw");
  await expect(guest.locator("#result-title")).toHaveText("Draw");
});

test("a draw offer can be declined", async ({ context }) => {
  const { host, guest } = await twoPlayers(context);
  await host.locator("#ctl-draw").click();
  await guest.locator("#offer-decline").click();
  await expect(guest.locator("#offer")).toBeHidden();
  await expect(host.locator("#message")).toContainText("Your move");
});

test("checkmate is shown to both players", async ({ context }) => {
  const { host, guest } = await twoPlayers(context);
  for (const [page, from, to] of [[host, "f2", "f3"], [guest, "e7", "e5"], [host, "g2", "g4"], [guest, "d8", "h4"]]) {
    await expect(page.locator("#message")).toContainText("Your move");
    await tapMove(page, from, to);
  }
  await expect(guest.locator("#result-title")).toHaveText("You win!");
  await expect(host.locator("#result-text")).toContainText("checkmate");
});

test("leaving and coming back continues the game", async ({ context }) => {
  const { host, guest } = await twoPlayers(context);
  await tapMove(host, "d2", "d4");
  await expect.poll(() => pieceOn(guest, "d4")).toBe("wp");
  await guest.goBack();
  await expect(guest.locator("#continue-online-btn")).toBeVisible();
  await tapMove(host, "c2", "c4").catch(() => {}); // not the host's turn: ignored
  await guest.reload();
  await guest.locator("#continue-online-btn").click();
  await expect.poll(() => pieceOn(guest, "d4")).toBe("wp");
  await expect(guest.locator("#message")).toContainText("Your move");
});

test("the other player going offline is shown", async ({ context }) => {
  const { host, guest } = await twoPlayers(context);
  await tapMove(host, "e2", "e4");
  await guest.close({ runBeforeUnload: true });
  await expect(host.locator("#bar-top")).toContainText("offline");
  await expect(host.locator("#message")).toContainText("opponent is offline");
});

test("without Firebase set up, online play says so", async ({ page }) => {
  await openApp(page);
  await page.locator("#online-btn").click();
  await expect(page.locator("#online-unavailable")).toBeVisible();
  await expect(page.locator("#online-setup")).toBeHidden();
});
