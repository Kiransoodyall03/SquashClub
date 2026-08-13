# Feature Inventory — Current State

**Audited:** 13 August 2026, against all 39 files in `src/`.
**Purpose:** an accurate record of what this app does *today*, before the redesign and feature expansion. Anything marked BROKEN or MISSING is a statement of fact about the code as committed, not a wish list.

> **The app does not currently compile.** Four files carry unresolved git merge-conflict markers from a merge of `main` into `BetterTournament`. See `ARCHITECTURE.md` § Known Broken State. Read that first.

---

## 1. Roles

Two roles only, stored as a plain string on the user document: `player` and `owner`.

- Role is chosen by the user at registration and gated by a **shared password hard-coded in the JS bundle** (`src/firebase/auth.js:16-19`): `SquashPlayer2024` / `SquashOwner2024`. Anyone who opens devtools can read both.
- There is no server-side role enforcement. `isOwner()` reads the Firestore profile client-side.
- There is no club/tenant concept in practice. A `clubs` collection and a `createClub()` function exist but are never called; no user document carries a `clubId`. The app is effectively single-club.

---

## 2. Authentication and accounts

| Feature | State |
|---|---|
| Email + password registration | Works. Requires first/last name, email, password (min 6), birthdate, role, registration password. |
| Age gate at registration | Present but **conflicted**: one branch enforces 13–100, the other 16–100. |
| Google sign-in | Works, two-step. New Google users land on a completion form (first/last name, optional birthdate or age, role, registration password). |
| Password reset | `resetPassword()` exists in `auth.js`. **No route or UI reaches it** — the Login page links to `/forgot-password`, which is not registered. |
| Email verification | Not implemented. |
| Account disable | Owner can flip `disabled: true`. Enforcement is client-side only (`src/App/index.js:71-79` signs the user out with a browser `alert()`). The Firebase Auth credential stays valid. |
| Account removal | `removeUserFromClub()` deletes the Firestore profile document only. The Auth account, the user's matches, and their entries inside tournament participant arrays all survive as orphans. |
| Profile completion fallback | If an authenticated user has no Firestore profile, `CompleteProfile` is shown. It captures **age as an integer**, whereas Register captures a **birthdate** — two incompatible shapes for the same concept. |

---

## 3. Tournaments

### 3.1 Lifecycle

Three statuses: `upcoming` → `active` → `completed`. No cancelled, no draft, no registration-closed.

| Transition | Trigger |
|---|---|
| → `upcoming` | Owner creates the tournament |
| `upcoming` → `active` | Owner clicks Start (needs ≥ 2 participants) **or** the clock passes the tournament date+time |
| `active` → `completed` | Owner clicks Complete (only when every match has a score) **or** the clock passes midnight after the tournament date |
| `completed` → anything | Impossible |

**Critical defect.** The automatic midnight transition writes `status: 'completed'` but never writes `completedAt`, and never runs the ELO settlement. `completeTournament()` then refuses to run because the tournament "is already completed", and the Complete button stops rendering. **Any tournament not manually completed on the night it is played becomes permanently uncompletable and awards nobody any ELO.**

Compounding this: the status recalculation runs *inside the read path*. Every call to `getTournament`, `getTournaments` or `getTournamentsByOwner` issues a database write per tournament.

### 3.2 Creation

Owner-only, via a modal. Fields: name, date, time, format, requires-approval flag, join password, group size (2–8), max participants (4–64), description.

Eight scoring formats, defined as display strings and duplicated verbatim in two files with no shared constant:

`1 game to 21` · `2 games to 15` · `3 games to 11` · `Best of 3 to 11` · `Best of 3 to 15` · `Best of 5 to 11` · `Best of 5 to 15` · `Best of 7 to 11`

The format string is **never parsed for validation** on the tournament side — it is a label attached to the match.

A **"Dev Tools" panel ships to production**: a checkbox that auto-joins every user in the database to the new tournament, ignoring capacity and silently failing on password-protected tournaments.

### 3.3 Groups / pools

- Generated client-side, **never stored**. Recomputed from the live participant list on every page load.
- Participants are sorted by ELO descending and sliced sequentially — Group A is the strongest players, Group B the next, and so on. This is strength-banded, not balanced and not snake-seeded.
- Group names are positional: Group A, B, C…
- Each group can be given a scoring-format override, but only before its matches are generated.

**Consequence:** because groups are recomputed but matches are fixed at generation time, adding or removing a single player after generation makes the displayed groups no longer match the actual fixtures.

### 3.4 Matches within a tournament

- Full round-robin inside each group: every pair plays once.
- Generated once, owner-only. **No regenerate, no add match, no remove match, no delete tournament.**
- Match record holds: the two players, group name, format, scores array, winner, status (`pending` / `completed`).
- **No date, no time, no court, no round, no order.** See § 6.
- Either player, or an owner, may enter the score unilaterally. There is no opponent confirmation and no dispute path.
- **A completed score is permanently immutable — even for the owner.** A typo cannot be corrected, and it permanently skews ELO.
- There is no forfeit, walkover, or remove-participant action. One no-show leaves a permanently unplayable match, which blocks completion, which triggers the defect in § 3.1.

### 3.5 Standings

Computed across the whole tournament, not per group. Sorted by matches won, then point difference. **No head-to-head, no games ratio, no deterministic final tie-break** — equal players fall back to object insertion order, so the podium can reorder between page loads.

Standings are fetched while a tournament is active but only *rendered* once it is completed. Players get no live table.

### 3.6 Joining

Three entry points: the tournament detail page, a public `/join/:tournamentId` share link, and the dev auto-populate tool.

| Concern | State |
|---|---|
| Capacity | Enforced in the UI only. The data layer never checks `maxParticipants`. |
| Duplicate joins | Possible. The join writes an object containing a fresh timestamp, so array-union deduplication never fires. |
| Waitlist | Does not exist. |
| Approval queue | Works for the owner (approve / reject). The player sees a static "Request Pending" chip with **no way to cancel**, and rejection is silent. |
| Join password | Stored and transmitted **in plaintext**, entered in a plain text input, and checked client-side. Decorative. |
| Withdrawal | Only while the tournament is `upcoming`. Once active, nobody can leave and the owner cannot remove anyone. |

**The share link is broken for both access-control features.** The `/join/:id` page never collects a password, and it treats a pending approval as a successful join. So password-protected and approval-required tournaments are unjoinable via the only invite channel the product has.

### 3.7 Invitations

A single WhatsApp deep link, generated only from the Owner Dashboard. The message body is hard-coded to say "Wednesday Social Tournament" regardless of the actual tournament name, and contains emoji. There is no copy-link button, no email invite (despite the landing page advertising one), and no share control on the tournament page itself.

---

## 4. Individual (non-tournament) matches

A separate system from tournament matches, with its own collection, its own score-entry UI, and its own vocabulary.

### 4.1 Creation

Two-step modal: match type (`1v1` / `2v2`), mode (`ranked` / `casual`), format. Ranked matches are restricted to "Best of" formats. The creator is auto-slotted into team 1; other players are chosen from searchable dropdowns.

**Owners cannot be selected as opponents or partners** — the candidate filter requires `role === 'player'`.

### 4.2 The consent gap

This is the single largest design flaw in the application.

> Any player can create a **ranked** match naming another player, without their knowledge, and then enter the score alone. That permanently moves the named player's ELO. There is no invite, no accept, no decline, no notification, and no way to reverse it.

### 4.3 Statuses

`pending` → `completed` | `cancelled`. A fourth status, `in-progress`, is filterable in the UI but **unreachable** — the only function that would set it is never called.

Cancellation is unguarded: no permission check, no reason captured, no record of who did it, no undo.

### 4.4 Score entry

Two separate, non-shared implementations exist — one inline in the match detail page (used for individual matches), one in `scoreEntryModal.js` (used only by tournaments). They have divergent copies of the same format-parsing logic and different input limits.

Validation that exists: a winner must be determinable; all games must be entered for fixed formats; no draws.

Validation that does **not** exist: nothing checks a game actually reached the target score, nothing enforces the two-point margin, nothing rejects an implausible score, nothing caps the number of games server-side. A 0–0 game is silently discarded.

For fixed multi-game formats the winner is decided on **aggregate points**, not games won. Under `3 games to 11`, a player who wins two games out of three can lose the match. That is not squash.

### 4.5 Metadata captured

`matchType`, `matchMode`, `format`, `pointsPerGame`, the two teams, snapshot ELOs, players array, creator, status, scores, winner, ELO changes, timestamps.

**No date, no time, no venue, no court, no notes.** The UI displays the record's creation timestamp behind a calendar icon, which actively misleads users into thinking it is the match date.

---

## 5. Ratings and rankings

### 5.1 ELO

Everyone starts at 1200. K-factor decays with matches played (50 → 16 across five bands), with extra reduction above 2200 and 2400. Upsets are amplified up to ×1.3; expected wins against much weaker players are damped to ×0.85. Above 2200 a second deflation factor applies — so elite players are penalised twice.

No decay, no inactivity handling, no rating floor (ELO can go negative), no draws, no provisional flag beyond the inflated early K.

**Tournament ELO is calculated from stale ratings.** The baseline is the ELO snapshotted when the player *joined*, not their current rating. A player who joins two weeks early and plays twenty ranked matches in between is still settled at their old number.

**Casual matches corrupt the K-factor.** They increment `matchesPlayed` without touching ELO, so a player can grind casual games to drive their K down from 50 to 16 while their rating stays frozen at 1200.

### 5.2 Leaderboard

Ranked by ELO alone, no tie-breaker. Age-group tabs: All / Juniors / Teenagers / Adults / Masters.

**The age filters are permanently empty.** The client reads one field spelling and the server writes another, and the value type is a Firestore timestamp where a date string is expected — every age computes to `NaN`, and every `NaN` comparison is false. The two files also disagree on the bracket boundaries (an 18-year-old is a Teenager server-side and an Adult client-side).

The query fetches the global top 50 and *then* filters by age, so a Masters player ranked 60th overall is invisible in the Masters tab.

Disabled players are not filtered out and still occupy leaderboard positions.

There is a **second, dead leaderboard file** (`src/pages/Leaderboard.js`) that is not imported anywhere.

### 5.3 Statistics

Computed somewhere in the app: win rate, matches played/won, ELO change, average points scored/conceded, point differential, per-match win/loss.

**Not computed anywhere:** streaks, head-to-head records, form over the last N matches, ELO history or graph, per-opponent or per-format splits, time-of-day or day-of-week patterns, improvement rate.

**The Player Dashboard's four stat tiles are permanently blank.** They call `getPlayerStatistics()`, which — despite its name — is a byte-for-byte copy of `getPlayerMatchHistory()` and returns an array of matches. Every tile falls through to its hard-coded default (1200 / 0% / 0 / 0).

---

## 6. Courts and scheduling

**Neither exists, anywhere, in any form.**

There is no court entity, no court number, no court availability, no booking, no time slot, no per-match scheduled time, no duration, no calendar. The only time data in the entire system is a single date and a single time on the tournament document, used to drive the status clock.

Searching the source for court, venue, booking, time-slot or scheduled-at returns only decorative CSS — a court-pattern background and a drawn court graphic on the landing page.

The club has 15 courts. The app is unaware of them.

---

## 7. Billing and payments

**Does not exist.** No fees, no invoices, no payments, no subscriptions, no arrears, no membership tiers, no financial records of any kind.

---

## 8. Dashboards and admin

### Player Dashboard
Four stat tiles (all broken, § 5.3), up to three upcoming tournaments, top-five club leaderboard.

### Owner Dashboard
Four stat tiles (total tournaments, active players, upcoming, completed). Tournament list with a Manage link and a Send Invites button.

Non-functional elements shipped to users: the filter tabs (All/Upcoming/Active/Completed) have no click handlers; the per-card Edit and Settings icons have no handlers; Send Reminders and View Reports have no handlers; Manage Players links to `/players` and Club Settings links to `/settings` — **neither route exists** (member management is at `/members`).

### Member Management (owner only)
Search, filter by status and role, sort by name/ELO/matches/join date. Table of members with avatar, role, ELO, matches, win rate, join date, status. Per-member disable, enable, remove — each behind a confirmation modal.

Missing: bulk actions, any way to change a member's role after registration, an invite flow, member notes, emergency contacts, membership status.

### Profile
Editable: first name, last name, birthdate. Read-only: email, age, account type, member since. Stats: ELO with last change, matches played/won/lost, win rate, tournaments, a win/loss bar, average points scored/conceded, point differential, last 10 matches, tournament history.

**No avatar upload** — the only avatar in the system is whatever Google supplied at sign-up.

---

## 9. Cross-cutting gaps

| Gap | Impact |
|---|---|
| No notifications of any kind | No email, no push, no in-app. Players learn about matches, results, approvals and rejections by checking manually. |
| No realtime listeners | Everything is one-shot fetch. Two people entering scores concurrently see stale state until a manual reload. |
| No transactions or batched writes anywhere | ELO settlement fans out independent writes then marks the tournament complete. A failure between the two double-applies on retry. |
| No pagination anywhere | Every list fetches its entire collection. |
| No security rules or index definitions in the repo | Both live only in the Firebase console. A missing index surfaces as an empty list, not an error, because every function swallows exceptions. |
| No tests | Testing libraries are installed; there are zero test files. |
| No environment separation | Firebase credentials are hard-coded. Dev and production write to the same database. |
| Accessibility | Icon-only buttons without labels, no focus traps, no escape handling, no live regions, tables without scope, rank conveyed by colour and emoji alone. |
| Audit trail | None. Nothing records who entered a score, who cancelled a match, or who disabled an account. |

---

## 10. Summary — what works, what is broken, what is absent

**Works:** registration and login, tournament creation, group generation, round-robin fixtures, score entry, ELO calculation, the leaderboard's overall ranking, member management, the profile page.

**Present but broken:** tournament completion after midnight, player dashboard stats, leaderboard age filters, the share-link join flow for protected tournaments, several dashboard buttons and two dashboard routes, password reset.

**Absent entirely:** courts, scheduling, bookings, billing, payments, notifications, knockout brackets, match confirmation, meaningful analytics, audit logging.
