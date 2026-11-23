import { test, expect } from "@playwright/test";
import { openApp, square, tapMove, dragMove, pieceOn } from "./helpers.js";

async function startGame(page, { level = "beginner", color = "w" } = {}) {
  await page.locator("#new-game-btn").click();
  await page.locator(`#level-options [data-level="${level}"]`).click();
  await page.locator(`#color-options [data-color="${color}"]`).click();
  await page.locator("#start-game-btn").click();
  await expect(page.locator("#play")).toBeVisible();
}

test("home shows every mode and the daily puzzle", async ({ page }) => {
  await openApp(page);
  await expect(page.locator("#daily-status")).toContainText("Today:");
  await expect(page.locator("#learn-summary")).toHaveText("0 of 23 lessons");
  await expect(page.locator("#challenge-summary")).toContainText("solved");
});

test("a move by tapping, then the bot replies", async ({ page }) => {
  await openApp(page);
  await startGame(page);
  await square(page, "e2").click();
  await expect(square(page, "e4")).toHaveClass(/is-target/);
  await square(page, "e4").click();
  await expect.poll(() => pieceOn(page, "e4")).toBe("wp");
  // The bot (Black) answers.
  await page.clock.runFor(3000);
  await expect(page.locator("#move-list li").first()).toContainText(/e4\s*\S+/, { timeout: 10000 });
  await expect(page.locator("#message")).toContainText("Your move");
});

test("a move by dragging", async ({ page }) => {
  await openApp(page);
  await startGame(page);
  await dragMove(page, "g1", "f3");
  await expect.poll(() => pieceOn(page, "f3")).toBe("wn");
  await expect(page.locator("#move-list")).toContainText("Nf3");
});

test("an illegal move is explained and the piece stays", async ({ page }) => {
  await openApp(page);
  await startGame(page);
  await tapMove(page, "e2", "e5");
  await expect(page.locator("#message")).toContainText("Pawns move straight ahead");
  await expect.poll(() => pieceOn(page, "e2")).toBe("wp");
});

test("playing Black: the bot moves first and the board is flipped", async ({ page }) => {
  await openApp(page);
  await startGame(page, { color: "b" });
  await page.clock.runFor(3000);
  await expect(page.locator("#move-list li").first()).not.toContainText("No moves", { timeout: 10000 });
  const a8 = await square(page, "a8").boundingBox();
  const a1 = await square(page, "a1").boundingBox();
  expect(a8.y).toBeGreaterThan(a1.y);
});

test("undo takes back your move and the reply", async ({ page }) => {
  await openApp(page);
  await startGame(page);
  await tapMove(page, "d2", "d4");
  await page.clock.runFor(3000);
  await expect(page.locator("#message")).toContainText("Your move", { timeout: 10000 });
  await page.locator("#ctl-undo").click();
  await expect(page.locator("#move-list")).toContainText("No moves");
  await expect.poll(() => pieceOn(page, "d2")).toBe("wp");
});

test("an unfinished game can be continued from Home", async ({ page }) => {
  await openApp(page, { storage: { current: { level: "intermediate", color: "w", coach: false, undo: false, hints: false, moves: ["e2e4", "e7e5"] } } });
  await expect(page.locator("#continue-btn")).toBeVisible();
  await page.locator("#continue-btn").click();
  await expect(page.locator("#play-title")).toHaveText("Intermediate bot");
  await expect(page.locator("#move-list")).toContainText("e5");
  await expect(page.locator("#ctl-undo")).toHaveCount(0);
});

test("the coach warns before a piece is left hanging", async ({ page }) => {
  // After 1.e4 d5, Qg4 puts the queen where the c8 bishop can take it.
  await openApp(page, { storage: { current: { level: "beginner", color: "w", coach: true, undo: true, hints: true, moves: ["e2e4", "d7d5"] } } });
  await page.locator("#continue-btn").click();
  await tapMove(page, "d1", "g4");
  await expect(page.locator("#coach")).toBeVisible();
  await expect(page.locator("#coach-text")).toContainText("queen on g4");
  await page.locator("#coach-undo").click();
  await expect.poll(() => pieceOn(page, "d1")).toBe("wq");
});

test("promotion: the picker can be dismissed, then used", async ({ page }) => {
  await openApp(page, { storage: { current: { level: "beginner", color: "w", coach: false, undo: true, hints: true, moves: ["a2a4", "b7b5", "a4b5", "a7a6", "b5a6", "c8b7", "a6b7", "h7h6"] } } });
  await page.locator("#continue-btn").click();
  await tapMove(page, "b7", "a8");
  await expect(page.locator("#promotion-overlay")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#promotion-overlay")).toBeHidden();
  await expect.poll(() => pieceOn(page, "b7")).toBe("wp");
  await tapMove(page, "b7", "a8");
  await page.locator('[data-promo="n"]').click();
  await expect.poll(() => pieceOn(page, "a8")).toBe("wn");
});

test("a star lesson can be completed", async ({ page }) => {
  await openApp(page);
  await page.locator("#learn-btn").click();
  await page.locator('[data-lesson="rook"]').click();
  await expect(page.locator("#tip-overlay")).toBeVisible();
  await page.locator("#tip-overlay .primary").click();
  // Task 1: rook a1 → a8 → h8 → h1.
  await tapMove(page, "a1", "a8");
  await tapMove(page, "a8", "h8");
  await tapMove(page, "h8", "h1");
  await expect(page.locator("#message")).toContainText("fewest possible");
  await page.locator("#ctl-next").click();
  // Task 2: around the pawns.
  for (const [a, b] of [["d4", "d1"], ["d1", "a1"], ["a1", "a4"], ["a4", "a8"], ["a8", "d8"]]) await tapMove(page, a, b);
  await expect(page.locator("#message")).toContainText("All stars");
  await page.locator("#ctl-next").click();
  await tapMove(page, "a1", "a6");
  await tapMove(page, "a6", "f6");
  await page.locator("#ctl-next").click();
  await expect(page.locator("#result-overlay")).toBeVisible();
  await expect(page.locator("#result-title")).toHaveText("Lesson complete!");
  await page.locator("#result-secondary").click();
  await expect(page.locator("#learn")).toBeVisible();
  await expect(page.locator('[data-lesson="rook"]')).toHaveClass(/is-done/);
});

test("a move task: a wrong move is explained, the right one passes", async ({ page }) => {
  await openApp(page);
  await page.locator("#learn-btn").click();
  await page.locator('[data-lesson="free-pieces"]').click();
  await page.locator("#tip-overlay .overlay-close").click();
  await tapMove(page, "c3", "d5");
  await expect(page.locator("#message")).toContainText("protected by the pawn on e6");
  await page.clock.runFor(1200);
  await expect.poll(() => pieceOn(page, "c3")).toBe("wn");
  await tapMove(page, "c3", "a4");
  await expect(page.locator("#message")).toContainText("free 3 points");
});

test("a quiz task", async ({ page }) => {
  await openApp(page);
  await page.locator("#learn-btn").click();
  await page.locator('[data-lesson="values"]').click();
  await page.locator("#tip-overlay .primary").click();
  await page.getByRole("button", { name: "The knight and pawn (4)" }).click();
  await expect(page.locator("#message")).toContainText("Not quite");
  await page.getByRole("button", { name: "The rook (5)" }).click();
  await expect(page.locator("#message")).toContainText("3 + 1 = 4");
});

test("a challenge puzzle can be solved", async ({ page }) => {
  await openApp(page);
  const puzzles = await page.evaluate(() => fetch("data/puzzles.json").then((r) => r.json()));
  const first = puzzles.mate1[0];
  await page.locator("#challenges-btn").click();
  await page.locator('[data-set="mate1"]').click();
  const uci = first.line[0];
  await tapMove(page, uci.slice(0, 2), uci.slice(2, 4));
  if (uci[4]) await page.locator(`[data-promo="${uci[4]}"]`).click();
  await expect(page.locator("#message")).toContainText("checkmate");
  await expect(page.locator("#ctl-next")).toBeVisible();
});

test("the rulebook can be searched", async ({ page }) => {
  await openApp(page);
  await page.locator("#rules-btn").click();
  await page.locator("#rules-search").fill("passant");
  await expect(page.locator(".rule-card:visible")).toHaveCount(1);
  await expect(page.locator(".rule-card:visible h4")).toHaveText("En passant");
  await page.locator("#rules-search").fill("zzzz");
  await expect(page.locator("#rules-empty")).toBeVisible();
});

test("the Back gesture leaves screens in order", async ({ page }) => {
  await openApp(page);
  await page.locator("#learn-btn").click();
  await page.locator('[data-lesson="board"]').click();
  await expect(page.locator("#tip-overlay")).toBeVisible();
  await page.goBack();
  await expect(page.locator("#tip-overlay")).toBeHidden();
  await expect(page.locator("#play")).toBeVisible();
  await page.goBack();
  await expect(page.locator("#learn")).toBeVisible();
  await page.goBack();
  await expect(page.locator("#home")).toBeVisible();
});

test("en passant lesson shows the other side's move first", async ({ page }) => {
  await openApp(page);
  await page.locator("#learn-btn").click();
  await page.locator('[data-lesson="en-passant"]').click();
  await page.locator("#tip-overlay .primary").click();
  await page.clock.runFor(1000);
  await expect.poll(() => pieceOn(page, "d5")).toBe("bp");
  await tapMove(page, "e5", "d6");
  await expect(page.locator("#message")).toContainText("En passant!");
  await expect.poll(() => pieceOn(page, "d5")).toBe(null);
});

test("a play-out lesson: the bot defends", async ({ page }) => {
  await openApp(page);
  await page.locator("#learn-btn").click();
  await page.locator('[data-lesson="queen-mate"]').click();
  await page.locator("#tip-overlay .primary").click();
  await tapMove(page, "a1", "a4");
  await page.clock.runFor(3000);
  await expect(page.locator("#message")).toContainText("Moves used: 1 of 20", { timeout: 10000 });
  await expect(page.locator("#board")).not.toHaveClass(/is-locked/);
});

test("the daily puzzle counts toward the streak", async ({ page }) => {
  await openApp(page);
  await page.locator("#daily-btn").click();
  await expect(page.locator("#play-title")).toHaveText("Daily puzzle");
  // Solve it by following the hints: the second hint names the square.
  for (let step = 0; step < 3; step++) {
    if (await page.locator("#result-overlay").isVisible()) break;
    await page.locator("#ctl-hint").click();
    await page.locator("#ctl-hint").click();
    const text = await page.locator("#message").textContent();
    const m = text.match(/from (\w\d) to (\w\d)/);
    await tapMove(page, m[1], m[2]);
    if (await page.locator("#promotion-overlay").isVisible()) await page.locator('[data-promo="q"]').click();
    await page.clock.runFor(1500);
  }
  await expect(page.locator("#result-title")).toHaveText("Daily puzzle solved!");
  await page.locator("#result-primary").click();
  await expect(page.locator("#daily-streak")).toContainText("1-day streak");
});

async function startFriendGame(page, { w = "Ana", b = "Ben", autoFlip = true } = {}) {
  await page.locator("#friend-btn").click();
  await page.locator("#name-w").fill(w);
  await page.locator("#name-b").fill(b);
  if (!autoFlip) await page.locator("#opt-autoflip").uncheck();
  await page.locator("#start-friend-btn").click();
  await expect(page.locator("#play-title")).toHaveText("Two players");
}

test("two players: turns alternate and the board turns to face each player", async ({ page }) => {
  await openApp(page);
  await startFriendGame(page);
  await expect(page.locator("#message")).toContainText("Ana (White) moves first");
  // Black's pieces can't move on White's turn.
  await tapMove(page, "e7", "e5");
  await expect.poll(() => pieceOn(page, "e7")).toBe("bp");
  await tapMove(page, "e2", "e4");
  await expect(page.locator("#message")).toContainText("Ben (Black) to move");
  await page.clock.runFor(1000);
  // The board now faces Black: a8 is at the bottom.
  const a8 = await square(page, "a8").boundingBox();
  const a1 = await square(page, "a1").boundingBox();
  expect(a8.y).toBeGreaterThan(a1.y);
  await expect(page.locator("#bar-bottom")).toContainText("Ben");
  await dragMove(page, "e7", "e5");
  await expect(page.locator("#move-list")).toContainText("e5");
  await expect(page.locator("#message")).toContainText("Ana (White) to move");
});

test("two players: undo takes back one move", async ({ page }) => {
  await openApp(page);
  await startFriendGame(page, { autoFlip: false });
  await tapMove(page, "d2", "d4");
  await tapMove(page, "d7", "d5");
  await page.locator("#ctl-undo").click();
  await expect.poll(() => pieceOn(page, "d7")).toBe("bp");
  await expect.poll(() => pieceOn(page, "d4")).toBe("wp");
  await expect(page.locator("#message")).toContainText("Ben (Black) to move");
});

test("two players: checkmate names the winner, and the game is saved meanwhile", async ({ page }) => {
  await openApp(page);
  await startFriendGame(page, { autoFlip: false });
  await tapMove(page, "f2", "f3");
  await tapMove(page, "e7", "e5");
  // Leave and come back: the game continues from Home.
  await page.goBack();
  await expect(page.locator("#continue-friend-btn")).toContainText("Ana vs Ben");
  await page.locator("#continue-friend-btn").click();
  await tapMove(page, "g2", "g4");
  await tapMove(page, "d8", "h4");
  await page.clock.runFor(1000);
  await expect(page.locator("#result-title")).toHaveText("Ben wins!");
  await expect(page.locator("#result-text")).toContainText("Ben checkmated Ana");
  await page.locator("#result-primary").click(); // rematch: sides swap
  await expect(page.locator("#play-sub")).toHaveText("Ben vs Ana");
});

test("two players: a draw offer is answered by the other player", async ({ page }) => {
  await openApp(page);
  await startFriendGame(page, { autoFlip: false });
  await page.getByRole("button", { name: "Game menu" }).click();
  await page.locator("#menu-draw").click();
  await expect(page.locator("#confirm-title")).toHaveText("Ben, accept a draw?");
  await page.locator("#confirm-ok").click();
  await page.clock.runFor(1000);
  await expect(page.locator("#result-title")).toHaveText("Draw");
});

test("a bot game and a two-player game are saved separately", async ({ page }) => {
  await openApp(page, { storage: { current: { level: "beginner", color: "w", coach: true, undo: true, hints: true, moves: ["e2e4", "e7e5"] } } });
  await startFriendGame(page);
  await tapMove(page, "d2", "d4");
  await page.goBack();
  await expect(page.locator("#continue-btn")).toBeVisible();
  await expect(page.locator("#continue-friend-btn")).toBeVisible();
});

test("the built page has a Content Security Policy and nothing breaks it", async ({ page, context }) => {
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  await openApp(page);
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content");
  expect(csp).toContain("object-src 'none'");
  // Visit everything: a game, a lesson, a puzzle, the rulebook, settings and an online game.
  await page.locator("#new-game-btn").click();
  await page.locator("#start-game-btn").click();
  await tapMove(page, "e2", "e4");
  await page.clock.runFor(3000);
  await page.goBack();
  await page.locator("#learn-btn").click();
  await page.locator('[data-lesson="board"]').click();
  await page.locator("#tip-overlay .primary").click();
  await page.goBack();
  await page.goBack();
  await page.locator("#challenges-btn").click();
  await page.locator('[data-set="mate1"]').click();
  await page.goBack();
  await page.goBack();
  await page.locator("#rules-btn").click();
  await page.goBack();
  await page.locator("#settings-btn").click();
  await page.keyboard.press("Escape");
  await page.locator("#online-btn").click();
  await page.locator("#online-create").click();
  await expect(page.locator(".game-code")).toBeVisible();
  expect(await page.evaluate(() => window.__csp)).toEqual([]);
  void context;
});

test("game review finds a hung queen and lets you try a better move", async ({ page }) => {
  await openApp(page, { storage: { current: { level: "beginner", color: "w", coach: false, undo: false, hints: false, moves: ["e2e4", "d7d5", "d1g4"] } } });
  await page.locator("#continue-btn").click();
  await page.clock.runFor(3000);
  await page.getByRole("button", { name: "Game menu" }).click();
  await page.locator("#menu-resign").click();
  await page.locator("#confirm-ok").click();
  await page.clock.runFor(1500);
  await page.locator("#result-secondary").click(); // Review game
  await expect(page.locator("#play-title")).toHaveText("Game review");
  await page.clock.runFor(20000);
  await expect(page.locator("#message")).toContainText("queen on g4", { timeout: 20000 });
  await expect(page.locator(".moment-chip").first()).toContainText("Move 2");
  // Try the same bad move again, then ask to be shown.
  await page.locator("#ctl-try").click();
  await tapMove(page, "d1", "g4");
  await expect(page.locator("#message")).toContainText("isn't better");
  await page.locator("#ctl-show").click();
  await expect(page.locator("#message")).toContainText("Better:");
  // Back returns to the finished game.
  await page.goBack();
  await expect(page.locator("#play-title")).toHaveText("Beginner bot");
  await expect(page.locator("#ctl-review")).toBeVisible();
});

test("two-player review covers both sides and finds the allowed mate", async ({ page }) => {
  await openApp(page);
  await page.locator("#friend-btn").click();
  await page.locator("#name-w").fill("Ana");
  await page.locator("#name-b").fill("Ben");
  await page.locator("#opt-autoflip").uncheck();
  await page.locator("#start-friend-btn").click();
  for (const [a, b] of [["f2", "f3"], ["e7", "e5"], ["g2", "g4"], ["d8", "h4"]]) await tapMove(page, a, b);
  await page.clock.runFor(1500);
  await page.locator("#result-secondary").click();
  await page.clock.runFor(20000);
  await expect(page.locator("#message")).toContainText("Allowed checkmate", { timeout: 20000 });
  await expect(page.locator("#message")).toContainText("Ana played g4");
  await expect(page.locator("#message")).toContainText("This let Ben force checkmate");
  await page.locator("#ctl-try").click();
  await tapMove(page, "e2", "e4");
  await expect(page.locator("#message")).toContainText(/That's it|works too/);
});

test("a game with no big mistakes says so", async ({ page }) => {
  await openApp(page);
  await page.locator("#friend-btn").click();
  await page.locator("#start-friend-btn").click();
  await page.getByRole("button", { name: "Game menu" }).click();
  await page.locator("#menu-resign").click();
  await page.locator("#confirm-ok").click();
  await page.clock.runFor(1500);
  await page.locator("#result-secondary").click();
  await expect(page.locator("#message")).toContainText("No big mistakes");
});

test("the privacy page opens from Settings and closing it returns to Settings", async ({ page }) => {
  await openApp(page);
  await page.locator("#settings-btn").click();
  await page.locator("#privacy-btn").click();
  await expect(page.locator("#privacy-overlay")).toContainText("Games are deleted after 7 days");
  await expect(page.locator("#privacy-overlay")).toContainText("protected by reCAPTCHA");
  await page.keyboard.press("Escape");
  await expect(page.locator("#privacy-overlay")).toBeHidden();
  await expect(page.locator("#settings-overlay")).toBeVisible();
});

test("Share Chess Quest opens the share sheet with the website link", async ({ page }) => {
  await page.addInitScript(() => {
    window.__shared = null;
    navigator.share = async (data) => { window.__shared = data; };
  });
  await openApp(page);
  await page.locator("#settings-btn").click();
  await page.locator("#share-app-btn").click();
  const shared = await page.evaluate(() => window.__shared);
  expect(shared.title).toBe("Chess Quest");
  expect(shared.url).toBe(new URL("./", page.url()).href);
  expect(shared.url).not.toContain("index.html");
});

test("without a share sheet, the link is copied", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript(() => { delete Navigator.prototype.share; });
  await openApp(page);
  await page.locator("#settings-btn").click();
  await page.locator("#share-app-btn").click();
  await expect(page.locator("#toast")).toContainText("Link copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(new URL("./", page.url()).href);
});

test("Home points new players at Learn, and the three ways to play share one card", async ({ page }) => {
  await openApp(page);
  await expect(page.locator("#start-here")).toBeVisible();
  await expect(page.locator("#learn-card")).toHaveClass(/is-featured/);
  for (const id of ["#new-game-btn", "#friend-btn", "#online-btn"]) await expect(page.locator(`.play-card ${id}`)).toBeVisible();
  await expect(page.locator("#rules-btn")).toContainText("Rulebook");
});

test("returning players see their record, not Start here", async ({ page }) => {
  await openApp(page, { storage: { lessons: { board: { stars: 3 } }, games: { beginner: { w: 2, l: 1, d: 0 } } } });
  await expect(page.locator("#start-here")).toBeHidden();
  await expect(page.locator("#play-summary")).toContainText("2W 1L 0D");
});

test("pop-up buttons stay on screen even when the pop-up has to scroll", async ({ page }) => {
  await openApp(page);
  for (const [open, button] of [
    [async () => page.locator("#new-game-btn").click(), "#start-game-btn"],
    [async () => { await page.locator("#learn-btn").click(); await page.locator('[data-lesson="knight"]').click(); }, "#tip-overlay .primary"],
  ]) {
    await open();
    const box = await page.locator(button).boundingBox();
    const viewport = page.viewportSize();
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    expect(box.y).toBeGreaterThanOrEqual(0);
    // And it's really the button at that spot (not covered by anything).
    const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest("button")?.textContent, [box.x + box.width / 2, box.y + box.height / 2]);
    expect(hit).toBe(await page.locator(button).textContent());
    await page.keyboard.press("Escape");
    await page.goto("index.html");
  }
});

test("after collecting the stars the long way, Restart is offered", async ({ page }) => {
  await openApp(page);
  await page.locator("#learn-btn").click();
  await page.locator('[data-lesson="king"]').click();
  await page.locator("#tip-overlay .primary").click();
  // Task 1 in the fewest moves: no Restart needed.
  for (const [a, b] of [["e1", "e2"], ["e2", "e3"], ["e3", "f3"], ["f3", "g3"]]) await tapMove(page, a, b);
  await expect(page.locator("#message")).toContainText("the fewest possible");
  await expect(page.locator("#ctl-restart")).toHaveCount(0);
  await page.locator("#ctl-next").click();
  // Task 2 (your screenshot): around the bishop the long way, four moves instead of three.
  for (const [a, b] of [["e3", "d3"], ["d3", "d4"], ["d4", "d5"], ["d5", "e6"]]) await tapMove(page, a, b);
  await expect(page.locator("#message")).toContainText("It can be done in 3");
  await expect(page.locator("#ctl-restart")).toBeVisible();
  await page.locator("#ctl-restart").click();
  await expect(page.locator("#message")).toContainText("Moves: 0");
  await expect.poll(() => pieceOn(page, "e3")).toBe("wk");
  await expect(page.locator("#ctl-next")).toHaveCount(0);
});
