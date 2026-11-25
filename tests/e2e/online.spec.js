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
  await host.locator("#result-overlay .overlay-close").click();
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
  await openApp(page, { backend: "off" });
  await page.locator("#online-btn").click();
  await expect(page.locator("#online-unavailable")).toBeVisible();
  await expect(page.locator("#online-setup")).toBeHidden();
});

async function twoPlayersWith(context, { minutes = 0, clock = false } = {}) {
  const host = await context.newPage();
  const guest = await context.newPage();
  await openApp(host, { clock });
  await openApp(guest, { clock });
  await host.locator("#online-btn").click();
  await host.locator('[data-online-color="w"]').click();
  await host.locator(`[data-clock-minutes="${minutes}"]`).click();
  await host.locator("#online-create").click();
  const code = (await host.locator(".game-code").textContent()).trim();
  await joinGame(guest, code);
  await expect(host.locator("#message")).toContainText("Your move");
  return { host, guest };
}

test("a clock game shows both clocks and only the mover's runs", async ({ context }) => {
  const { host, guest } = await twoPlayersWith(context, { minutes: 5 });
  await expect(host.locator('#bar-bottom [data-clock="w"]')).toHaveText(/^4:5\d|^5:00$/);
  await expect(host.locator('#bar-bottom [data-clock="w"]')).toHaveClass(/is-running/);
  await expect(guest.locator('#bar-bottom [data-clock="b"]')).toHaveText("5:00");
  await tapMove(host, "e2", "e4");
  await expect(guest.locator('#bar-bottom [data-clock="b"]')).toHaveClass(/is-running/);
  await expect(host.locator('#bar-bottom [data-clock="w"]')).not.toHaveClass(/is-running/);
});

test("running out of time loses the game", async ({ context }) => {
  const { host, guest } = await twoPlayersWith(context, { minutes: 5, clock: true });
  // White (the host) never moves: five minutes later the flag falls.
  await host.clock.fastForward("05:05");
  await expect(host.locator("#result-title")).toHaveText("Your opponent wins", { timeout: 10000 });
  await expect(host.locator("#result-text")).toContainText("You ran out of time");
  await expect(guest.locator("#result-title")).toHaveText("You win!");
});

test("friends: save a friend, then challenge them from Play online", async ({ context }) => {
  // Both tabs share this browser's storage, so one saved friend is "seen" by both; on real
  // devices each player keeps their own list and nickname.
  const { host, guest } = await twoPlayers(context);
  await guest.locator("#controls").getByRole("button", { name: /Resign/ }).click();
  await guest.locator("#confirm-ok").click();
  await host.locator("#result-overlay .overlay-close").click();
  await host.locator("#ctl-friend").click();
  await host.locator("#friend-name").fill("Sam");
  await host.locator("#save-friend").click();
  await expect(host.locator("#ctl-friend")).toHaveCount(0);
  // The host challenges Sam from Play online. The game just played counts toward the record.
  await host.goBack();
  await host.locator("#online-btn").click();
  await expect(host.locator("#friend-list")).toContainText("Sam");
  await expect(host.locator("#friend-list")).toContainText("1 win · 0 losses");
  await host.locator("[data-challenge]").click();
  await expect(host.locator("#message")).toContainText("Waiting for Sam");
  // The other device sees the challenge on Home (not the device that sent it) and joins.
  await expect(host.locator("#invite-card")).toBeHidden();
  await guest.goBack();
  // Shared storage again: the host's "current online game" would look like the guest's own.
  await guest.evaluate(() => localStorage.removeItem("chessQuest_onlineGame"));
  await guest.reload();
  await expect(guest.locator("#invite-card")).toBeVisible();
  await expect(guest.locator("#invite-text")).toContainText("challenged you to a game!");
  await guest.locator("#invite-join").click();
  await expect(guest.locator("#play-title")).toHaveText("Online game");
  await expect(host.locator("#message")).toContainText("Your move");
  await expect(host.locator("#bar-top")).toContainText("Sam");
  await expect(guest.locator("#invite-card")).toBeHidden();
});

test("a friend can be removed", async ({ context }) => {
  const page = await context.newPage();
  await openApp(page, { storage: { friends: [{ id: "ABCDEFGHJKMNPQRS", name: "Sam", avatar: 2, added: 1 }] } });
  await page.locator("#online-btn").click();
  await expect(page.locator("#friend-list")).toContainText("Sam");
  await page.getByRole("button", { name: "Remove Sam" }).click();
  await expect(page.locator("#friends-section")).toBeHidden();
});

test("the daily puzzle shows today's anonymous stats", async ({ page }) => {
  await openApp(page);
  await page.locator("#daily-btn").click();
  for (let step = 0; step < 3; step++) {
    if (await page.locator("#result-overlay").isVisible()) break;
    await page.locator("#ctl-hint").click();
    await page.locator("#ctl-hint").click();
    const m = (await page.locator("#message").textContent()).match(/from (\w\d) to (\w\d)/);
    await tapMove(page, m[1], m[2]);
    if (await page.locator("#promotion-overlay").isVisible()) await page.locator('[data-promo="q"]').click();
    await page.clock.runFor(1500);
  }
  await expect(page.locator("#result-text")).toContainText("You're the first to solve it today!");
  await page.locator("#result-primary").click();
  await expect(page.locator("#daily-status")).toContainText("first to solve it today");
});

test("a game nobody has joined can be cancelled", async ({ context }) => {
  const host = await context.newPage();
  await openApp(host, { clock: false });
  const code = await createGame(host);
  await host.locator("#ctl-cancel").click();
  await expect(host.locator("#confirm-title")).toHaveText("Cancel this game?");
  await host.locator("#confirm-ok").click();
  await expect(host.locator("#home")).toBeVisible();
  await expect(host.locator("#toast")).toContainText("Game cancelled");
  await expect(host.locator("#continue-online-btn")).toBeHidden();
  // The code no longer works.
  const guest = await context.newPage();
  await openApp(guest, { clock: false });
  await guest.locator("#online-btn").click();
  await guest.locator("#online-code").fill(code);
  await guest.locator("#online-join").click();
  await expect(guest.locator("#online-error")).toContainText("no game with that code");
});

test("cancelling a challenge withdraws it from the friend's Home", async ({ context }) => {
  const friend = { id: "ABCDEFGHJKMNPQRS", name: "Sam", avatar: 1, added: 1 };
  const host = await context.newPage();
  await openApp(host, { clock: false, storage: { friends: [friend] } });
  await host.locator("#online-btn").click();
  await host.locator("[data-challenge]").click();
  await expect(host.locator("#message")).toContainText("Waiting for Sam");
  const guest = await context.newPage();
  await openApp(guest, { clock: false });
  await guest.evaluate(() => localStorage.removeItem("chessQuest_onlineGame")); // shared tab storage
  await guest.reload();
  await expect(guest.locator("#invite-card")).toBeVisible();
  await host.locator("#ctl-cancel").click();
  await host.locator("#confirm-ok").click();
  await expect(guest.locator("#invite-card")).toBeHidden();
});

test("keeping the game (Cancel → No) leaves it waiting", async ({ context }) => {
  const host = await context.newPage();
  await openApp(host, { clock: false });
  await createGame(host);
  await host.locator("#ctl-cancel").click();
  await expect(host.locator("#confirm-no")).toHaveText("Keep it");
  await host.locator("#confirm-no").click();
  await expect(host.locator(".game-code")).toBeVisible();
});

test("after a new player number, the seat key reclaims the seat", async ({ context }) => {
  const { host, guest, code } = await twoPlayers(context);
  await tapMove(host, "e2", "e4");
  await expect.poll(() => pieceOn(guest, "e4")).toBe("wp");
  // Firebase replaced the host's anonymous player number (its 30-day clean-up).
  await host.evaluate((code) => {
    sessionStorage.removeItem("chessQuest_localUid");
    localStorage.setItem("chessQuest_onlineGame", JSON.stringify({ code, color: "w" })); // shared tab storage
  }, code);
  await host.reload();
  await host.locator("#continue-online-btn").click();
  await tapMove(guest, "e7", "e5");
  await expect(host.locator("#message")).toContainText("Your move");
  await tapMove(host, "g1", "f3");
  await expect.poll(() => pieceOn(guest, "f3")).toBe("wn");
});

test("without a seat key, a changed player number is explained", async ({ context }) => {
  const { host, code } = await twoPlayers(context);
  await host.evaluate((code) => {
    sessionStorage.removeItem("chessQuest_localUid");
    localStorage.removeItem("chessQuest_seatKeys");
    localStorage.setItem("chessQuest_onlineGame", JSON.stringify({ code, color: "w" }));
  }, code);
  await host.reload();
  await host.locator("#continue-online-btn").click();
  await expect(host.locator("#message")).toContainText("can't take part in this game any more");
});

test("offline: the online pop-up says so and its buttons wait for the connection", async ({ page, context }) => {
  await openApp(page);
  await page.locator("#online-btn").click();
  await expect(page.locator("#online-offline")).toBeHidden();
  await context.setOffline(true);
  await expect(page.locator("#online-offline")).toBeVisible();
  await expect(page.locator("#online-create")).toBeDisabled();
  await expect(page.locator("#online-join")).toBeDisabled();
  await context.setOffline(false);
  await expect(page.locator("#online-offline")).toBeHidden();
  await expect(page.locator("#online-create")).toBeEnabled();
});

test("offline during a game: a banner says moves will send later", async ({ context }) => {
  const { host } = await twoPlayers(context);
  await expect(host.locator("#conn-banner")).toBeHidden();
  await context.setOffline(true);
  await expect(host.locator("#conn-banner")).toBeVisible();
  await expect(host.locator("#conn-banner")).toContainText("Your moves will be sent when you reconnect");
  await context.setOffline(false);
  await expect(host.locator("#conn-banner")).toBeHidden();
  // Leaving the game hides it for good.
  await context.setOffline(true);
  await host.goBack();
  await expect(host.locator("#conn-banner")).toBeHidden();
  await context.setOffline(false);
});

test("a request that never answers gives up after 10 seconds", async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => { window.__CHESS_HANG = true; });
  await page.locator("#online-btn").click();
  await page.locator("#online-create").click();
  await expect(page.locator("#online-create")).toBeDisabled();
  await page.clock.fastForward(11000);
  await expect(page.locator("#online-error")).toContainText("Couldn't connect");
  await expect(page.locator("#online-create")).toBeEnabled();
});

test("Continue while offline explains why it can't open", async ({ page, context }) => {
  await openApp(page, { storage: { onlineGame: { code: "ABCDEF", color: "w" } } });
  await context.setOffline(true);
  await page.locator("#continue-online-btn").click();
  await expect(page.locator("#toast")).toContainText("You're offline");
  await context.setOffline(false);
});

/** Makes the page act as if the player switched to another app (or back). */
async function lookAway(page, away = true) {
  await page.evaluate((hidden) => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (hidden ? "hidden" : "visible") });
    Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
    document.dispatchEvent(new Event("visibilitychange"));
  }, away);
}

test("a 'Your move' alert shows in the title while the app is in the background", async ({ context }) => {
  const { host, guest } = await twoPlayers(context);
  await lookAway(guest);
  await tapMove(host, "e2", "e4");
  await expect(guest).toHaveTitle(/♟ Your move!/);
  await lookAway(guest, false);
  await expect(guest).toHaveTitle("Chess Quest");
  // Looking at the app: no alert.
  await tapMove(guest, "e7", "e5");
  await tapMove(host, "g1", "f3");
  await expect.poll(() => pieceOn(guest, "f3")).toBe("wn");
  await expect(guest).toHaveTitle("Chess Quest");
});

test("'Your move' alerts can be turned off in Settings", async ({ context }) => {
  const { host, guest } = await twoPlayers(context);
  await guest.evaluate(() => document.querySelector('[data-setting="turnAlerts"]').click());
  expect(await guest.evaluate(() => JSON.parse(localStorage.getItem("chessQuest_settings")).turnAlerts)).toBe(false);
  await lookAway(guest);
  await tapMove(host, "e2", "e4");
  await expect.poll(() => pieceOn(guest, "e4")).toBe("wp");
  await expect(guest).toHaveTitle("Chess Quest");
});

test("on a shorter iPad, the game code stays inside its box and the buttons stay on screen", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await openApp(page, { clock: false });
  await createGame(page, "b");
  const box = await page.evaluate(() => {
    const m = document.getElementById("message").getBoundingClientRect();
    const c = document.querySelector("#message .game-code").getBoundingClientRect();
    const k = document.getElementById("controls").getBoundingClientRect();
    return { inside: c.bottom <= m.bottom + 0.5 && c.top >= m.top, controlsBottom: k.bottom, height: innerHeight };
  });
  expect(box.inside).toBe(true);
  expect(box.controlsBottom).toBeLessThanOrEqual(box.height);
});

test("a finished online game can be reviewed, and Back returns to it", async ({ context }) => {
  const { host, guest } = await twoPlayers(context);
  await tapMove(host, "e2", "e4");
  await expect.poll(() => pieceOn(guest, "e4")).toBe("wp");
  await guest.locator("#controls").getByRole("button", { name: /Resign/ }).click();
  await guest.locator("#confirm-ok").click();
  await expect(host.locator("#result-secondary")).toHaveText("🔍 Review game");
  await host.locator("#result-secondary").click();
  await expect(host.locator("#play-title")).toHaveText("Game review");
  await expect(host.locator("#play-sub")).toContainText("Online · vs Opponent");
  await host.goBack();
  await expect(host.locator("#play-title")).toHaveText("Online game");
  await expect(host.locator("#ctl-review")).toBeVisible();
  await expect(host.locator("#controls")).toContainText("Rematch");
  await expect.poll(() => pieceOn(host, "e4")).toBe("wp");
});

/** A fake Notification API and service worker that record what was shown and closed. */
async function fakeNotifications(page, permission = "default") {
  await page.addInitScript((permission) => {
    window.__shown = [];
    window.__closed = 0;
    class FakeNotification {
      static permission = permission;
      static async requestPermission() { FakeNotification.permission = "granted"; return "granted"; }
    }
    window.Notification = FakeNotification;
    const reg = {
      showNotification: async (title, options) => { window.__shown.push({ title, body: options.body, tag: options.tag }); },
      getNotifications: async () => window.__shown.map(() => ({ close: () => { window.__closed++; } })),
    };
    Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { ready: Promise.resolve(reg), getRegistration: async () => reg, register: async () => reg, addEventListener() {}, controller: null } });
  }, permission);
}

test("'Your move' notifications: offered from a tap, shown in the background, cleared on return", async ({ context }) => {
  const host = await context.newPage();
  const guest = await context.newPage();
  await fakeNotifications(host);
  await openApp(host, { online: true, clock: false });
  await openApp(guest, { online: true, clock: false });
  const code = await createGame(host, "w");
  await host.locator("#notify-offer").click();
  await expect(host.locator("#toast")).toContainText("You'll get a notification");
  await expect(host.locator("#notify-offer")).toHaveCount(0);
  await lookAway(host);
  await joinGame(guest, code);
  await expect.poll(() => host.evaluate(() => window.__shown.length)).toBe(1);
  const first = await host.evaluate(() => window.__shown[0]);
  expect(first.title).toBe("♟ Your opponent joined!");
  expect(first.body).toContain("make the first move");
  await lookAway(host, false);
  await expect.poll(() => host.evaluate(() => window.__closed)).toBeGreaterThan(0);
  // A move while away: the notification says what was played.
  await tapMove(host, "e2", "e4");
  await lookAway(host);
  await expect.poll(() => pieceOn(guest, "e4")).toBe("wp");
  await tapMove(guest, "e7", "e5");
  await expect.poll(() => host.evaluate(() => window.__shown.length)).toBe(2);
  expect((await host.evaluate(() => window.__shown[1])).body).toBe("Your opponent played e5.");
});

test("Settings shows whether notifications are allowed", async ({ page }) => {
  await fakeNotifications(page);
  await openApp(page);
  await page.locator("#settings-btn").click();
  await expect(page.locator("#notify-btn")).toHaveText("🔔 Also show a notification");
  await page.locator("#notify-btn").click();
  await expect(page.locator("#notify-btn")).toHaveText("🔔 Notifications are on");
  await expect(page.locator("#notify-btn")).toBeDisabled();
  await page.locator('[data-setting="turnAlerts"]').uncheck();
  await expect(page.locator("#notify-btn")).toBeHidden();
});

test("emoji reactions: send one, the other player sees it, and spamming waits", async ({ context }) => {
  const { host, guest } = await twoPlayers(context);
  await host.locator("#ctl-react").click();
  await expect(host.locator("#react-overlay")).toBeVisible();
  await expect(host.locator("[data-react]")).toHaveCount(6);
  await host.locator('[data-react="0"]').click();
  await expect(host.locator(".reaction-pop")).toContainText("Nice move!");
  await expect(guest.locator(".reaction-pop")).toContainText("👍");
  await expect(guest.locator(".reaction-pop")).toContainText("Nice move!");
  // Straight away again: too soon.
  await host.locator("#ctl-react").click();
  await host.locator('[data-react="1"]').click();
  await expect(host.locator("#toast")).toContainText("One moment");
  // Reopening the game doesn't replay an old reaction.
  await guest.waitForTimeout(3000);
  await expect(guest.locator(".reaction-pop")).toHaveCount(0);
  await guest.reload();
  await guest.locator("#continue-online-btn").click();
  await expect(guest.locator("#play-title")).toHaveText("Online game");
  await guest.waitForTimeout(800);
  await expect(guest.locator(".reaction-pop")).toHaveCount(0);
});

test("emoji reactions can be turned off in Settings", async ({ context }) => {
  const { host, guest } = await twoPlayers(context);
  await host.evaluate(() => document.querySelector('[data-setting="reactions"]').click());
  await tapMove(host, "e2", "e4"); // redraws the controls
  await expect(host.locator("#ctl-react")).toHaveCount(0);
  await expect.poll(() => pieceOn(guest, "e4")).toBe("wp");
  await guest.locator("#ctl-react").click();
  await guest.locator('[data-react="2"]').click();
  await expect(guest.locator(".reaction-pop")).toBeVisible();
  await host.waitForTimeout(600);
  await expect(host.locator(".reaction-pop")).toHaveCount(0);
});

test("when the opponent saves you as a friend, you're asked to add them back", async ({ context }) => {
  const { host, guest } = await twoPlayers(context);
  await guest.locator("#controls").getByRole("button", { name: /Resign/ }).click();
  await guest.locator("#confirm-ok").click();
  await host.locator("#result-overlay .overlay-close").click();
  await guest.locator("#result-overlay .overlay-close").click();
  // The guest saves the host. (Both tabs share storage, so take the friend list back off
  // afterwards: on real phones the host's own list wouldn't have it.)
  await guest.locator("#ctl-friend").click();
  await guest.locator("#friend-name").fill("Alex");
  await guest.locator("#save-friend").click();
  await expect(guest.locator("#message")).not.toContainText("saved you as a friend");
  await host.evaluate(() => localStorage.setItem("chessQuest_friends", "[]"));
  await expect(host.locator("#toast")).toContainText("Your opponent saved you as a friend");
  await host.locator("#controls").getByRole("button", { name: /Rematch/ }).count(); // redraw
  await expect.poll(() => host.locator("#message").textContent()).toContain("saved you as a friend");
  await expect(host.locator("#ctl-friend")).toHaveClass(/primary/);
  await host.locator("#ctl-friend").click();
  await host.locator("#friend-name").fill("Sam");
  await host.locator("#save-friend").click();
  await expect(host.locator("#message")).not.toContainText("saved you as a friend");
});
