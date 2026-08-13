# Expansion Report and Roadmap

**Prepared for:** Kiran, Blackbeard Technologies
**Date:** 13 August 2026
**Subject:** turning a Wednesday-social tournament tool into the club's operating system

---

## The honest starting position

The application today is a tournament bracket generator with an ELO rating attached. It does that reasonably well. Everything else the club actually runs on — courts, bookings, money, membership, communication — is absent, and several core paths are broken in ways that lose data rather than fail loudly.

Three facts shape everything below.

**One: all business logic runs in the browser.** ELO settlement, tournament completion and member administration all execute client-side and write directly to other members' documents. That is not a security posture that can be tightened — it is a security posture that cannot exist. No Firestore rule can simultaneously let one player's browser write another player's rating and prevent that player from writing their own. The moment money enters the system this stops being a theoretical concern.

**Two: there is no notion of time or place.** No court, no time slot, no scheduled match. The only date in the system is a single field on the tournament document. Every feature you asked for — court management, scheduling, bookings, utilisation analytics — is built on a foundation that does not exist yet.

**Three: nothing is confirmed by the other party.** Any player can create a ranked match naming you, enter the score alone, and permanently move your rating. Once billing exists, that same pattern would let one member commit another to a charge.

The good news: the data model is small, the domain is well understood, and the club is a single tenant with fifteen courts. This is a tractable build.

---

## Phase 0 — Foundations (complete or immediate)

**Done in this pass:** four merge conflicts and two hidden syntax errors resolved, the `birthDate` field standardised, dead files removed, component filenames normalised, and the design system rebuilt. The app compiles and deploys again.

**Still required before any feature work lands:**

| Item | Why it blocks everything |
|---|---|
| Move settlement to Cloud Functions | ELO, tournament completion, bookings and billing all need writes the client must not be trusted with. Everything downstream depends on this. |
| Commit `firestore.rules` and `firestore.indexes.json` | They exist only in the console today. Unversioned, unreviewable, and a missing index surfaces as an empty list rather than an error. |
| Transactions on contended writes | There is not one transaction in the codebase. Double-booking and double-charging are both impossible to prevent without them. |
| Fix the midnight auto-completion defect | Any tournament not completed on the night silently strands everyone's rating. |
| Fix the destructive Google-login path | A transient network failure can currently reset an existing member's rating and history to zero. |
| Notifications | Every feature below is half-useful without them. A booking nobody is told about is a diary entry. |
| Environment separation | Development and production write to the same database. |

---

## Phase 1 — Courts and bookings

This is the largest missing capability and the one that changes the app from a tournament tool into something members open every week.

### Court model

Fifteen courts, each a first-class record. Per your decision, availability is **per court and owner-editable** rather than assumed.

```
courts/{courtId}
  number            1..15
  name              display label, e.g. "Court 1", "Glass Back"
  status            active | maintenance | retired
  attributes        [glass_back, doubles, show_court, ...]
  availability      weekly windows, per weekday: [{ opens, closes }]
  bookableFrom      earliest time members may book (some courts open later)
  minSlot           booking granularity, e.g. 30 or 45 minutes
  maxAdvanceDays    how far ahead members may book
  notes             free text for the owner
```

Ad-hoc exceptions live separately so the weekly pattern stays clean:

```
courtClosures/{id}
  courtId, from, to, reason        maintenance, league night, private hire, resurfacing
```

An owner screen edits all of this. Nothing about the club's real opening hours is hard-coded — you configure it rather than me guessing it.

### Bookings

```
bookings/{bookingId}
  courtId, startAt, endAt
  type              casual | tournament | league | coaching | maintenance | event
  bookedBy          member UID
  players[]         who is on court
  guests[]          non-members, with a guest fee attached
  status            confirmed | cancelled | no_show | completed
  matchId           set when a booking produces a rated match
  invoiceLineId     set when the booking is chargeable
  createdAt, cancelledAt, cancelledBy
```

**Preventing double-booking properly.** This cannot be done with a read-then-write from the browser — two members tapping the same slot both see it free. Two mechanisms, used together:

1. A Cloud Function performs the write inside a Firestore transaction.
2. Slot reservation documents use a **deterministic ID** — `{courtId}_{YYYYMMDD}_{HHmm}` — so a create is atomically unique. A second attempt on the same slot fails at the database, not at application logic.

The second mechanism is the one that actually guarantees correctness, and it is cheap.

### Booking rules the club will need

Configurable, because every club's are different: how far ahead members may book, how many active bookings one member may hold, peak versus off-peak limits, cancellation cut-off, late-cancel and no-show handling, and whether guests are permitted at peak times. Each of these is a small rule, but together they are the difference between a booking system members trust and one the committee argues about.

### Both audiences

- **Members:** a week grid of the fifteen courts, book, invite opponents, cancel within policy, see their own upcoming bookings, join a waitlist for a full slot.
- **Owner:** the same grid with everything visible, plus block a court for maintenance, create recurring reservations (league nights, coaching blocks, junior programme), override rules, and see utilisation.

---

## Phase 2 — Tournament scheduling on real courts

Once courts exist, tournament matches stop being an unordered list and become a schedule.

Add to each match: `courtId`, `scheduledStart`, `scheduledEnd`, `round`, `order`, and `status` extended to include `scheduled`, `in_progress`, `forfeit` and `walkover`.

### The scheduler

Assigning matches to courts and times is a constraint problem. A greedy scheduler over sensibly ordered matches is entirely sufficient at club scale and far easier to reason about than anything cleverer.

**Hard constraints — never violated:**

- One match per court per time slot.
- A player is never in two matches at once.
- A match is only placed inside that court's availability window, respecting the courts that open later.
- No match placed on a court that is closed or under maintenance.

**Soft constraints — optimised, and reported when they cannot be met:**

- Minimum rest between a player's consecutive matches (configurable, default around 20 minutes).
- Keep a group's matches on the same court where possible, so players know where to be.
- Balance load across courts rather than hammering courts 1 to 4.
- Respect declared player availability windows for players who arrive late.
- Finish within the tournament's stated end time.

The output is a schedule the owner can review and adjust by drag-and-drop, with a re-run that preserves manual pins. Every generated match also creates a matching court booking, so tournament use and casual bookings live in one calendar and cannot collide.

**Also needed here**, because they currently block tournament completion entirely: forfeit and walkover handling, removing a participant mid-tournament, correcting a completed score, and reopening a tournament. Right now a single no-show makes a tournament permanently uncompletable, and every participant loses their rating change.

---

## Phase 3 — Billing and payments

Per your decision: **full ledger now, gateway-ready**, so members can be moved to in-app payment later without a rewrite.

### Model

```
feeSchedules/{id}      name, amount, cadence (monthly|annual|once), appliesTo (tier|category)
memberships/{id}       memberId, tier, startDate, endDate, status, feeScheduleId, proRata
invoices/{id}          memberId, number, issuedAt, dueAt, status
                       (draft|issued|part_paid|paid|overdue|written_off|credited)
invoiceLines/{id}      invoiceId, description, quantity, unitAmount, tax, sourceType
                       (subscription|court_booking|guest_fee|tournament_entry|
                        coaching|late_cancellation|no_show|bar|equipment|manual)
                       sourceRef  -> links a line back to the booking or entry that caused it
payments/{id}          memberId, amount, receivedAt, method
                       (eft|cash|card|debit_order|gateway), reference, allocatedTo[],
                       provider, providerRef, idempotencyKey
credits/{id}           memberId, amount, reason, appliedTo
```

The fields that make this gateway-ready are `provider`, `providerRef` and `idempotencyKey` on payments, and `sourceType`/`sourceRef` on lines. Add a payment provider later and nothing else in the schema moves. For South Africa the realistic options are PayFast, Yoco, Ozow or Stripe; debit order via a provider like Netcash or Sage Pay is worth considering for monthly subscriptions, since that is how most clubs actually collect.

### What the owner gets

- **Who owes what** — an arrears table aged 0–30, 31–60, 61–90 and 90+ days, sortable, with a total outstanding.
- **Member statement** — every charge and payment on one page, printable.
- **Batch invoicing** — generate the month's subscriptions in one run, idempotently, so a re-run does not double-charge.
- **Reconciliation** — import a bank statement, match payments by reference, allocate against invoices.
- **Reminders** — automated at configurable intervals, with an escalation path and a record of what was sent to whom and when.
- **Suspension policy** — automatically restrict booking rights beyond a set arrears threshold. This is what actually collects money, and it needs to be a rule rather than an argument.

### What the member gets

A balance on their dashboard, their invoice history, what each charge was for (a court booking, a guest fee, a tournament entry), and — once a gateway is added — a pay button.

### Non-negotiables

Money records are append-only. An invoice is never edited after issue; it is credited and reissued. Every financial write is idempotent. Every financial write is audited with who, what, when and from where. Tax handling should be decided up front with the club's accountant — whether the club is VAT-registered changes the invoice format and cannot be retrofitted cleanly.

---

## Phase 4 — Player analytics

Today a player sees their rating, win rate, matches played and their last ten results. The dashboard tiles that were supposed to show this have been returning hard-coded zeroes.

Worth building, roughly in order of value to a player:

**Rating trajectory.** A rating history series — currently only the single latest change is stored, so the past is unrecoverable. Start writing `ratingHistory` entries now, before more history is lost. Show the curve, the peak, and the change over 30 and 90 days.

**Form and streaks.** Last ten results as a W/L strip, current streak, longest streak, and results split by whether the opponent was rated above or below them.

**Head-to-head.** Record against each regular opponent, with the score history. This is the single most-requested feature in every club app of this kind, and the data to compute it already exists.

**Performance quality, not just outcomes.** Points won and lost per game, average margin, record in close games (decided by two points), record in deciding games, and performance by game number — the player who reliably loses the fifth game learns something actionable.

**Context splits.** By court, by day of week, by time of day, by format, by opponent rating band. Once bookings exist these become available for free, and "you win 70% on Court 3 and 40% on Court 11" is the kind of insight that makes a member open the app.

**Participation.** Matches per month, attendance rate against booked matches, and time since last played.

**Goals.** A target rating with progress, and a nudge when they have not played in a while.

---

## Phase 5 — Club analytics for the owner

The owner's questions are commercial, not sporting. The dashboard should answer them without anyone exporting a spreadsheet.

**Utilisation** — the highest-value analytics in the whole product, because it is what fifteen courts cost money for. Occupancy by court, by hour, by weekday. A heatmap of the week. Peak versus off-peak split. Courts that are chronically under-used, and hours that are chronically over-subscribed. Wasted capacity from no-shows and late cancellations, in hours and in rand.

**Membership** — headcount by tier and age category, joiners and leavers by month, net growth, and retention. Most importantly, **churn risk**: members whose play frequency has dropped sharply, or who have not been on court in six weeks. That is a list the club can act on this month.

**Money** — revenue by source (subscriptions, court fees, guest fees, tournament entries, coaching), month on month, against outstanding arrears and the ageing profile. Collection rate. Revenue per member. Forecast subscription income for the coming month.

**Competition** — tournament fill rates, entries per event, completion rate, average matches per player, no-show rate, and the club's overall rating distribution so the owner can see whether the club is getting stronger and whether the grading bands still make sense.

**Engagement** — active members as a share of total, matches per active member, and the share of members who have never entered a tournament. That last number usually surprises people and points straight at a programme gap.

Every one of these should be exportable to CSV, because a club committee will always want it in a spreadsheet.

---

## What you did not mention, and should consider

You asked me to flag anything missing. In rough order of how much I would push for each.

**1. Match confirmation.** The most important item in this document. Until the named opponent has to accept a match and confirm a score, the rating system is not trustworthy and the billing system would not be defensible. Suggested flow: challenge issued, opponent accepts or declines, result entered by either party, opponent confirms or disputes, auto-confirmation after a set period, and a dispute queue the owner resolves. Everything else in this roadmap is worth less without it.

**2. Notifications.** Email as a baseline, WhatsApp given how the club already communicates, and web push later. Triggers: booking confirmed and reminded, match scheduled or changed, result awaiting confirmation, rating changed, invoice issued, payment overdue, tournament opened, entry approved or rejected, waitlist slot released. The current app has no notifications at all — members find out things by checking.

**3. Leagues and box ladders.** Parkview runs leagues, and they are not the same shape as a knockout tournament. Boxes of four to six players, monthly cycles, automatic promotion and relegation, self-scheduled matches within a window. This is the recurring engagement engine of most squash clubs and it drives both court bookings and subscription renewals. It reuses the group and rating machinery you already have.

**4. Roles beyond owner and player.** Two roles is not enough for a real club. You will want committee or admin (member management but not billing), treasurer (billing but not member deletion), coach (their own bookings and their squad), and junior or parent-linked accounts. Today the only gate is a shared password compiled into the JavaScript bundle, which anyone can read in devtools.

**5. Guests and visitors.** Members bring guests, guests pay a fee, and that fee should appear on the member's account automatically. It is a small feature that pays for itself.

**6. Coaching.** Coach profiles, bookable slots that consume court availability, lesson types, and billing that flows into the same ledger. Also the main reason a court is blocked at peak time.

**7. Juniors and safeguarding.** Parent or guardian linkage, guardian contact details, consent records, and restricted visibility of junior profiles. If the club runs a junior programme this is not optional — it is a duty-of-care matter.

**8. POPIA compliance.** South African clubs hold names, dates of birth, contact details, and soon payment records. That brings obligations: a privacy notice, a lawful basis for processing, consent records for marketing, subject-access export, a deletion path, and a retention policy. Note that the current `removeUserFromClub` deletes a profile document while leaving that person's matches and tournament entries in place — that is not deletion in any sense a regulator would accept.

**9. Audit logging.** Nothing today records who entered a score, who cancelled a match, or who disabled an account. Add an append-only audit collection before billing, not after — the first disputed charge is the wrong moment to discover you cannot answer who did what.

**10. Attendance and check-in.** Did the booking actually get played? Without it, utilisation figures are bookings rather than usage, and no-show billing has nothing to stand on.

**11. Mobile reality.** Scores are entered courtside, on a phone, often on poor signal. That argues for a proper progressive web app with offline-tolerant score entry and a queue that syncs when signal returns. The current matches table forces a 700px minimum width with horizontal scrolling — six columns on a phone for what is fundamentally two names and a score.

**12. Club communications.** A noticeboard or announcements feed, so the club stops depending entirely on a WhatsApp group where information is unfindable a week later.

**13. Rating system maturity.** Before the ladder is taken seriously: a rating floor (ratings can currently go negative), inactivity decay, separation of casual from ranked in the K-factor (casual matches currently corrupt it), a provisional-rating indicator, and doubles rated separately from singles rather than through team averages.

**14. Operational housekeeping.** Court maintenance logs, equipment and ball stock, incident reports, and a simple document store for club rules and constitution.

---

## Suggested sequencing

| Phase | Scope | Why here |
|---|---|---|
| 0 | Cloud Functions, rules, indexes, transactions, the two data-loss defects, notifications | Nothing is safe to build on until this is done |
| 1 | Match confirmation and dispute flow | Makes ratings trustworthy; must precede billing |
| 2 | Courts, availability, bookings, waitlist | The largest gap and the biggest engagement win |
| 3 | Tournament scheduling onto courts; forfeits, walkovers, score correction | Depends on courts existing |
| 4 | Billing ledger, arrears, statements, reminders, suspension policy | Depends on bookings, since bookings generate charges |
| 5 | Player analytics, including rating history | Start writing rating history in phase 0 regardless |
| 6 | Club analytics and utilisation | Needs several months of booking data to be interesting |
| 7 | Leagues and boxes, roles, guests, coaching | Growth features once the core is solid |
| 8 | Payment gateway, PWA, POPIA tooling | Once the ledger has been proven manually |

Two things are worth pulling forward regardless of phase: **start recording rating history immediately**, because every day without it is history you cannot reconstruct; and **add the audit log before billing**, not after.

---

## Effort, honestly

Phases 0 and 1 are a few weeks of focused work and are mostly repair rather than new capability. Phase 2 is the single biggest build — a booking system with real constraint handling is more work than it looks, and the rules engine is where the time goes. Phase 3 is moderate and largely mechanical once the constraint model from phase 2 exists. Phase 4 is where regulatory and accounting decisions cost more time than the code does. Phases 5 and 6 are comparatively quick, because they are read-only views over data the earlier phases created — which is exactly why the earlier phases should record generously.

The temptation will be to jump to analytics, because dashboards demo well. Resist it. Analytics over a system that does not yet record courts, bookings, confirmations or payments will produce charts of the wrong thing.
