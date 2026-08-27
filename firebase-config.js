/* =============================================================
   FIREBASE CONFIG  —  shared cloud storage for the scouting site
   -------------------------------------------------------------
   Collections used:
     reports      — match scout reports    (created by any @stuypulse.com user)
     assignments  — match+team handed to one scout (admins write, everyone reads)
     users        — everyone who has signed in (fills the "Assign to" dropdown)
     pit      — pit scouting w/ photos     (created/updated by any @stuypulse.com user)
     admins   — emails with Admin access   (managed on admin.html; louis.lee@stuypulse.com is always admin)

   ONE-TIME SETUP for login + locked-down data (~5 minutes):
   1. console.firebase.google.com → your project → Build → Authentication
      → "Get started" → Sign-in method → enable **Google** → Save.
   2. Authentication → Settings → Authorized domains → Add domain:
        wowlouis0721.github.io        (localhost is already allowed for testing)
   3. Build → Firestore Database → Rules → replace everything with the block
      below and press Publish. This is what actually enforces
      "@stuypulse.com only" — the login screen alone is not enough.

        rules_version = '2';
        service cloud.firestore {
          match /databases/{database}/documents {
            function team() {
              return request.auth != null
                && request.auth.token.email is string
                && request.auth.token.email.lower().matches('.*@stuypulse[.]com');
            }
            function admin() {
              return team() && (
                request.auth.token.email.lower() == 'louis.lee@stuypulse.com'
                || exists(/databases/$(database)/documents/admins/$(request.auth.token.email.lower()))
              );
            }
            match /reports/{id} {
              allow read, create: if team();
              allow update, delete: if admin();
            }
            match /pit/{id} {
              allow read, create, update: if team();
              allow delete: if admin();
            }
            match /admins/{email} {
              allow read: if team();
              allow create, update, delete: if admin();
            }
            match /users/{email} {
              allow read: if team();
              allow create, update: if team()
                && request.auth.token.email.lower() == email;
              allow delete: if admin();
            }
            match /assignments/{id} {
              allow read: if team();
              allow create, update, delete: if admin();
            }
          }
        }

   Note on "Slack login": a pure GitHub Pages site has no server, and
   Slack's OAuth requires a server-held secret — so sign-in here uses the
   team's @stuypulse.com Google accounts (the same emails as the Slack
   workspace) and hard-rejects every other domain. If you ever want the
   literal "Sign in with Slack" button, upgrade Firebase Auth to
   Identity Platform and add Slack as a custom OIDC provider — no page
   code here needs to change beyond the provider id.
   ============================================================= */
const firebaseConfig = {
  apiKey: "AIzaSyB1T3I01Yrd-UvhuP470DTEZ24o635a13k",
  authDomain: "scouting-21dc4.firebaseapp.com",
  projectId: "scouting-21dc4",
  storageBucket: "scouting-21dc4.firebasestorage.app",
  messagingSenderId: "807747305531",
  appId: "1:807747305531:web:087e0e6d4c2c670f811c1e",
  measurementId: "G-ZJVV351MFF"
};
/* ---- Do not edit below this line ---- */
let db = null;
try {
  if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "PASTE_YOUR_API_KEY") {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    window.db = db;
  } else {
    console.warn("[scouting] Firebase not configured yet — edit firebase-config.js.");
  }
} catch (e) {
  console.error("[scouting] Firebase init failed:", e);
}
