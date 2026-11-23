// The Firebase web app's settings for online play. Paste them from the Firebase console:
// Project settings → General → Your apps → Web app → "SDK setup and configuration" → Config.
// These values are meant to be public (they identify the project, they don't grant access);
// the database's security rules (database.rules.json) are what protect the data.
// If this is set to null, the Play online card says online play isn't set up.
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCpPxsgAr2MROhwrIcDhTpVjwQifIH6uow",
  authDomain: "chess-quest-11e67.firebaseapp.com",
  databaseURL: "https://chess-quest-11e67-default-rtdb.firebaseio.com",
  projectId: "chess-quest-11e67",
  storageBucket: "chess-quest-11e67.firebasestorage.app",
  messagingSenderId: "527246901761",
  appId: "1:527246901761:web:890c64aabc297917e3f600",
};

// App Check: proves requests come from the real Chess Quest app, not a script that copied the
// settings above. Paste the reCAPTCHA Enterprise site key here (see docs/firebase-setup.md,
// "App Check"). It's public too. While this is null, App Check is off.
export const APP_CHECK_SITE_KEY = "6LcEzywuAAAAANGxenDQ1R589J3e1hsnSYlA4stl";
// "enterprise" for a reCAPTCHA Enterprise key, or "v3" for a classic reCAPTCHA v3 key.
export const APP_CHECK_PROVIDER = "enterprise";
