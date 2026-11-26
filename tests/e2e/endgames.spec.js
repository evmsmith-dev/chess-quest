// The endgame lessons and bosses, played out against the app's bot with the engine choosing the
// player's moves (so these check the goals work end to end, not the player's skill).
import { test, expect } from "@playwright/test";
import { Position, Searcher, uciString } from "../../src/chess/engine.js";
import { openApp, tapMove } from "./helpers.js";

const searcher = new Searcher();

/** The position on the board as a FEN, with `turn` to move (no castling or en passant here). */
async function boardFen(page, turn) {
  const placed = await page.evaluate(() => {
    const out = {};
    const squares = [...document.querySelectorAll("#board [data-square]")].map((el) => [el.dataset.square, el.getBoundingClientRect()]);
    for (const el of document.querySelectorAll("#board .piece")) {
      if (el.classList.contains("leaving")) continue;
      const r = el.getBoundingClientRect();
      const hit = squares.find(([, s]) => Math.abs(s.x - r.x) < 3 && Math.abs(s.y - r.y) < 3);
      if (hit) out[hit[0]] = el.dataset.piece;
    }
    return out;
  });
  const rows = [];
  for (let rank = 8; rank >= 1; rank--) {
    let row = "";
    let empty = 0;
    for (const file of "abcdefgh") {
      const p = placed[file + rank];
      if (!p) { empty++; continue; }
      if (empty) { row += empty; empty = 0; }
      row += p[0] === "w" ? p[1].toUpperCase() : p[1];
    }
    rows.push(row + (empty || ""));
  }
  return `${rows.join("/")} ${turn} - - 0 1`;
}

/** Plays the engine's moves for `color` until the task says ✅ (or gives up after `limit`). */
async function playOut(page, color, limit = 40, depth = 8) {
  const message = page.locator("#message");
  for (let i = 0; i < limit; i++) {
    if ((await message.textContent()).includes("✅")) return;
    const fen = await boardFen(page, color);
    const best = searcher.bestMove(new Position(fen), { depth, timeMs: 4000 }).move;
    const uci = uciString(best);
    await tapMove(page, uci.slice(0, 2), uci.slice(2, 4));
    if (uci[4]) await page.locator('[data-promo="q"]').click();
    // Wait for the bot's reply (the position changes again) or the end of the task.
    await expect.poll(async () => (await message.textContent()).includes("✅") || (await message.textContent()).includes("❌") || (await boardFen(page, color)) !== fen, { timeout: 10000 }).toBe(true);
    await expect.poll(async () => {
      const text = await message.textContent();
      if (text.includes("✅") || text.includes("❌")) return true;
      return !(await page.locator("#board").getAttribute("class")).includes("thinking") && (await boardFen(page, color)) !== fen;
    }, { timeout: 10000 }).toBe(true);
    await page.waitForTimeout(500);
    expect(await message.textContent()).not.toContain("❌");
  }
}

test("square rule: catch the pawn (hold), then race to promote", async ({ page }) => {
  test.setTimeout(120000);
  await openApp(page, { clock: false });
  await page.locator("#learn-btn").click();
  await page.locator('[data-lesson="square-rule"]').click();
  await page.locator("#tip-overlay .primary").click();
  await page.getByRole("button", { name: "Yes: the king is already in the square" }).click();
  await page.locator("#ctl-next").click();
  await expect(page.locator("#message")).toContainText("Moves held: 0 of 8");
  await playOut(page, "b", 10);
  await expect(page.locator("#message")).toContainText("✅");
  await page.locator("#ctl-next").click();
  await playOut(page, "w", 8);
  await expect(page.locator("#message")).toContainText("Promoted!");
});

test("a boss: win the pawn race, earn stars, and see them in Challenges", async ({ page }) => {
  test.setTimeout(120000);
  await openApp(page, { clock: false });
  await page.locator("#challenges-btn").click();
  await expect(page.locator('[data-boss="boss-race"]')).toContainText("☆☆☆");
  await page.locator('[data-boss="boss-race"]').click();
  await expect(page.locator("#tip-overlay")).toBeVisible();
  await page.locator("#tip-overlay .primary").click();
  await expect(page.locator("#play-title")).toContainText("Pawn race");
  await playOut(page, "w", 6);
  await expect(page.locator("#result-title")).toHaveText("Boss beaten!");
  // The engine playing for the player sometimes takes a move more than the fastest win, so 2 or 3
  // stars; the card must show the same stars and the best move count.
  const text = await page.locator("#result-text").textContent();
  const stars = text.match(/^⭐+/)[0];
  const moves = Number(text.match(/Promoted in (\d+) moves/)[1]);
  expect(stars.length).toBe(moves <= 4 ? 3 : 2);
  await page.locator("#result-primary").click();
  await expect(page.locator('[data-boss="boss-race"]')).toContainText(stars);
  await expect(page.locator('[data-boss="boss-race"]')).toContainText(`Best: ${moves} moves`);
});

test("opposition: promote with the king's help, then hold the draw as Black", async ({ page }) => {
  test.setTimeout(180000);
  await openApp(page, { clock: false });
  await page.locator("#learn-btn").click();
  await page.locator('[data-lesson="opposition"]').click();
  await page.locator("#tip-overlay .primary").click();
  await page.getByRole("button", { name: "White: Black has to move and give way" }).click();
  await page.locator("#ctl-next").click();
  await playOut(page, "w", 10);
  await expect(page.locator("#message")).toContainText("Promoted!");
  await page.locator("#ctl-next").click();
  await playOut(page, "b", 13, 16);
  await expect(page.locator("#message")).toContainText("✅");
});

test("boss: King leads the way can be won", async ({ page }) => {
  test.setTimeout(180000);
  await openApp(page, { clock: false });
  await page.locator("#challenges-btn").click();
  await page.locator('[data-boss="boss-king-leads"]').click();
  await page.locator("#tip-overlay .primary").click();
  await playOut(page, "w", 14);
  await expect(page.locator("#result-title")).toHaveText("Boss beaten!");
});
