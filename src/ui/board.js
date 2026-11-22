// The chessboard. Pieces move by tapping a piece and then a square, or by dragging; both go
// through the same few functions. The board knows nothing about the rules: the screen using it
// says which squares a piece may go to (getTargets) and decides what a move does (onMove).
//
// Squares are 64 buttons, so the board works with a keyboard and a screen reader (Enter on a
// piece, then Enter on a square; arrow keys move between squares). Pieces sit in their own layer
// and slide between squares; a drag lifts the piece above the finger so it stays visible.
import { buzz } from "./haptics.js";
import { setting } from "../lib/settings.js";

const FILES = "abcdefgh";
const NAMES = { k: "king", q: "queen", r: "rook", b: "bishop", n: "knight", p: "pawn" };
const DRAG_START_PX = 6;

let spriteLoaded = null;

/** Puts the piece drawings into the page once, so every piece can <use> them. */
export function loadPieceSprite(url = "vendor/pieces/standard.svg") {
  spriteLoaded ||= fetch(url)
    .then((r) => r.text())
    .then((text) => {
      const holder = document.createElement("div");
      holder.setAttribute("aria-hidden", "true");
      holder.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
      holder.innerHTML = text.replace(/<\?xml[^>]*\?>/, "");
      document.body.prepend(holder);
    })
    .catch(() => {});
  return spriteLoaded;
}

/** An <svg> drawing of a piece, e.g. pieceSvg("wn"). */
export function pieceSvg(code) {
  return `<svg viewBox="0 0 40 40" aria-hidden="true" focusable="false"><use href="#${code.toLowerCase()}"></use></svg>`;
}

export const squareName = (file, rank) => FILES[file] + (rank + 1);
export const pieceName = (code) => `${code[0] === "w" ? "white" : "black"} ${NAMES[code[1].toLowerCase()]}`;

export class Board {
  /**
   * @param {HTMLElement} el
   * @param {object} options
   *   getTargets(from) → squares the piece on `from` may move to (or [] if it can't move)
   *   onMove(from, to) → called for a legal move
   *   onIllegal(from, to) → a piece was dropped or tapped onto a square it can't go to
   *   onTap(square) → a tap that isn't part of a move (an empty square, the other side's piece)
   */
  constructor(el, { getTargets, onMove, onIllegal, onTap } = {}) {
    this.el = el;
    this.getTargets = getTargets || (() => []);
    this.onMove = onMove || (() => {});
    this.onIllegal = onIllegal || (() => {});
    this.onTap = onTap || (() => {});
    this.orientation = "w";
    this.pieces = {}; // square → "wn"
    this.pieceEls = new Map(); // square → element
    this.movable = null; // "w", "b" or null (locked)
    this.selected = null;
    this.targets = [];
    this.marks = {};
    this.drag = null;

    el.classList.add("board");
    el.setAttribute("role", "group");
    el.setAttribute("aria-label", "Chessboard");
    this.squaresEl = document.createElement("div");
    this.squaresEl.className = "squares";
    this.layer = document.createElement("div");
    this.layer.className = "pieces";
    this.layer.setAttribute("aria-hidden", "true");
    el.append(this.squaresEl, this.layer);
    this.squareEls = {};
    for (let rank = 7; rank >= 0; rank--) {
      for (let file = 0; file < 8; file++) {
        const name = squareName(file, rank);
        const button = document.createElement("button");
        button.type = "button";
        button.className = `sq ${(file + rank) % 2 ? "light" : "dark"}`;
        button.dataset.square = name;
        button.tabIndex = -1;
        this.squareEls[name] = button;
      }
    }
    this.layout();

    el.addEventListener("pointerdown", (e) => this.pointerDown(e));
    el.addEventListener("pointermove", (e) => this.pointerMove(e));
    el.addEventListener("pointerup", (e) => this.pointerUp(e));
    el.addEventListener("pointercancel", () => this.cancelDrag());
    el.addEventListener("lostpointercapture", () => { if (this.drag?.dragging) this.cancelDrag(); });
    el.addEventListener("contextmenu", (e) => e.preventDefault());
    // Keyboard: Enter/Space activate a square (a pointer tap is handled on pointerdown instead).
    el.addEventListener("click", (e) => {
      const square = e.target.closest?.("[data-square]")?.dataset.square;
      if (square && e.detail === 0) this.tap(square, { keyboard: true });
    });
    el.addEventListener("keydown", (e) => this.keyDown(e));
  }

  /** Places the square buttons for the current orientation. */
  layout() {
    this.squaresEl.replaceChildren();
    const ranks = this.orientation === "w" ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
    const files = this.orientation === "w" ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
    ranks.forEach((rank, row) => files.forEach((file, col) => {
      const button = this.squareEls[squareName(file, rank)];
      button.querySelectorAll(".coord").forEach((c) => c.remove());
      if (col === 0) button.insertAdjacentHTML("beforeend", `<span class="coord coord-rank" aria-hidden="true">${rank + 1}</span>`);
      if (row === 7) button.insertAdjacentHTML("beforeend", `<span class="coord coord-file" aria-hidden="true">${FILES[file]}</span>`);
      this.squaresEl.append(button);
    }));
    const focusable = this.squareEls[this.focusSquare || (this.orientation === "w" ? "e2" : "e7")];
    for (const b of Object.values(this.squareEls)) b.tabIndex = b === focusable ? 0 : -1;
    this.focusSquare = focusable.dataset.square;
    for (const [square, pieceEl] of this.pieceEls) this.placeEl(pieceEl, square);
  }

  setOrientation(color) {
    if (color === this.orientation) return;
    this.orientation = color;
    this.layout();
  }

  /** Grid position of a square for this orientation: [col, row] from the top left. */
  coords(square) {
    const file = FILES.indexOf(square[0]);
    const rank = Number(square[1]) - 1;
    return this.orientation === "w" ? [file, 7 - rank] : [7 - file, rank];
  }

  placeEl(pieceEl, square) {
    const [x, y] = this.coords(square);
    pieceEl.style.setProperty("--x", x);
    pieceEl.style.setProperty("--y", y);
  }

  makePieceEl(code) {
    const pieceEl = document.createElement("div");
    pieceEl.className = "piece";
    pieceEl.dataset.piece = code;
    pieceEl.innerHTML = pieceSvg(code);
    return pieceEl;
  }

  /**
   * Shows a position: { e1: "wk", … }. `moves` lists [from, to] pairs that just happened, so
   * those pieces slide instead of jumping (a castling move lists the king and the rook).
   */
  setPieces(pieces, { moves = [], animate = true } = {}) {
    this.layer.classList.toggle("no-anim", !animate);
    const next = new Map();
    const old = new Map(this.pieceEls);
    for (const [from, to] of moves) {
      const pieceEl = old.get(from);
      if (!pieceEl || !pieces[to]) continue;
      old.delete(from);
      const captured = old.get(to);
      if (captured) { old.delete(to); this.removeEl(captured, animate); }
      if (pieceEl.dataset.piece !== pieces[to]) pieceEl.innerHTML = pieceSvg((pieceEl.dataset.piece = pieces[to]));
      this.placeEl(pieceEl, to);
      next.set(to, pieceEl);
    }
    for (const [square, code] of Object.entries(pieces)) {
      if (next.has(square)) continue;
      const existing = old.get(square);
      if (existing && existing.dataset.piece === code) {
        old.delete(square);
        next.set(square, existing);
        continue;
      }
      const pieceEl = this.makePieceEl(code);
      this.placeEl(pieceEl, square);
      if (animate && existing) pieceEl.classList.add("appear");
      this.layer.append(pieceEl);
      next.set(square, pieceEl);
    }
    for (const pieceEl of old.values()) this.removeEl(pieceEl, animate);
    this.pieceEls = next;
    this.pieces = { ...pieces };
    if (this.selected && !pieces[this.selected]) this.deselect();
    this.updateLabels();
    // Let the layout settle before transitions come back on.
    if (!animate) requestAnimationFrame(() => this.layer.classList.remove("no-anim"));
  }

  removeEl(pieceEl, animate) {
    if (!animate) { pieceEl.remove(); return; }
    pieceEl.classList.add("leaving");
    setTimeout(() => pieceEl.remove(), 220);
  }

  updateLabels() {
    for (const [square, button] of Object.entries(this.squareEls)) {
      const code = this.pieces[square];
      const extra = this.marks[square]?.label;
      button.setAttribute("aria-label", `${square}${code ? `, ${pieceName(code)}` : ""}${extra ? `, ${extra}` : ""}`);
    }
  }

  /** Who may move pieces: "w", "b", or null to lock the board. */
  setMovable(color) {
    this.movable = color;
    this.el.classList.toggle("is-locked", !color);
    if (!color) { this.cancelDrag(); this.deselect(); }
  }

  /**
   * Highlights: { lastMove: [from, to], check: square, hint: [squares], stars: [squares],
   * good: square, bad: square }. Anything left out is cleared.
   */
  setHighlights({ lastMove = [], check = null, hint = [], stars = [], good = null, bad = null } = {}) {
    for (const [square, button] of Object.entries(this.squareEls)) {
      button.classList.toggle("is-last", lastMove.includes(square));
      button.classList.toggle("is-check", square === check);
      button.classList.toggle("is-hint", hint.includes(square));
      button.classList.toggle("has-star", stars.includes(square));
      button.classList.toggle("is-good", square === good);
      button.classList.toggle("is-bad", square === bad);
    }
    this.marks = Object.fromEntries(stars.map((s) => [s, { label: "star" }]));
    this.updateLabels();
  }

  // ---------- Selecting and moving ----------

  canPick(square) {
    const code = this.pieces[square];
    return Boolean(this.movable && code && code[0] === this.movable);
  }

  select(square) {
    this.deselect();
    this.selected = square;
    this.targets = this.getTargets(square) || [];
    this.squareEls[square].classList.add("is-selected");
    const dots = setting("legalDots");
    for (const t of this.targets) {
      const button = this.squareEls[t];
      button.classList.add(this.pieces[t] ? "is-capture" : "is-target");
      button.classList.toggle("dots-off", !dots);
    }
    buzz("tap");
  }

  deselect() {
    if (!this.selected) return;
    this.squareEls[this.selected]?.classList.remove("is-selected");
    for (const t of this.targets) this.squareEls[t].classList.remove("is-target", "is-capture", "dots-off");
    this.selected = null;
    this.targets = [];
  }

  tryMove(from, to) {
    if (this.targets.includes(to)) {
      this.deselect();
      this.onMove(from, to);
      return true;
    }
    return false;
  }

  /** A tap (or keyboard press) on a square. Returns what happened. */
  tap(square, { keyboard = false } = {}) {
    if (this.selected) {
      if (square === this.selected) { this.deselect(); return "deselect"; }
      if (this.tryMove(this.selected, square)) return "move";
      if (this.canPick(square)) { this.select(square); return "select"; }
      const from = this.selected;
      this.deselect();
      this.onIllegal(from, square);
      return "illegal";
    }
    if (this.canPick(square)) {
      this.select(square);
      return "select";
    }
    this.onTap(square, { keyboard });
    return "tap";
  }

  squareAt(clientX, clientY) {
    const rect = this.squaresEl.getBoundingClientRect();
    const col = Math.floor(((clientX - rect.left) / rect.width) * 8);
    const row = Math.floor(((clientY - rect.top) / rect.height) * 8);
    if (col < 0 || col > 7 || row < 0 || row > 7) return null;
    const file = this.orientation === "w" ? col : 7 - col;
    const rank = this.orientation === "w" ? 7 - row : row;
    return squareName(file, rank);
  }

  pointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    const square = this.squareAt(e.clientX, e.clientY);
    if (!square) return;
    e.preventDefault(); // no text selection, no focus ring flash, no page scroll from the board
    this.squareEls[square].focus({ preventScroll: true });
    this.setFocus(square);
    const wasSelected = this.selected === square;
    if (this.selected && !wasSelected && !this.canPick(square)) {
      this.tap(square); // a move to a target, or an illegal tap
      return;
    }
    if (!this.canPick(square)) {
      this.tap(square);
      return;
    }
    if (!wasSelected) this.select(square);
    this.drag = { from: square, x: e.clientX, y: e.clientY, dragging: false, wasSelected, pointerId: e.pointerId, touch: e.pointerType === "touch" };
    try { this.el.setPointerCapture(e.pointerId); } catch { /* old browsers */ }
  }

  pointerMove(e) {
    const drag = this.drag;
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (!drag.dragging) {
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < DRAG_START_PX) return;
      drag.dragging = true;
      drag.el = this.pieceEls.get(drag.from);
      drag.el?.classList.add("is-dragging");
      this.el.classList.add("is-dragging");
    }
    e.preventDefault();
    const rect = this.squaresEl.getBoundingClientRect();
    const size = rect.width / 8;
    // On a touch screen the piece rides above the finger so it can be seen.
    const lift = drag.touch ? size * 0.55 : 0;
    if (drag.el) {
      drag.el.style.transform = `translate(${e.clientX - rect.left - size / 2}px, ${e.clientY - rect.top - size / 2 - lift}px) scale(${drag.touch ? 1.25 : 1.1})`;
    }
    const over = this.squareAt(e.clientX, e.clientY - lift);
    if (over !== drag.over) {
      if (drag.over) this.squareEls[drag.over].classList.remove("is-hover");
      drag.over = over;
      if (over) this.squareEls[over].classList.add("is-hover");
    }
  }

  pointerUp(e) {
    const drag = this.drag;
    if (!drag || e.pointerId !== drag.pointerId) return;
    this.drag = null;
    if (!drag.dragging) {
      if (drag.wasSelected) this.deselect(); // a second tap on a picked-up piece puts it down
      return;
    }
    const lift = drag.touch ? (this.squaresEl.getBoundingClientRect().width / 8) * 0.55 : 0;
    const to = drag.over ?? this.squareAt(e.clientX, e.clientY - lift);
    this.endDragVisuals(drag);
    if (!to || to === drag.from) return; // dropped back or off the board: stays picked up
    if (this.tryMove(drag.from, to)) return;
    const from = drag.from;
    this.deselect();
    this.onIllegal(from, to);
  }

  endDragVisuals(drag) {
    if (drag.over) this.squareEls[drag.over]?.classList.remove("is-hover");
    if (drag.el) {
      drag.el.classList.remove("is-dragging");
      drag.el.style.transform = "";
    }
    this.el.classList.remove("is-dragging");
  }

  cancelDrag() {
    if (!this.drag) return;
    if (this.drag.dragging) this.endDragVisuals(this.drag);
    this.drag = null;
  }

  // ---------- Keyboard ----------

  setFocus(square) {
    if (this.focusSquare) this.squareEls[this.focusSquare].tabIndex = -1;
    this.focusSquare = square;
    this.squareEls[square].tabIndex = 0;
  }

  keyDown(e) {
    const square = e.target.closest?.("[data-square]")?.dataset.square;
    if (!square) return;
    const steps = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    const step = steps[e.key];
    if (!step) {
      if (e.key === "Escape" && this.selected) { this.deselect(); e.stopPropagation(); }
      return;
    }
    e.preventDefault();
    const [x, y] = this.coords(square);
    const nx = Math.min(7, Math.max(0, x + step[0]));
    const ny = Math.min(7, Math.max(0, y + step[1]));
    const target = Object.keys(this.squareEls).find((s) => { const [cx, cy] = this.coords(s); return cx === nx && cy === ny; });
    this.setFocus(target);
    this.squareEls[target].focus();
  }

  /** A short shake when a move is wrong. */
  shake() {
    this.el.classList.remove("shake");
    void this.el.offsetWidth;
    this.el.classList.add("shake");
  }
}
