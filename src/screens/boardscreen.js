// The board screen is shared by games, lessons and puzzles. This module owns the Board and the
// parts around it (title, player bars, message, move list, buttons), and each mode plugs in its
// own handlers with useMode().
import { Board, pieceSvg } from "../ui/board.js";
import { openOverlay, closeTop, isOpen } from "../ui/overlays.js";
import { setting } from "../lib/settings.js";
import { play } from "../ui/audio.js";
import { buzz } from "../ui/haptics.js";

const byId = (id) => document.getElementById(id);
let mode = null;

export const board = new Board(byId("board"), {
  getTargets: (from) => mode?.getTargets?.(from) || [],
  onMove: (from, to) => mode?.onMove?.(from, to),
  onIllegal: (from, to) => mode?.onIllegal?.(from, to),
  onTap: (square) => mode?.onTap?.(square),
});

/** Makes `handlers` the active mode: { getTargets, onMove, onIllegal, onTap, leave }. */
export function useMode(handlers) {
  if (mode && mode !== handlers) mode.leave?.();
  mode = handlers;
  const screen = byId("play");
  screen.classList.remove("no-board");
  byId("coach").hidden = true;
  byId("offer").hidden = true;
  byId("task-dots").hidden = true;
  byId("move-list").hidden = true;
  setBars(null, null);
  setMessage("");
  setControls([]);
  board.setHighlights();
}

export const activeMode = () => mode;
export function leaveMode(handlers) {
  if (mode === handlers) { mode.leave?.(); mode = null; }
}

export function setTitle(title, sub = "") {
  byId("play-title").textContent = title;
  byId("play-sub").textContent = sub;
}

/** The message box under the board. `tone` is "", "good", "bad" or "info". */
export function setMessage(html, tone = "") {
  const el = byId("message");
  el.innerHTML = html;
  el.className = `message${tone ? ` is-${tone}` : ""}`;
  el.hidden = !html;
}

/** Buttons below the message: [{ label, id?, onClick, kind?, disabled? }]. */
export function setControls(buttons) {
  const el = byId("controls");
  el.replaceChildren(...buttons.map((b) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `control${b.kind ? ` is-${b.kind}` : ""}`;
    button.innerHTML = b.label;
    if (b.id) button.id = b.id;
    if (b.ariaLabel) button.setAttribute("aria-label", b.ariaLabel);
    button.disabled = Boolean(b.disabled);
    button.addEventListener("click", b.onClick);
    return button;
  }));
}

export function setControlDisabled(id, disabled) {
  const el = byId(id);
  if (el) el.disabled = disabled;
}

/** The bars above and below the board: { name, emoji, captured: ["q", …], color, plus, status }. */
export function setBars(top, bottom) {
  for (const [id, info] of [["bar-top", top], ["bar-bottom", bottom]]) {
    const el = byId(id);
    el.hidden = !info;
    if (!info) { el.replaceChildren(); continue; }
    const captured = (info.captured || []).map((t) => `<span class="cap">${pieceSvg((info.color === "w" ? "b" : "w") + t)}</span>`).join("");
    el.innerHTML = `<span class="bar-avatar" aria-hidden="true">${info.emoji || ""}</span>`
      + `<span class="bar-name">${info.name}</span>`
      + `<span class="bar-caps" aria-label="Captured pieces">${captured}${info.plus ? `<span class="bar-plus">+${info.plus}</span>` : ""}</span>`
      + `<span class="bar-status">${info.status || ""}</span>`;
  }
}

/** Shows the moves so far (SAN), numbered, scrolled to the end. */
export function setMoveList(sans, startsWithBlack = false, firstNumber = 1) {
  const el = byId("move-list");
  el.hidden = false;
  const items = [];
  let n = firstNumber;
  let i = 0;
  if (startsWithBlack && sans.length) { items.push(`<li><span class="mv-n">${n}.</span><span class="mv">…</span><span class="mv">${sans[0]}</span></li>`); i = 1; n++; }
  for (; i < sans.length; i += 2, n++) {
    const last = i + 1 >= sans.length ? i : i + 1;
    items.push(`<li><span class="mv-n">${n}.</span><span class="mv${i === sans.length - 1 ? " is-last" : ""}">${sans[i]}</span>${sans[i + 1] ? `<span class="mv${last === sans.length - 1 ? " is-last" : ""}">${sans[i + 1]}</span>` : ""}</li>`);
  }
  el.innerHTML = items.join("") || '<li class="mv-empty">No moves yet</li>';
  el.scrollLeft = el.scrollWidth;
  el.scrollTop = el.scrollHeight;
}

export function hideBoard(hidden = true) {
  byId("play").classList.toggle("no-board", hidden);
}

/** Sound and vibration for a chess.js move. */
export function feelMove(move, inCheck) {
  if (inCheck) { play("check"); buzz("check"); }
  else if (move.promotion) { play("promote"); buzz("land"); }
  else if (move.flags.includes("k") || move.flags.includes("q")) { play("castle"); buzz("land"); }
  else if (move.captured) { play("capture"); buzz("capture"); }
  else { play("move"); buzz("land"); }
}

/**
 * Asks which piece a pawn promotes to. Resolves "q", "r", "b" or "n", or null if the pop-up was
 * dismissed (the pawn goes back). Skipped when "Always promote to a queen" is on.
 */
export function choosePromotion(color) {
  if (setting("autoQueen")) return Promise.resolve("q");
  return new Promise((resolve) => {
    let chosen = null;
    const options = byId("promotion-options");
    options.innerHTML = ["q", "r", "b", "n"].map((t) => `<button type="button" class="promo-btn" data-promo="${t}" aria-label="${{ q: "Queen", r: "Rook", b: "Bishop", n: "Knight" }[t]}">${pieceSvg(color + t)}<span>${{ q: "Queen", r: "Rook", b: "Bishop", n: "Knight" }[t]}</span></button>`).join("");
    options.onclick = (e) => {
      const b = e.target.closest("[data-promo]");
      if (!b) return;
      chosen = b.dataset.promo;
      closeTop();
    };
    openOverlay("promotion-overlay", { onClose: () => resolve(chosen) });
  });
}

/** True if moving the piece on `from` to `to` is a pawn reaching the last row. */
export function isPromotionMove(pieces, from, to) {
  const code = pieces[from];
  return code?.[1] === "p" && (to[1] === "8" || to[1] === "1");
}

/**
 * The result pop-up: { emoji, title, text, stats: [[label, value]], primary: [label, fn],
 * secondary: [label, fn], onClose }.
 */
export function showResult({ emoji, title, text, stats = [], primary, secondary, onClose }) {
  byId("result-emoji").textContent = emoji;
  byId("result-title").textContent = title;
  byId("result-text").textContent = text || "";
  byId("result-stats").innerHTML = stats.map(([label, value]) => `<div class="result-stat"><span>${label}</span><strong>${value}</strong></div>`).join("");
  byId("result-stats").hidden = !stats.length;
  let action = null;
  const wire = (id, spec) => {
    const button = byId(id);
    button.hidden = !spec;
    if (!spec) return;
    button.textContent = spec[0];
    button.onclick = () => { action = spec[1]; closeTop(); };
  };
  wire("result-primary", primary);
  wire("result-secondary", secondary);
  if (isOpen("result-overlay")) return;
  openOverlay("result-overlay", {
    focus: "#result-primary",
    onClose: () => {
      // Run the chosen action after the pop-up's history step has settled.
      const run = action;
      setTimeout(() => (run ? run() : onClose?.()), 0);
    },
  });
}

/** A static picture of a position, for the Rulebook and Tip Cards. */
export function miniBoard(fen, highlight = []) {
  const rows = fen.split(" ")[0].split("/");
  let html = '<div class="mini-board" role="img" aria-label="Example position">';
  rows.forEach((row, r) => {
    let f = 0;
    const cells = [];
    for (const ch of row) {
      if (/\d/.test(ch)) { for (let k = 0; k < Number(ch); k++) cells.push(null); }
      else cells.push((ch === ch.toLowerCase() ? "b" : "w") + ch.toLowerCase());
    }
    for (const code of cells) {
      const square = "abcdefgh"[f] + (8 - r);
      const light = (f + (7 - r)) % 2 === 1;
      html += `<div class="mini-sq ${light ? "light" : "dark"}${highlight.includes(square) ? " is-hint" : ""}">${code ? pieceSvg(code) : ""}</div>`;
      f++;
    }
  });
  return html + "</div>";
}

/** Little dots showing progress through a lesson's tasks. */
export function setTaskDots(total, current, done = []) {
  const el = byId("task-dots");
  el.hidden = total <= 1;
  el.innerHTML = Array.from({ length: total }, (_, i) => `<span class="dot${done[i] ? " is-done" : ""}${i === current ? " is-current" : ""}"></span>`).join("");
  el.setAttribute("aria-label", `Task ${current + 1} of ${total}`);
}
