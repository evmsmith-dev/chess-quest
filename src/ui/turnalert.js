// "Your move!" alerts for online games while the app is in the background: another tab, another
// app, or the screen half-hidden. Everything happens on this device, so no server, no push
// tokens and nothing personal leaves the phone. Browsers pause background pages after a while
// (iPhones and iPads almost at once), so this helps most on computers and Android.
//
// On a phone, an app in the background can't vibrate, has no visible title and (on Android) no
// icon badge, so the alert that actually gets noticed is a notification. If the player allowed
// notifications, one is shown by this device itself while the app is still running: there's no
// push server, so it only works for a few minutes after the app is put in the background.
import { setting } from "../lib/settings.js";
import { play } from "./audio.js";
import { buzz } from "./haptics.js";

const BASE_TITLE = "Chess Quest";
const TAG = "chess-quest-alert";
let alerting = false;

/** True if this browser can show notifications from the app. */
export const notificationsSupported = () => typeof Notification !== "undefined" && "serviceWorker" in navigator;
/** "default" (not asked yet), "granted", "denied", or "unsupported". */
export const notificationPermission = () => (notificationsSupported() ? Notification.permission : "unsupported");

/** Asks to show notifications. Call from a tap. Resolves to the new permission. */
export async function enableNotifications() {
  if (!notificationsSupported()) return "unsupported";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

async function notify(title, body) {
  if (notificationPermission() !== "granted") return;
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, { body, tag: TAG, renotify: true, icon: new URL("icons/icon-192.png", location.href).href, badge: new URL("icons/icon-96.png", location.href).href, data: { url: location.href } });
  } catch {
    // No service worker (or blocked): the other alerts still happen.
  }
}

async function clearNotifications() {
  if (!notificationsSupported()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    for (const n of (await reg?.getNotifications({ tag: TAG })) || []) n.close();
  } catch {
    // Nothing to clear.
  }
}

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
 * title and the notification, for example "Your move"; `body` is the notification's detail.
 * Returns true if an alert was shown.
 */
export function alertPlayer(text, body = "Tap to open your game.") {
  if (!setting("turnAlerts") || !away()) return false;
  alerting = true;
  document.title = `♟ ${text}! · ${BASE_TITLE}`;
  setBadge(true);
  play("turn");
  buzz("turn");
  notify(`♟ ${text}!`, body);
  return true;
}

/** Puts the title and app badge back. */
export function clearAlert() {
  if (!alerting) return;
  alerting = false;
  document.title = BASE_TITLE;
  setBadge(false);
  clearNotifications();
}

// Coming back to the app clears the alert.
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") clearAlert(); });
addEventListener("focus", clearAlert);
addEventListener("pageshow", () => { if (!away()) clearAlert(); });
