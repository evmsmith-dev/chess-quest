import { expect } from "@playwright/test";

export const TODAY = "2026-11-22";

/** Opens the app on a fixed date, with optional saved data (keys without the chessQuest_ prefix). */
export async function openApp(page, { storage = {}, online = true, clock = true, path = "index.html", backend = "local", askBotStart = false } = {}) {
  // The one-time "How much chess have you played?" question is answered (skipped) unless a test
  // is about it.
  if (!askBotStart) storage = { botStart: "skipped", ...storage };
  // Tests never touch the real Firebase project: they use the local backend, where tabs in one
  // browser play each other ("off" pretends Firebase isn't set up).
  void online;
  await page.addInitScript((backend) => { window.__CHESS_BACKEND = backend; }, backend);
  await page.addInitScript(({ storage }) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    for (const [key, value] of Object.entries(storage)) localStorage.setItem(`chessQuest_${key}`, JSON.stringify(value));
  }, { storage });
  if (clock) await page.clock.install({ time: new Date(`${TODAY}T10:00:00`) });
  await page.goto(path);
  await expect(page.locator("body.is-ready")).toBeAttached();
}

export const square = (page, name) => page.locator(`#board [data-square="${name}"]`);

/** Tap a piece, then a square. */
export async function tapMove(page, from, to) {
  await square(page, from).click();
  await square(page, to).click();
}

/** Drag a piece from one square to another. */
export async function dragMove(page, from, to) {
  const a = await square(page, from).boundingBox();
  const b = await square(page, to).boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2 + 10, { steps: 2 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 6 });
  await page.mouse.up();
}

export const pieceOn = (page, name) => page.locator(`#board .piece`).evaluateAll((els, name) => {
  const board = document.querySelector("#board .squares").getBoundingClientRect();
  const target = document.querySelector(`#board [data-square="${name}"]`).getBoundingClientRect();
  const el = els.find((e) => { const r = e.getBoundingClientRect(); return Math.abs(r.x - target.x) < 3 && Math.abs(r.y - target.y) < 3 && !e.classList.contains("leaving"); });
  void board;
  return el?.dataset.piece || null;
}, name);
