// Vibration. Android browsers support timed patterns. iPhones don't support web vibration at
// all; on iOS 18 and later, toggling a hidden switch control during a tap makes one light system
// tick, so the lighter events use that. It's an undocumented side effect, so nothing relies on it.
import { setting } from "../lib/settings.js";

// Milliseconds, or [on, off, on, …].
const PATTERNS = {
  tap: 8, // picking up a piece
  land: 12, // a move lands
  capture: 20,
  wrong: [15, 50, 15],
  win: [20, 60, 40],
  lose: 70,
  check: [10, 40, 10],
};
const IPHONE_TICKS = new Set(["tap", "land", "capture", "win"]);

let iphoneSwitch = null;

const canPattern = () => typeof navigator.vibrate === "function";

function iphoneTickSupported() {
  const probe = document.createElement("input");
  probe.type = "checkbox";
  return "switch" in probe && /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 0;
}

/** True if this device can vibrate in some way (the Vibration setting is shown only then). */
export const hapticsAvailable = () => canPattern() || iphoneTickSupported();

function iphoneTick() {
  if (!iphoneSwitch) {
    iphoneSwitch = document.createElement("label");
    iphoneSwitch.setAttribute("aria-hidden", "true");
    iphoneSwitch.style.cssText = "position:fixed;left:-100px;top:0;width:1px;height:1px;opacity:0;pointer-events:none";
    iphoneSwitch.innerHTML = '<input type="checkbox" switch tabindex="-1">';
    document.body.append(iphoneSwitch);
  }
  iphoneSwitch.click();
}

/** Plays the feel for an event (see PATTERNS), if vibration is on. */
export function buzz(kind) {
  if (!setting("vibration") || !(kind in PATTERNS)) return;
  try {
    if (canPattern()) navigator.vibrate(PATTERNS[kind]);
    else if (IPHONE_TICKS.has(kind) && iphoneTickSupported()) iphoneTick();
  } catch {
    // Not supported.
  }
}
