# Documentation

Reference material for the Parkview Squash Club application. Written 13 August 2026 from a full audit of all 39 source files.

| Document | Read it when |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | **Start here.** Stack, file layout, routing, data flow, styling architecture, and the repairs that were made to get the project compiling again. |
| [FEATURES.md](FEATURES.md) | You need to know what the app actually does today — including what is present but broken, and what is absent entirely. |
| [DATA_MODEL.md](DATA_MODEL.md) | You are touching Firestore. Every collection, every field, and the integrity problems that need fixing. |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | You are writing any UI. The four design rules, the token system, and how to rebrand. |
| [ROADMAP.md](ROADMAP.md) | You are planning what to build next. Courts, bookings, scheduling, billing, analytics, and the gaps nobody asked about. |

## The short version

**What this is.** A React and Firebase application for running a squash club's Wednesday social tournaments, with a chess-style ELO rating.

**What it is not, yet.** Aware of courts, bookings, schedules, money, membership, or notifications.

**The four design rules.** No gradients. No glow effects. No rounded corners. No emoji. See `DESIGN_SYSTEM.md`.

**The three things most likely to bite you.**

1. All business logic runs client-side, including writes to other members' documents. This has to move to Cloud Functions before anything sensitive is built.
2. A tournament not completed manually on the night it is played becomes permanently uncompletable and awards nobody any rating change.
3. Nothing in the app is confirmed by the other party — one player can create a ranked match naming another and enter the score alone.
