// Player settings, saved on this device. Anything missing falls back to the defaults, so new
// settings added in an update just work.
import { readJson, writeJson } from "../storage.js";

export const DEFAULT_SETTINGS = {
  sound: true,
  vibration: true,
  coach: true, // Coach Knightly in Tip Cards, badge banners and the badge wall
  badgePopups: true, // a banner when a badge is earned (badges are earned either way)
  reactions: true, // online games: send and see emoji reactions
  turnAlerts: true, // online games: sound, vibration and a badge when it's your move and you've looked away
  legalDots: true, // dots on the squares the picked-up piece can go to
  coordinates: true,
  autoQueen: false, // skip the promotion choice
  dragMoves: true, // pieces can be dragged as well as tapped
  largeText: false,
  board: "green", // "green", "blue" or "wood"
};

let current = { ...DEFAULT_SETTINGS, ...readJson("settings", {}) };
const listeners = new Set();

export const getSettings = () => current;
export const setting = (name) => current[name];

export function updateSettings(changes) {
  current = { ...current, ...changes };
  writeJson("settings", current);
  for (const listener of listeners) listener(current, changes);
}

/** Calls `listener(settings, changes)` after every change. */
export function onSettingsChange(listener) {
  listeners.add(listener);
}
