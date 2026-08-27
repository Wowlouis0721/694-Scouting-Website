# 694 Scouting Site — REBUILT 2026 setup

Everything here is a **static site** (no server) — same as before, still hosted on
GitHub Pages. All data lives in your existing Firebase project (`scouting-21dc4`).

## 1. Upload these files to your repo

Upload **all** of these to the same folder (root of `694-Scouting-Website`), replacing
the old versions:

```
index.html            ← NEW: the dashboard everyone lands on
page-dashboard.js     ← NEW: dashboard logic
scout.css            ← NEW: all page styling now lives here
shared.js             ← NEW: login, event picker, admin check, photo compression
firebase-config.js    ← UPDATED: same project, new rules block (below)
scout.html            ← UPDATED: start position, no-show, defense, breakage
teams.html            ← UPDATED: full match data + scouter name + pit card
pit.html               ← NEW: pit scouting with photos
admin.html             ← NEW: admin-only management page
Auto.html / TeleOp.html / Total.html   ← UPDATED: same rankings, new shared engine
page-scout.js, page-teams.js, page-pit.js, page-admin.js,
page-ranking-core.js, page-auto.js, page-teleop.js, page-total.js   ← NEW: page logic
```

Every page now links `scout.css` and loads `shared.js` — if either is missing the
pages will look unstyled or the login screen won't work.

## 2. Turn on Google sign-in (~3 minutes)

You asked for Slack login. A **static GitHub Pages site can't do real Slack
OAuth** — Slack's login flow needs a server to hold a secret client key, and
GitHub Pages only serves files, no server code. The practical equivalent: sign in
with your **@stuypulse.com Google account** (the same account most of you already
use for Slack/Docs), and every other email domain is hard-rejected. If you want a
literal "Sign in with Slack" button later, Firebase's paid **Identity Platform**
tier supports Slack as an OIDC provider — the page code wouldn't need to change,
just the button. For now:

1. [console.firebase.google.com](https://console.firebase.google.com) → your `scouting-21dc4` project.
2. **Build → Authentication → Get started → Sign-in method → Google → Enable → Save.**
3. **Authentication → Settings → Authorized domains → Add domain** →
   `wowlouis0721.github.io` (localhost is already there for testing).

## 3. Lock down the database with these rules

**This step is what actually enforces "@stuypulse.com only"** — the login screen
alone just makes it convenient; the rules are what stop someone from reading or
writing data with the wrong account (or no account at all).

**Firestore Database → Rules → replace everything → Publish:**

```
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
```

Five collections now: `reports` (match scouting), `pit` (pit scouting + photos),
`assignments` (a match + team handed to one scout — admins write, everyone reads),
`users` (a row stamped the first time someone signs in, which is what fills the
"Assign to" dropdown — each person can only write their own row), and
`admins` (who can reach admin.html — `louis.lee@stuypulse.com` is wired in as a
permanent seed admin in both the app code and these rules, so it can't be
accidentally removed).

## 4. That's it

Push to GitHub, wait ~1 minute for Pages to redeploy, then open `scout.html` — you
should see the sign-in screen. Sign in with your StuyPulse Google account.

## Assignments and the dashboard

**Admin → Assignments** creates one job at a time: an event, a match, a team, and
one person. The "Assign to" box is a dropdown of everyone who has signed in, but
you can also type a name that isn't in the list — if they've never logged in, the
assignment finds them by name the moment they do.

Nobody ticks anything off. An assignment counts as **done** the instant a report
exists for the same event + match + team, so the open list is always the real
list of work left.

**index.html** is the new landing page. Signed-in scouts see their first name,
their open assignments (each with a *Scout it* button that opens the scout form
already filled in), how many matches and pit entries they've filed, and who else
is filing reports. The event dropdown at the top filters the whole page, and
"All Events" totals everything.

## Qualification vs playoff matches

The scout form and the assignment form both have a **Q / P** toggle next to the
match number. Quals save as `Q12`, playoffs as `P3`, in a `matchLabel` field —
that string is what every table, flag and assignment displays. The plain number
still lives in `match` for sorting, and `matchType` is `'qual'` or `'playoff'`.

Reports filed before this update have no `matchLabel`; they were all quals, so
the site renders them as `Q<number>` automatically. Nothing needs migrating.

## What changed, page by page

- **scout.html** — added the 7-spot starting-position picker (flips for red/blue),
  a No-show checkbox that grays out everything except comments, a defense slider +
  team-defended picker, a breakage checkbox with PulseCrew tags, and the scout
  name field now fills itself in from your login instead of being typed by hand.
- **teams.html** — search results now show every field: alliance, start position,
  auto/teleop/ferried/total, fouls, defense rating, breakage, **and the scouter's
  name** (from their Slack/Google login, not a text box). A pit-scouting card for
  the team appears automatically under the results.
- **pit.html** *(new)* — drivetrain, hopper capacity, specialist role, weight,
  notes, and up to 2 photos per team (compressed in-browser so they stay small
  enough for one Firestore document — no paid Storage plan needed). A live
  directory below the form shows every pit entry at the currently selected event.
- **admin.html** — assignments manager at the top (create, filter by event, show
  or hide finished, remove). Visible in the nav, but only usable by admins (checked
  both in the UI and by the rules above, so hiding the tab isn't the only thing
  stopping a scout). Sections: admin roster (add/remove by @stuypulse.com email,
  seed admin can't be removed), scout leaderboard, PulseCrew breakage flags with
  a one-click copy for `#comp-pulsecrew`, and full reports/pit managers with delete.
- **Auto.html / TeleOp.html / Total.html** — same rankings as before, now sharing
  one script (`page-ranking-core.js`) instead of three near-duplicate files, and
  no-show entries are correctly excluded from the averages.

## One semantics note

The old sheet's `auto`/`teleop`/`total` fields already meant "fuel shot", so the
ranking pages need no changes — they still average the same field names. **Ferried
fuel is now tracked separately** (`ferried`, plus `autoFerry`/`teleopFerry` inside
each report) instead of being invisible. If you had old reports from before this
update, they'll still show up everywhere (team search, rankings) — they just won't
have a start position or ferried count, which the pages already handle gracefully.

## Testing

All 8 pages were smoke-tested with a mocked Firebase (auth + Firestore) covering:
sign-in gating by email domain, a full scout-report submission (including the
no-show path), team search rendering complete match data with the scouter's name,
a pit save + live directory render, admin access gating (seed admin vs. a regular
scout), the promote-admin flow, and rankings computation excluding no-shows. 19/19
passed. Photo compression itself depends on the browser's Canvas API and couldn't
be exercised in that headless test, but it runs the same well-supported code path
as any client-side image resizer.
