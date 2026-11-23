// Whether online play can reach the internet right now, from two sources: the phone's own
// network status (navigator.onLine and its online/offline events) and, once online play has
// connected at least once, Firebase's live connection (.info/connected). The second catches a
// connection that dropped while the phone still claims to be online (a dead Wi-Fi, a tunnel).
const listeners = new Set();
let firebaseSeen = false; // has the backend ever reported a live connection?
let firebaseConnected = true;
let last = null;

export const isOffline = () => !navigator.onLine || (firebaseSeen && !firebaseConnected);

function changed() {
  const now = isOffline();
  if (now === last) return;
  last = now;
  for (const listener of listeners) listener(now);
}

/** Calls `listener(offline)` now and whenever being offline changes. Returns a stop function. */
export function onConnectionChange(listener) {
  listeners.add(listener);
  listener(isOffline());
  return () => listeners.delete(listener);
}

/** The backend reports its own connection (true/false) here. */
export function reportBackendConnection(connected) {
  if (connected) firebaseSeen = true;
  firebaseConnected = connected;
  changed();
}

addEventListener("online", changed);
addEventListener("offline", changed);
last = isOffline();

/** Rejects with Error("timeout") if `promise` takes longer than `ms`. */
export function withTimeout(promise, ms = 10000) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("timeout")), ms); }),
  ]).finally(() => clearTimeout(timer));
}
