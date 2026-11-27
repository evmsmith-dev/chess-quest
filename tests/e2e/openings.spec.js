// The Opening plans unit and the opening bosses.
import { test, expect } from "@playwright/test";
import { Position, Searcher, uciString } from "../../src/chess/engine.js";
import { openApp, tapMove } from "./helpers.js";

test("the Italian Game lesson: Nf3, Bc4, a quiz, then d4", async ({ page }) => {
  await openApp(page, { clock: false });
  await page.locator("#learn-btn").click();
  await page.locator('[data-lesson="italian"]').click();
  await page.locator("#tip-overlay .primary").click();
  await tapMove(page, "g1", "f3");
  await expect(page.locator("#message")).toContainText("Nf3 develops a piece and attacks e5");
  await page.locator("#ctl-next").click();
  await tapMove(page, "f1", "b5");
  await expect(page.locator("#message")).toContainText("Ruy Lopez");
  await expect(page.locator('#board [data-square="f1"] .piece, #board .piece[data-piece="wb"]').first()).toBeVisible();
  await page.waitForTimeout(1200); // the wrong move is taken back
  await tapMove(page, "f1", "c4");
  await expect(page.locator("#message")).toContainText("that's the Italian Game!");
  await page.locator("#ctl-next").click();
  await page.getByRole("button", { name: /Only the king protects f7/ }).click();
  await page.locator("#ctl-next").click();
  await tapMove(page, "d2", "d4");
  await expect(page.locator("#message")).toContainText("White owns the center");
});

test("Legal's mate: take on e5 through the pin, check, then mate", async ({ page }) => {
  await openApp(page, { clock: false });
  await page.locator("#learn-btn").click();
  await page.locator('[data-lesson="traps-2"]').click();
  await page.locator("#tip-overlay .primary").click();
  await tapMove(page, "f3", "e5");
  await page.locator("#ctl-next").click();
  await tapMove(page, "c4", "f7");
  await page.locator("#ctl-next").click();
  await tapMove(page, "c3", "d5");
  await expect(page.locator("#message")).toContainText("Legal's mate");
});

/** The board as a FEN with `turn` to move; castling allowed while king and rooks are home. */
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
  const at = (sq) => placed[sq]?.toLowerCase();
  const rights = (at("e1") === "wk" && at("h1") === "wr" ? "K" : "") + (at("e1") === "wk" && at("a1") === "wr" ? "Q" : "");
  return `${rows.join("/")} ${turn} ${rights || "-"} - 0 1`;
}

test("opening boss: 10 moves as White, a report card, and stars in Challenges", async ({ page }) => {
  test.setTimeout(150000);
  await openApp(page, { clock: false });
  await page.locator("#challenges-btn").click();
  await expect(page.locator(".tier-title", { hasText: "Opening bosses" })).toBeVisible();
  await page.locator('[data-boss="boss-opening-white"]').click();
  await page.locator("#tip-overlay .primary").click();
  await expect(page.locator("#play-title")).toContainText("Opening as White");
  await expect(page.locator("#message")).toContainText("Moves played: 0 of 10");
  const searcher = new Searcher();
  const message = page.locator("#message");
  for (let i = 0; i < 10 && !(await page.locator("#result-overlay").isVisible()); i++) {
    // The engine plays for the player, castling when the squares are clear (if that's legal).
    const fen = await boardFen(page, "w");
    const castle = /K/.test(fen.split(" ")[2]) && !fen.split(" ")[0].split("/")[7].slice(-3).match(/[NB]/) && fen.split(" ")[0].endsWith("K2R") ? "e1g1" : null;
    const uci = castle || uciString(searcher.bestMove(new Position(fen), { depth: 4, timeMs: 1500 }).move);
    await tapMove(page, uci.slice(0, 2), uci.slice(2, 4));
    if (uci[4]) await page.locator('[data-promo="q"]').click();
    await expect.poll(async () => (await page.locator("#result-overlay").isVisible()) || (await message.textContent()).includes(`Moves played: ${i + 1} of 10`) && !(await page.locator("#board").getAttribute("class")).includes("thinking"), { timeout: 15000 }).toBe(true);
    await page.waitForTimeout(450);
  }
  await expect(page.locator("#result-overlay")).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".result-checks li")).toHaveCount(4);
  await expect(page.locator(".result-checks")).toContainText("Castled"); // (whether it counts is a unit test)
  const passed = await page.locator(".result-checks li.is-ok").count();
  await page.locator("#result-primary").click();
  if (passed >= 2) await expect(page.locator('[data-boss="boss-opening-white"]')).toContainText(`Best: ${passed} of 4 checks`);
});
