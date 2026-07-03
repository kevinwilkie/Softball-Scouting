/* ---------------------------------------------------------------------------
   Firebase configuration for shared, multi-coach mode.

   HOW TO FILL THIS IN (one-time, ~10 min):
   1. Go to console.firebase.google.com → Add project (free "Spark" plan is fine).
   2. Build → Authentication → Get started → enable "Google" as a sign-in provider.
   3. Build → Firestore Database → Create database → Start in production mode.
   4. Project settings (gear) → Your apps → Web app (</>) → register → copy the
      firebaseConfig values into the object below.
   5. Add every coach's email to ALLOWED_EMAILS below AND to firestore.rules,
      then deploy the rules (see firestore.rules).

   NOTE: The apiKey here is NOT a secret — Firebase web keys are meant to be
   public. Access is controlled by Google sign-in + the allowlist in the
   security rules. Until real values are pasted below, the app runs exactly as
   it does today: local-only, no sign-in, data stays on each device.
--------------------------------------------------------------------------- */

window.FIREBASE_CONFIG = {
  apiKey: "PASTE_API_KEY",
  authDomain: "PASTE_PROJECT.firebaseapp.com",
  projectId: "PASTE_PROJECT_ID",
  storageBucket: "PASTE_PROJECT.appspot.com",
  messagingSenderId: "PASTE_SENDER_ID",
  appId: "PASTE_APP_ID"
};

// Coaches allowed to sign in (must also be listed in firestore.rules).
window.ALLOWED_EMAILS = [
  // "headcoach@example.com",
  // "assistant@example.com",
];
