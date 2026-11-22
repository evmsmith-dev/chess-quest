// Screens and pop-ups work with the phone's Back gesture. Every screen and pop-up adds a history
// entry recording how many screens and pop-ups are open; every way of closing goes through
// history (back or go), and popstate makes the app match the entry it lands on. That keeps Back,
// the ← buttons, ✕ buttons, Escape and taps outside a pop-up all in step, even when several steps
// are undone at once (closing a result pop-up straight to Home, say).
//
// Every pop-up can be dismissed: its ✕ and backdrop carry data-close, and Escape and Back close the
// top one. A pop-up's onClose runs however it was closed.
const overlays = []; // open pop-up ids, top last
const closeHandlers = new Map();
const screens = [{ id: "home", onLeave: null }]; // bottom is always Home
const screenListeners = new Set();

export const isOpen = (id) => overlays.includes(id);
export const anyOpen = () => overlays.length > 0;
export const currentScreen = () => screens[screens.length - 1].id;

function state() {
  return { screens: screens.length, overlays: overlays.length };
}

function show(id) {
  for (const el of document.querySelectorAll("main.screen")) el.hidden = el.id !== id;
  window.scrollTo(0, 0);
  for (const listener of screenListeners) listener(id);
}

/** Calls `listener(screenId)` whenever a screen comes into view. */
export const onScreenShown = (listener) => screenListeners.add(listener);

/** Shows a screen on top of the current one. Back returns; `onLeave` runs when it's left. */
export function openScreen(id, { onLeave } = {}) {
  screens.push({ id, onLeave });
  show(id);
  history.pushState(state(), "");
}

/** Swaps the top screen for another (no new history entry). */
export function replaceScreen(id, { onLeave } = {}) {
  const top = screens.pop();
  top?.onLeave?.();
  screens.push({ id, onLeave });
  show(id);
}

export function openOverlay(id, { onClose, focus } = {}) {
  const overlay = document.getElementById(id);
  if (!overlay || isOpen(id)) return;
  overlays.push(id);
  if (onClose) closeHandlers.set(id, onClose);
  else closeHandlers.delete(id);
  overlay.hidden = false;
  history.pushState(state(), "");
  const target = (focus && overlay.querySelector(focus)) || overlay.querySelector(".overlay-card button:not(.overlay-close), .overlay-card [href]") || overlay.querySelector("button");
  target?.focus({ preventScroll: true });
}

/** Closes the top pop-up. */
export function closeTop() {
  if (overlays.length) history.back();
}

const afterClose = [];
/**
 * Closes the top pop-up, then runs `fn` once the history step has really happened. Opening a
 * screen or another pop-up straight after history.back() would race with it on a slow phone.
 */
export function closeTopThen(fn) {
  if (!overlays.length) { fn(); return; }
  afterClose.push(fn);
  history.back();
}

/** Goes back one step (top pop-up, or else the top screen). */
export function goBack() {
  if (overlays.length || screens.length > 1) history.back();
}

/** Closes every pop-up and screen, back to Home. `then` runs once Home is showing. */
export function backToHome(then) {
  const steps = overlays.length + screens.length - 1;
  if (then) { if (steps) afterClose.push(then); else then(); }
  if (steps) history.go(-steps);
}

/** Closes pop-ups and screens down to (and showing) the screen `id`, if it's open. */
export function backTo(id) {
  const index = screens.map((s) => s.id).lastIndexOf(id);
  if (index < 0) return;
  const steps = overlays.length + screens.length - 1 - index;
  if (steps) history.go(-steps);
}

function hideTopOverlay() {
  const id = overlays.pop();
  const overlay = document.getElementById(id);
  if (overlay) overlay.hidden = true;
  const handler = closeHandlers.get(id);
  closeHandlers.delete(id);
  handler?.();
}

export function initOverlays() {
  history.replaceState(state(), "");
  addEventListener("popstate", (event) => {
    const target = event.state || { screens: 1, overlays: 0 };
    while (overlays.length > (screens.length > target.screens ? 0 : target.overlays)) hideTopOverlay();
    let changed = false;
    while (screens.length > Math.max(1, target.screens)) {
      screens.pop().onLeave?.();
      changed = true;
    }
    if (changed) show(currentScreen());
    while (overlays.length > target.overlays) hideTopOverlay();
    const next = afterClose.shift();
    if (next) setTimeout(next, 0);
  });
  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-close]") && overlays.length) closeTop();
    else if (event.target.closest("[data-back]")) goBack();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && overlays.length) closeTop();
  });
}
