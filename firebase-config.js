/* =============================================================
   FIREBASE CONFIG  —  shared cloud storage for the scouting site
   -------------------------------------------------------------
   This is what makes reports show up for EVERYONE instead of
   only in the browser of the person who typed them.

   SETUP (do this once — takes ~5 minutes):

   1. Go to https://console.firebase.google.com and sign in with
      any Google account. Click "Add project", give it a name
      (e.g. "694-scouting"), and finish. You can skip Google
      Analytics.

   2. In the left sidebar open  Build → Firestore Database  →
      "Create database". Choose a location, then start in
      "test mode" for now (we tighten this in step 5).

   3. Back on the project overview, click the  </>  (web) icon to
      "Add app to get started". Register the app (nickname is
      fine, you do NOT need Firebase Hosting). Firebase will show
      you a config object that looks like the one below.

   4. Copy YOUR values over the placeholder ones below and save
      this file. (apiKey here is a public identifier, not a
      secret — it is safe to commit to GitHub.)

   5. In Firestore, open the "Rules" tab and paste this so anyone
      on your team can read + write scouting reports:

        rules_version = '2';
        service cloud.firestore {
          match /databases/{database}/documents {
            match /reports/{doc} {
              allow read, write: if true;
            }
          }
        }

      Click "Publish". (This makes the reports collection openly
      readable/writable, which is fine for a scouting app. If you
      later want to lock it down, that's where you'd do it.)

   That's it. Upload this file plus the 5 HTML pages to your repo.
   ============================================================= */

const firebaseConfig = {
  apiKey: "PASTE_YOUR_API_KEY",
  authDomain: "PASTE_YOUR_PROJECT.firebaseapp.com",
  projectId: "PASTE_YOUR_PROJECT_ID",
  storageBucket: "PASTE_YOUR_PROJECT.appspot.com",
  messagingSenderId: "PASTE_YOUR_SENDER_ID",
  appId: "PASTE_YOUR_APP_ID"
};

/* ---- Do not edit below this line ---- */
let db = null;
try {
  if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "PASTE_YOUR_API_KEY") {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    window.db = db;
  } else {
    console.warn("[scouting] Firebase not configured yet — edit firebase-config.js. Data will NOT be shared until you do.");
  }
} catch (e) {
  console.error("[scouting] Firebase init failed:", e);
}