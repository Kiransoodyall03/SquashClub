# Architecture

**Stack:** Create React App 5 · React 18 · React Router 6 · Firebase 10 (Auth + Firestore) · framer-motion · lucide-react
**Hosting:** Firebase Hosting, serving `build/`, single-page rewrite to `index.html`
**Audited:** 13 August 2026 · ~17,600 lines across 39 files in `src/`

---

## Repair history — resolved 13 August 2026

> **Status: fixed.** This section is kept as a record of what was wrong and how it was resolved, so the decisions are not re-litigated. The app compiles.

The repository **did not compile.** Four files carried unresolved git merge-conflict markers, committed from a merge of `main` into `BetterTournament`:

| File | Conflicts | Substance |
|---|---|---|
| `src/App/index.js` | 1 (lines 9–47) | Entire import block. Folder-per-page paths vs old flat lowercase paths. |
| `src/pages/Register/index.js` | 10 | `birthdate` vs `birthDate`; Date object vs string; age gate 13 vs 16. |
| `src/pages/Profile/index.js` | 5 | Same birthdate split. |
| `src/pages/TournamentDetails/index.js` | 3 | Icon imports; firestore imports and relative depth; a ~965-line inline `<style>` block vs an external CSS import. |

Resolution notes, so this is not re-litigated later:

- **`src/App/index.js`** — take the `main` side (it matches the on-disk folder layout), but fix two defects that survive it: `import Leaderboard from 'pages/LeaderBoard'` is a bare specifier that only resolves via `jsconfig.json` `baseUrl`, and `Navigation` / `LoadingScreen` are imported with capitals while the files on disk are lowercase — which works on Windows and breaks on any Linux build.
- **`src/pages/TournamentDetails/index.js`** — the icon conflict must take the `BetterTournament` side (the `main` side omits icons the body uses, producing a `ReferenceError`). The import conflict needs **both** sides merged: `main` has the correct relative depth and the CSS import, `BetterTournament` has the named exports the body calls. The style conflict must take `main` (external CSS), but `TournamentDetails.css` is **missing rules that exist only in the inline block** — the approval and password UI would ship unstyled.
- **Register / Profile** — standardise on `birthDate` as a `'YYYY-MM-DD'` string (see `DATA_MODEL.md`), and pick 13 as the minimum age unless the club says otherwise.

Two further compile-blockers hid behind the conflicts, both since fixed:

- `src/pages/Profile/index.js` declares `calculateAge` **twice with `const` in the same scope** — a `SyntaxError` even after the merge is resolved.
- `src/components/CreateMatchModal.js` dereferences `userProfile.firstName` without optional chaining while the same file uses `userProfile?.firstName` elsewhere — it throws if the profile has not loaded.

---

## File layout

```
src/
  index.js                    entry point
  index.css                   minimal reset (conflicts with App.css on body font)
  App/
    index.js                  router, auth state, role-based route guards
    App.css                   the global design system — tokens + shared components
  firebase/
    config.js                 hard-coded Firebase config, auth/db/googleProvider exports
    auth.js                   registration, login, Google flow, logout, reset
    firestore.js              1,630 lines — the entire data layer and all business logic
  components/
    navigation.js             top nav, role-aware
    loadingscreen.js
    CompleteProfile.js        shown when an authed user has no Firestore profile
    createtournamentmodal.js
    CreateMatchModal.js       1,205 lines
    scoreEntryModal.js        tournament score entry only
  pages/
    Landing/  Login/  Register/  JoinTournament/
    PlayerDashboard/  OwnerDashboard/  MemberManagement/
    Tournaments/  TournamentDetails/
    IndividualMatches/  MatchDetails/
    LeaderBoard/  Profile/
    Leaderboard.js            DEAD FILE — duplicate of LeaderBoard/index.js, imported by nothing
```

### Naming inconsistency

File naming is inconsistent in a way that is safe on Windows and fatal on Linux CI or a case-sensitive build:

- `components/navigation.js` and `components/loadingscreen.js` are lowercase but imported as `Navigation` / `LoadingScreen`.
- `components/createtournamentmodal.js` is lowercase; `CreateMatchModal.js` and `CompleteProfile.js` are PascalCase.
- `pages/LeaderBoard/` (capital B) contains `Leaderboard.css` (lowercase b), and there is a separate dead `pages/Leaderboard.js`.

**Convention going forward:** PascalCase folder per page, `index.js` + `PageName.css` inside. Rename the lowercase component files.

---

## Routing

Defined in `src/App/index.js`. Auth state comes from `onAuthStateChanged`; the profile is fetched separately and drives role gating.

| Path | Access | Component |
|---|---|---|
| `/` | public, redirects if signed in | Landing |
| `/login` `/register` | public | Login / Register |
| `/join/:tournamentId` | **fully public** | JoinTournament |
| `/dashboard` | authed | PlayerDashboard, or OwnerDashboard if role is owner |
| `/owner-dashboard` | owner | OwnerDashboard |
| `/members` | owner | MemberManagement |
| `/tournaments` `/tournament/:id` | authed | Tournaments / TournamentDetails |
| `/matches` `/match/:id` | authed | IndividualMatches / MatchDetails |
| `/leaderboard` `/profile` | authed | LeaderBoard / Profile |

**Dangling links:** `/players` now redirects to `/members`, `/settings` is a real page, and a catch-all route replaces the former blank page. `/forgot-password` is still unregistered — password reset exists in `auth.js` but has no UI.

---

## Data flow

> **Superseded.** This described the original architecture. Privileged writes now run in Cloud Functions — see "Phase 1 — server-side logic" at the end of this document. The description below still applies to the read path and to tournament code that has not yet been migrated.

```
component → firestore.js function → Firestore SDK → Firestore
```

`firestore.js` is the whole back end: schema, queries, ELO mathematics, group generation, tournament settlement, and statistics. At 1,630 lines it is the single highest-risk file in the project and the first candidate for decomposition.

**Conventions inside it:**

- Every async function swallows its errors with `console.error` and returns `{ success: false, error }`, `null`, or `[]`. **Nothing ever throws.** The upside is that the UI never crashes on a failed query; the downside is that a missing index, a permission denial, and an empty collection are indistinguishable to the caller and to the user.
- Reads are one-shot `getDoc` / `getDocs`. There are no realtime listeners anywhere, so concurrent users see stale state until a manual reload.
- Several functions perform writes during reads (status recalculation).

---

## Styling architecture

Styling is delivered **three different ways in the same codebase**, all landing in one global namespace. There are no CSS Modules, no styled-components, and no scoping of any kind.

1. Imported `.css` files (most pages).
2. Inline `<style>{...}</style>` blocks inside components — `navigation.js`, `CompleteProfile.js`, `Register/index.js`, `Tournaments`, `TournamentDetails`, `CreateMatchModal`, `createtournamentmodal`, `scoreEntryModal`. These are **globally scoped**, not component-scoped.
3. Inline `style={{...}}` props for a few computed widths.

Consequences currently live in the app:

- `.btn`, `.btn-primary`, `.badge`, `.elo-badge`, `.loading-spinner`, `.stat-card`, `.empty-state`, `.section-header` and others are each **defined in three to six different files with conflicting values**. Which one wins depends on stylesheet load order.
- `.badge-upcoming` is orange in one file and blue in another. `.badge-completed` is green in one and grey in another.
- `@keyframes spin` is defined six times.
- The auth page styles exist in **four near-duplicate copies**, one of which (`Login.css`) is never imported at all.
- `createtournamentmodal.js` uses `<style jsx>` syntax with no styled-jsx configured — React passes the attribute through as an unknown DOM prop and the block leaks app-wide.
- Lucide icons carry Tailwind-style classes (`w-5 h-5`) throughout. **Tailwind is not installed.** These are inert strings; sizing works only because of Lucide's own defaults.

**This is the primary reason the redesign has to be a rebuild of the styling layer rather than a recolour.** See `DESIGN_SYSTEM.md`.

---

## Build and deploy

```bash
npm install
npm start          # dev server
npm run build      # production build into build/
firebase deploy    # hosting only
```

The `build/` directory and a stray `Y/` directory are committed to the repository and should be removed from version control.

There are no tests, no linting beyond the CRA default, no CI, and no environment separation — development and production share one Firebase project.

---

## Priority repairs, in order

1. Resolve the four merge conflicts and the two hidden compile errors. Nothing else can be verified until the app builds.
2. Fix the auto-completion defect that strands tournament ELO.
3. Fix the destructive Google-login path that can wipe an existing profile.
4. Standardise `birthDate` and migrate existing documents.
5. Wire up the Player Dashboard statistics (currently permanently blank).
6. Delete the dead `pages/Leaderboard.js`, the dev-tools panel, and the unimported `Login.css`.
7. Add `firestore.rules` and `firestore.indexes.json` to the repository.
8. Move ELO settlement into a Cloud Function so ratings can be protected by security rules.

---

# Phase 1 — server-side logic

The app is no longer purely client-side. `functions/` holds the Cloud Functions that own every privileged write.

```
functions/
  index.js              exports; region europe-west1 throughout
  src/shared.js         constants + slot maths, duplicated from src/lib for the CF runtime
  src/common.js         admin init, caller resolution, audit, notifications
  src/rating.js         the ELO engine (pure, unit-tested)
  src/bookings.js       createBooking, cancelBooking, joinWaitlist, recurring blocks
  src/matches.js        challenge / accept / submit / confirm / dispute / resolve
  src/admin.js          seedCourts, setMemberRole, adjustRating
  src/scheduled.js      auto-confirm, close-out, reminders, analytics rollup
  test/engine.test.js   node test/engine.test.js
```

**The split that matters:** reads live in `src/firebase/*.js` and run in the browser. Writes that affect another member's rating, or the availability of a shared court, run only in a Cloud Function. `firestore.rules` denies the client side of both.

`src/firebase/callables.js` is the single place callable names are declared, and it converts `HttpsError` into the `{ success, error }` shape the app already speaks — **without** swallowing the server's message. Those messages are deliberately specific ("That slot was taken a moment ago", "You already hold 3 upcoming bookings") and must be shown verbatim.

## Duplication that must stay in sync

`src/lib/constants.js` + `src/lib/schedule.js` are mirrored in `functions/src/shared.js`. Functions are a separate npm package and cannot import from the CRA tree. **The `slotId()` format is the one that matters** — a divergence silently breaks double-booking prevention.

## New routes

| Path | Access | Page |
|---|---|---|
| `/bookings` | member | Court grid, 15 courts x time slots |
| `/my-bookings` | member | Own bookings and waitlist |
| `/stats` | member | Personal analytics |
| `/courts` | owner | Court records, availability, closures |
| `/settings` | owner | Booking rules and peak windows |
| `/analytics` | owner | Club analytics |
| `/players` | — | Redirects to `/members` (the old dangling link) |
| `*` | — | Catch-all; previously a blank page |

## Deploying

```bash
firebase deploy --only firestore:rules,firestore:indexes
cd functions && npm install && cd ..
firebase deploy --only functions
npm run build && firebase deploy --only hosting
```

Then, signed in as an owner, open `/courts` and press "Create the club's courts" once. That seeds the 15 courts and the settings document with **placeholder** opening hours, which the owner then edits — nobody told me the club's real hours, and guessing them into production data would be worse than an obvious placeholder.

Cloud Functions require the Blaze plan. Scheduled functions also require the Cloud Scheduler API to be enabled on the project.
