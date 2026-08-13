# Data Model — Current State

**Firebase project:** `squashclub-e8a0c` (hard-coded in `src/firebase/config.js`, no environment separation)
**Audited:** 13 August 2026

> **Read this document in two halves.** Everything above the "Phase 1 additions" heading describes the model as originally audited, including defects. Phase 1 adds courts, bookings, two-sided match confirmation, rating history and analytics, and moves privileged writes into Cloud Functions. Where the two disagree, Phase 1 wins.

Originally four collections, all top-level, with no subcollections. `firestore.rules` and `firestore.indexes.json` are **now committed to the repository** — previously they existed only in the Firebase console, unversioned and unreviewable.

---

## `users`

Document ID = Firebase Auth UID.

| Field | Type | Notes |
|---|---|---|
| `firstName` | string | |
| `lastName` | string | |
| `email` | string | Copied from the Auth record |
| `role` | `'player'` \| `'owner'` | Client-supplied. See § Trust below. |
| `authProvider` | `'email'` \| `'google'` | |
| `photoURL` | string \| null | Google sign-ups only |
| `age` | number \| null | Set only by the profile-completion path |
| `birthdate` **or** `birthDate` | Date object **or** `'YYYY-MM-DD'` string | **Broken.** Both spellings and both types exist in live code. See § The birthdate conflict. |
| `elo` | number | Starts at 1200 |
| `matchesPlayed` | number | Tournament + individual, **including casual** |
| `matchesWon` | number | |
| `tournamentsPlayed` | number | Incremented for every participant on completion, including those who played zero matches |
| `tournaments` | string[] | Tournament IDs. A denormalised mirror of the participant arrays that is written but never read for querying. |
| `lastEloChange` | number | Most recent net delta |
| `disabled` | boolean | Enforced client-side only |
| `disabledAt` | Timestamp \| null | |
| `createdAt` / `updatedAt` | serverTimestamp | `createdAt` is required for member-list ordering — a document missing it is invisible |

---

## `tournaments`

Client-generated document ID, duplicated into an `id` field inside the document.

| Field | Type | Notes |
|---|---|---|
| `name` | string | |
| `date` | `'YYYY-MM-DD'` string | Parsed as UTC midnight, then adjusted in local time — see § Timezone bug |
| `time` | `'HH:MM'` string | |
| `format` | string | One of the eight display strings; never parsed for validation |
| `groupSize` | number | Arrives from the form as a **string** |
| `maxParticipants` | number | **Never enforced anywhere in the data layer** |
| `description` | string | |
| `requiresApproval` | boolean | |
| `password` | string | **Plaintext.** Readable by any client that can read the tournament. |
| `createdBy` | string (UID) | The de facto ownership check |
| `status` | `'upcoming'` \| `'active'` \| `'completed'` | |
| `participants` | Participant[] | `{ userId, name, elo, joinedAt }` — `elo` is a snapshot taken at join time |
| `pendingParticipants` | Participant[] | Approval queue |
| `matches` | string[] | Match IDs. Only ever appended; nothing removes. An unbounded array inside a 1 MiB document. |
| `groupSettings` | map | `{ "Group A": { format } \| null }` — per-group format override |
| `completedAt` | serverTimestamp | **Load-bearing sentinel.** Its presence is the only thing distinguishing a properly settled tournament from an auto-expired one. |
| `eloChanges` | map | UID → net delta, frozen at completion |
| `finalStandings` | array | Frozen at completion; editing a score afterwards does not recompute it |
| `createdAt` / `updatedAt` | serverTimestamp | |

---

## `matches` — tournament matches

| Field | Type | Notes |
|---|---|---|
| `tournamentId` | string | |
| `player1Id` / `player2Id` | string (UID) | |
| `player1Name` / `player2Name` | string | Denormalised, never refreshed |
| `players` | string[] | Flattened, for array-contains queries |
| `groupName` | string | `"Group A"` etc. |
| `format` | string | Resolved at generation time; a later group-format change does not propagate |
| `status` | `'pending'` \| `'completed'` | |
| `scores` | `{ player1, player2 }[]` | One entry per game |
| `winner` | string (UID) \| null | **A UID.** Note the contrast with `individualMatches`. |
| `createdBy` | string (UID) | |
| `completedAt` / `createdAt` / `updatedAt` | serverTimestamp | |

**No scheduling fields.** No `scheduledAt`, no `court`, no `round`, no `order`, no duration.

---

## `individualMatches`

A parallel system with deliberately different conventions from `matches`. This divergence is a significant source of bugs.

| Field | Type | Notes |
|---|---|---|
| `matchType` | `'1v1'` \| `'2v2'` | |
| `matchMode` | `'ranked'` \| `'casual'` | Only ranked moves ELO |
| `format` | string | **A different vocabulary** from tournament formats |
| `pointsPerGame` | number | Written, never read — every consumer re-derives it from the format string |
| `team1` / `team2` | `{ id, name, elo }[]` | Key is `id`, **not** `userId` as in tournament participants |
| `team1AvgElo` / `team2AvgElo` | number | Written at creation, then **ignored** at settlement, which recomputes them |
| `players` | string[] | |
| `status` | `'pending'` \| `'in-progress'` \| `'completed'` \| `'cancelled'` | `in-progress` is unreachable |
| `winner` | `'team1'` \| `'team2'` \| null | **A team label, not a UID** |
| `scores` | `{ team1, team2 }[]` | |
| `eloChanges` | map \| null | UID → delta; all zeroes for casual matches |
| `createdBy` | string (UID) | |
| `completedAt` / `cancelledAt` / `createdAt` / `updatedAt` | serverTimestamp | |

**No scheduling fields.** No date, time, venue, court, or notes.

---

## `clubs`

Dead. `createClub()` exists and is never called. No user document carries a `clubId`. The app is single-tenant in practice despite the naming.

---

## The birthdate conflict

The most urgent schema decision. Two spellings and two types are simultaneously live:

| Side | Field | Type written |
|---|---|---|
| `main` | `birthdate` | `new Date(...)` → Firestore Timestamp |
| `BetterTournament` | `birthDate` | `'YYYY-MM-DD'` string |

The data layer reads `userData.birthDate` to compute age, then emits it under the key `birthdate`. Whichever branch wins the merge, one of those two lines reads a field that does not exist. This is why the leaderboard age filters are permanently empty.

**Decision:** standardise on **`birthDate`** as a `'YYYY-MM-DD'` string. That is the spelling the data layer actually consumes, strings are timezone-safe, and they survive JSON round-trips. A one-off migration must normalise existing documents.

---

## Integrity problems that need fixing

### Severe

1. **Tournaments auto-complete without settling.** The status recalculation persists `completed` at midnight without `completedAt` and without running ELO. The settlement function then permanently refuses. Any tournament not finished on the night dies with no ratings awarded.

2. **A failed Google profile read wipes an existing account.** `getUserProfile()` returns `null` both for "no such document" and for any thrown error. The Google login path branches on exactly that value, so a transient network failure makes an existing user look new — and profile creation uses a non-merging write, resetting ELO and match history to zero. This is the most destructive path in the codebase.

3. **No transactions or batches anywhere.** ELO settlement writes each player independently, then marks the tournament complete. A failure in between leaves ratings applied and the tournament open; re-running double-applies every increment. The same pattern exists for individual matches, where two concurrent submissions can both pass the "already completed" check.

4. **Any client can write any field to any user document.** `updateUserProfile()` is a blanket merge — a client can set its own `elo`, `role`, or `disabled: false`. And because ELO settlement runs client-side and writes to *other* users' documents, no security rule strict enough to protect ratings can coexist with the current architecture. **This logic belongs in Cloud Functions.**

### Significant

5. **Capacity is never enforced server-side.** Concurrent joins, a stale tab, or the dev tool will overfill a tournament.
6. **Duplicate participants are possible** — the join writes an object containing a fresh timestamp, so deduplication never fires.
7. **Every list query is unbounded.** The `limit` parameter on the leaderboard and recent-matches functions never reaches the database; the whole collection is downloaded and the tail discarded in JavaScript. Nothing is paginated.
8. **Reads perform writes.** Loading the tournament list issues one sequential write per tournament.
9. **Approval removal is brittle** — it relies on deep object equality including a client-generated timestamp. A round-tripped object silently fails to remove, leaving a zombie entry.
10. **Missing composite indexes are undeclared and fail silently** — because every function catches and returns an empty array, a missing index looks like "no data".
11. **Ordering silently hides documents.** Any user document missing `createdAt` or `elo` is invisible to member management and the leaderboard while still accumulating stats.
12. **Group assignments are computed, never stored**, so they can contradict the fixtures that were generated from them.
13. **No score validation of any kind.** A client can post a winner who is not in the match, or scores inconsistent with the declared winner.
14. **Timezone bug.** The tournament date is parsed as UTC midnight and then has local hours applied, so status boundaries fire at the wrong moment for any client outside UTC — and that wrong status is persisted. South Africa is UTC+2, so this is live.

### Drift

Denormalised values that go stale and are never refreshed: participant names and ELOs, match player names, individual-match team ELOs, the duplicated `id` field, and the frozen standings and ELO-change maps.

---

## Security posture

Everything below is currently assumed rather than enforced. None of it can be enforced without moving settlement logic server-side.

- `role` must be immutable after creation and unwritable by clients — otherwise the registration passwords are irrelevant, since anyone can simply write `role: 'owner'` to their own profile.
- `elo`, `matchesPlayed`, `matchesWon`, `tournamentsPlayed` must be unwritable by clients.
- `disabled` must be unwritable by its subject.
- Tournament `password`, `status`, `completedAt`, `eloChanges` and `finalStandings` are all client-writable today.
- Match scores and winners are client-written with no server validation.
- No App Check, so the public config is exposed to any script.

---

# Phase 1 additions — courts, bookings, confirmation, analytics

Added 13 August 2026. Everything below is written **only** by Cloud Functions unless stated otherwise; `firestore.rules` denies client writes.

## `courts` — document ID `court-01` … `court-15`

| Field | Type | Notes |
|---|---|---|
| `number` | number | 1–15 |
| `name` | string | Display label |
| `status` | `active` \| `maintenance` \| `retired` | Only `active` courts are bookable |
| `attributes` | string[] | `glass_back`, `show_court`, `doubles`, … |
| `availability` | map | `{ mon: [{opens, closes}], … }` — per weekday windows |
| `bookableFrom` | `'HH:mm'` \| null | The courts that only free up later in the day |
| `sortOrder`, `notes` | | |

Owner-writable directly. Configuration is last-write-wins, which is acceptable; bookings are not, which is why they differ.

## `courtClosures`

`courtId`, `fromDate`, `toDate`, `fromTime`, `toTime`, `reason`. Ad-hoc exceptions kept separate so the weekly pattern stays clean.

## `clubSettings/config`

Single document. `slotMinutes` (60), `openTime`, `closeTime`, `maxAdvanceDays`, `maxActiveBookingsPerMember`, `maxPeakBookingsPerWeek`, `cancellationCutoffHours`, `noShowGraceMinutes`, `autoConfirmResultHours`, `allowWaitlist`, `guestsAllowedAtPeak`, `peakWindows[]`.

## `bookings` — **deterministic document ID**

> `court-03_20260813_1800` — `{courtId}_{YYYYMMDD}_{HHmm}`

**This ID format is the double-booking defence and must never change without a migration.** Two members tapping the same slot attempt to create the same document; a Firestore transaction inside `createBooking` reads that exact ID first and aborts if it is taken. A cancelled booking may be written over, which is why the ID stays deterministic rather than being consumed forever.

The format is duplicated in `src/lib/schedule.js` and `functions/src/shared.js`. A divergence between them would be silent and severe.

| Field | Notes |
|---|---|
| `courtId`, `courtNumber`, `courtName` | Denormalised so the grid renders without a join |
| `date`, `startTime`, `endTime` | Wall-clock strings, the source of truth |
| `startAt`, `endAt` | Timestamps, derived, for range queries only |
| `type` | `casual` \| `tournament` \| `league` \| `coaching` \| `maintenance` \| `event` |
| `status` | `confirmed` \| `cancelled` \| `completed` \| `no_show` |
| `bookedBy`, `players[]`, `playerIds[]`, `guests[]` | |
| `isPeak` | Frozen at creation, so a later settings change cannot retroactively rewrite history |
| `lateCancellation` | Recorded, not charged. The flag a late-cancel fee will key off |
| `matchId`, `tournamentId` | Links a booking to what was played on it |

## `waitlist`

`memberId`, `date`, `startTime`, `courtId` (nullable = any court). On cancellation the longest-waiting member is **notified**, not auto-booked — auto-booking someone who no longer wants the slot just produces a no-show.

## `individualMatches` — reworked for two-sided confirmation

New statuses: `pending_acceptance` → `scheduled` → `awaiting_confirm` → `completed`, plus `disputed`, `declined`, `cancelled`. Legacy `pending` and `in-progress` documents still render.

New fields: `acceptances` (map of UID → `pending`/`accepted`/`declined`), `confirmations` (UID → `pending`/`confirmed`/`disputed`), `resultSubmittedBy`, `autoConfirmAt`, `disputeReason`, `gamesWon`, `bookingId`, `settlementReason`.

`team1`/`team2` entries now carry `ratingAtChallenge` for display only. **Settlement re-reads live ratings inside the transaction** rather than using the snapshot — that was the original bug where a tournament settled players at the rating they held when they joined.

## `ratingHistory`

`playerId`, `before`, `after`, `delta`, `reason` (`match` \| `tournament` \| `adjustment`), `matchId`, `opponentId`, `opponentRating`, `at`.

Written inside the same transaction as the rating change, so the curve can never disagree with the profile. **The original app stored only the single most recent change**, so rating history before this date is unrecoverable.

## `analyticsDaily/{YYYY-MM-DD}`

Nightly rollup: `slotsOffered`, `slotsBooked`, `utilisation`, `byCourt`, `byHour`, `byType`, `cancellations`, `lateCancellations`, `distinctPlayers`, `matchesCompleted`. A year of history is 365 reads instead of a full collection scan.

## `auditLog` and `notifications`

`auditLog` is append-only: `actorId`, `action`, `entity`, `entityId`, `detail`, `at`. Written on every state change a member could later dispute.

`notifications` is the in-app inbox. Email and WhatsApp delivery will hang off the same records, so the history already exists when those channels arrive.

## New user fields

`rankedMatchesPlayed` — counted separately from `matchesPlayed` so **casual matches can no longer deflate the K-factor**. `peakRating`, `ratingUpdatedAt`.
