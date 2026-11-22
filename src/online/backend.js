// Picks the online backend: Firebase when it's configured, or the local test backend when the
// browser tests ask for it (window.__CHESS_BACKEND = "local"). Returns null when online play
// isn't available.
import { FIREBASE_CONFIG } from "./config.js";

let pending = null;

export const onlineConfigured = () => Boolean(FIREBASE_CONFIG) || window.__CHESS_BACKEND === "local";

export function getBackend() {
  pending ||= (async () => {
    if (window.__CHESS_BACKEND === "local") {
      const { createLocalBackend } = await import("./local-backend.js");
      return createLocalBackend();
    }
    if (!FIREBASE_CONFIG) return null;
    const { createFirebaseBackend } = await import("./firebase-backend.js");
    return createFirebaseBackend(FIREBASE_CONFIG);
  })().catch((error) => {
    pending = null; // let the next attempt try again (e.g. after coming back online)
    throw error;
  });
  return pending;
}
