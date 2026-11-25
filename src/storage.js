// Everything is saved in this browser's localStorage. Reads never throw: private browsing or
// blocked storage just means progress isn't kept.
const PREFIX = "chessQuest_";

export const KEYS = {
  stats: "stats",
  daily: "daily",
  current: "current",
  theme: "theme",
  helpSeen: "helpSeen",
};

export function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeJson(key, value) {
  try {
    if (value === null || value === undefined) localStorage.removeItem(PREFIX + key);
    else {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
      if (PROGRESS.has(key)) keepData();
    }
  } catch {
    // Storage full or blocked: the game still works, it just isn't saved.
  }
}

// Progress worth protecting: saving any of these asks the browser to keep the app's data.
const PROGRESS = new Set(["lessons", "puzzles", "puzzlesClean", "stats", "daily", "drillBest"]);
const ASK_AGAIN_MS = 24 * 60 * 60 * 1000;
let askedThisVisit = false;

/**
 * Asks the browser not to clear this app's data when the device runs low on space ("persistent
 * storage"). Chrome and Safari decide quietly (more likely once the app is installed or used
 * often); Firefox asks the player. It's asked after progress is saved, not on first load, so the
 * question makes sense, and at most once a day until it's granted.
 */
function keepData() {
  if (askedThisVisit) return;
  askedThisVisit = true;
  try {
    const storage = navigator.storage;
    if (!storage?.persist || !storage.persisted) return;
    const last = Number(localStorage.getItem(PREFIX + "persistAsked")) || 0;
    if (Date.now() - last < ASK_AGAIN_MS) return;
    storage.persisted().then((kept) => {
      if (kept) return;
      localStorage.setItem(PREFIX + "persistAsked", String(Date.now()));
      return storage.persist();
    }).catch(() => {});
  } catch {
    // Not supported: nothing to do.
  }
}
