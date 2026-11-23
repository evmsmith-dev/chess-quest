// "Your move!" alerts for online games while the app is in the background: another tab, another
// app, or the screen half-hidden. Everything happens on this device, so no server, no push
// tokens and nothing personal leaves the phone. Browsers pause background pages after a while
// (iPhones and iPads almost at once), so this helps most on computers and Android.
import { setting } from "../lib/settings.js";
import { play } from "./audio.js";
import { buzz } from "./haptics.js";

const BASE_TITLE = "Chess Quest";
let alerting = false;

const away = () => document.visibilityState === "hidden" || (typeof document.hasFocus === "function" && !document.hasFocus());

function setBadge(on) {
  try {
    if (on && navigator.setAppBadge) navigator.setAppBadge(1).catch(() => {});
    else if (!on && navigator.clearAppBadge) navigator.clearAppBadge().catch(() => {});
  } catch {
    // Not supported.
  }
}

/**
 * Lets the player know something needs them, if they've looked away. `text` goes in the tab
 * title, for example "Your move". Returns true if an alert was shown.
 */
export function alertPlayer(text) {
  if (!setting("turnAlerts") || !away()) return false;
  alerting = true;
  document.title = `♟ ${text}! · ${BASE_TITLE}`;
  setBadge(true);
  play("turn");
  buzz("turn");
  return true;
}

/** Puts the title and app badge back. */
export function clearAlert() {
  if (!alerting) return;
  alerting = false;
  document.title = BASE_TITLE;
  setBadge(false);
}

// Coming back to the app clears the alert.
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") clearAlert(); });
addEventListener("focus", clearAlert);
addEventListener("pageshow", () => { if (!away()) clearAlert(); });
