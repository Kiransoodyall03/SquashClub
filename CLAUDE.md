# Project context

Parkview Squash Club — React 18 + Firebase (Auth + Firestore), Create React App, deployed to Firebase Hosting.

Full reference material is in `docs/`. Read `docs/ARCHITECTURE.md` before making structural changes and `docs/DESIGN_SYSTEM.md` before writing any UI.

## Design rules — non-negotiable

1. **No gradients.** There is no gradient token. Every surface is a flat fill.
2. **No glow effects.** No coloured or large-blur shadows. Depth comes from 1px borders.
3. **No rounded corners.** Every radius token is `0`. The only exception is `border-radius: 50%` on genuine circles (spinner, avatar).
4. **No emoji.** Not in the UI, not in outbound messages, not in `console.log`. Icons come from `lucide-react`.

Colours, sizes and spacing come from `src/styles/tokens.css`. Never hard-code a hex value or a pixel spacing. To rebrand, edit only the `--color-*` block in that file, plus the `theme-color` meta in `public/index.html` and `public/manifest.json`.

All numbers — ratings, scores, counts, currency — use `--font-mono` with `font-variant-numeric: tabular-nums`, right-aligned in tables.

## Styling architecture

```
src/styles/tokens.css      variables + legacy aliases
src/styles/base.css        reset, typography, layout primitives
src/styles/components.css  new vocabulary: .btn .card .stat .table .badge .modal .field
src/App/App.css            imports the above, then restyles the LEGACY class names
src/pages/*/[Page].css     page layout only — must not redefine shared components
```

There is no CSS scoping. Every stylesheet is global. Before adding a class, grep for it — the codebase previously had `.btn` defined in six files with conflicting values.

`App/index.js` imports pages first and `./App.css` last, so shared definitions win at equal specificity. **Do not reorder those imports.**

Use the new vocabulary (`.btn--primary`, `.card__header`, `.stat__value`) for new work. The legacy block in `App/App.css` exists only to carry the untouched pages; delete from it as pages migrate.

## Code conventions

- PascalCase folder per page, containing `index.js` and `PageName.css`. Components are PascalCase files in `src/components/`.
- Use relative imports. Bare specifiers such as `'components/Foo'` rely on `jsconfig.json` `baseUrl` and break on case-sensitive builds.
- Import paths are case-sensitive on Linux CI even though they resolve on Windows. Match the filename exactly.
- Functions in `src/firebase/firestore.js` never throw — they return `{ success, error }`, `null`, or `[]`. Callers must check. Be aware this makes a missing index indistinguishable from an empty collection.
- Date of birth is `birthDate`, a `'YYYY-MM-DD'` string. Never `birthdate`, never a `Date` object.
- Status badge class names (`badge-upcoming`, `badge-active`, `badge-completed`) are built from Firestore string values at runtime. Renaming a status value silently unstyles the badge.

## Known hazards

- **All business logic is client-side**, including ELO settlement writing to other users' documents. No security rule can protect ratings until this moves to Cloud Functions.
- **No transactions anywhere.** Any new contended write (bookings, payments) must use one.
- **Tournament auto-completion strands ELO** — see `docs/DATA_MODEL.md`.
- **A failed profile read on Google login can wipe an existing account**, because profile creation uses a non-merging write.
- `firestore.rules` and `firestore.indexes.json` are not in the repository. They live only in the Firebase console.
- There are no tests.

## Commands

```bash
npm install
npm start                          # dev server
npm run build                      # production build
firebase deploy                    # hosting
```

If the build fails with `Environment key "jest/globals" is unknown`, that is an eslint-config resolution issue, not a code error. `DISABLE_ESLINT_PLUGIN=true npm run build` confirms whether the code itself compiles.

## Phase 1 — courts, bookings, confirmation, analytics

**The architectural rule:** reads run in the browser (`src/firebase/*.js`); writes that affect another member's rating or a shared court run **only** in Cloud Functions (`functions/`). `firestore.rules` denies the client side of both. Do not add a client-side write to `bookings`, `individualMatches`, `matches`, `ratingHistory` or the rating fields on `users`.

Call server actions through `src/firebase/callables.js`. When one fails, **show `result.error` verbatim** — the server writes deliberately specific messages ("That slot was taken a moment ago", "You already hold 3 upcoming bookings") and replacing them with a generic string loses the whole point.

**The slot ID format is load-bearing.** `slotId(courtId, dateKey, startTime)` produces `court-03_20260813_1800`, and that determinism is what makes double-booking impossible. It is defined in BOTH `src/lib/schedule.js` and `functions/src/shared.js`. Changing either without the other silently breaks conflict detection.

`src/lib/constants.js` and `src/lib/schedule.js` are mirrored in `functions/src/shared.js` because functions are a separate npm package. Keep them in sync.

Use `src/lib/schedule.js` for all date and time work. Never `new Date('2026-08-13')` — it parses as UTC midnight and then gets local hours applied, which is the bug that made tournament statuses flip two hours early in South Africa.

Ratings: `functions/src/rating.js` is the only place ELO is calculated. It is pure and unit-tested (`cd functions && npm test`). `rankedMatchesPlayed` drives the K-factor, separately from `matchesPlayed`, so casual play cannot deflate it.

After deploying, an owner must open `/courts` once and seed the 15 courts. The seeded opening hours are placeholders to be edited, not the club's real hours.
