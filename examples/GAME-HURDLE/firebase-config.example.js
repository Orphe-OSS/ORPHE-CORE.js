// HURDLE Firebase configuration (OPTIONAL — only needed if you want
// the global ranking feature). The example is *not* loaded by the
// page; copy this file to `firebase-config.local.js` (gitignored) and
// fill in your own Firebase project credentials.
//
// Get a config object from:
//   https://console.firebase.google.com/ -> Project settings ->
//   General -> Your apps -> Firebase SDK snippet -> Config
//
// Without this file, the game still runs end-to-end; only the global
// ranking save/display is disabled (existing `currentUser` guards
// short-circuit the ranking calls).
//
// IMPORTANT: never commit `firebase-config.local.js`. The git history
// of this repository previously contained a hardcoded apiKey/projectId
// for the project `orphecorejsgamehurdle`; if you are re-using that
// project, treat those credentials as compromised and rotate / restrict
// them in the Firebase console (App Check, Firestore Security Rules,
// API key restrictions).

window.HURDLE_FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
