# WaveHub: Launch Readiness Analysis & Workplan (2026-09-16)

Written in response to: "we need bog subscription and payment, also new frontend files added and
things like tournament, coaching backend for that, what we left to do, update md files, then we
will implement all carefully — check new files, analyze, write workplans, make this project ready
to launch."

This is analysis + a workplan only. **Nothing in this document has been implemented yet** — per the
request, implementation starts after this is reviewed. The one exception already in the working
tree: an in-progress, uncommitted coaching session-booking + escrow-payment backend (see §5).

---

## 1. The most important finding: `origin/main` has forked into a parallel, simpler backend

This has to be understood before anything else here makes sense, because it changes what "new
frontend files" and "coaching backend" actually mean.

`aslan-backend` (this branch) has spent months building a **real, Postgres-backed NestJS backend**
— proper TypeORM entities, `class-validator` DTOs, auth guards, a real WaveCoin escrow ledger
(`backend/src/wallet/`), audit-logged admin actions, migrations — all documented exhaustively in
this file's module table and each module's own `CLAUDE.md`. The Next.js app in `frontend/` is the
one real frontend, styled to match the static prototype's design system but backed by that real
API.

Since the last time this branch merged `origin/main` (44 commits ago, jumping from `66f5dc0` to
`ca51e2c`), **`main` has grown its own, independent, much simpler backend** — built by someone who
did not have this repo's `CLAUDE.md`/`SPECIFICATION.md` (confirmed: `CLAUDE.md` does not exist on
`origin/main` at all). Concretely, on `main`:

- **`backend/src/state/`** (new module) — a generic key-value blob store (`UserState` entity:
  `scope`, `key`, `value: any`). It persists the static prototype's own `localStorage` keys
  server-side almost verbatim — `wavehub.cart`, `wavehub.purchases`, `wavehub.wallets`,
  `wavehub.tournaments`, `wavehub.sellerListings`, etc. `POST /state/me` accepts
  `value: unknown` with `@Allow()` — **no schema validation on what gets written**, including into
  a key literally named `wavehub.purchases`. This is the opposite of `backend/src/wallet/`'s
  design (every balance change goes through `WalletService` inside one transaction, audited,
  typed) — it's a client-trusted, unvalidated JSON blob doing the same conceptual job.
- **`backend/src/messages/`** (new module) — a real, small direct-messaging feature
  (`DirectMessage` entity, `AuthGuard`-protected controller, DTO-validated). This one is
  reasonably built. It directly reopens a question this repo had explicitly closed: `frontend/
  CLAUDE.md` documents that direct messaging (`messages.html`) was ruled **out of scope** because
  "the real app only has order-scoped chat... there is no concept of a standalone conversation."
  That's no longer true on `main` — someone built it. Worth a real product decision now, not
  silently inheriting either branch's answer.
- **`backend/src/auth/`** — a hand-rolled HMAC-SHA256 "JWT" (`createHmac`, manual base64url
  encoding, no `jsonwebtoken` library), stored in an httpOnly cookie. Functionally converges on a
  similar security shape to this branch's real `SessionService` (httpOnly, sameSite, secure-in-prod
  all present), but it's a second, independent implementation of the exact same thing, with a
  hardcoded fallback secret (`'wavehub-local-development-secret-key'`) when `AUTH_TOKEN_SECRET`
  isn't set outside production.
- **`backend/src/payments/bog-payments.controller.ts`** — the top-up flow was fixed to derive
  `username` from the authenticated session instead of trusting the client (good — same fix this
  branch made independently, in the "real-database verification" pass documented below). But the
  credited WaveCoin is now recorded into `StateService`'s blob store (`recordWalletTransaction`),
  **not** the real `wallet_ledger_entries` table this branch's `WalletService` owns.
- **`docker-compose.yml`** now builds the frontend from a **new `frontend-static.Dockerfile`** —
  plain nginx serving the raw `*.html`/`*.js`/`*.css` prototype files directly. **The real Next.js
  app (`frontend/`) is no longer part of `main`'s Docker deploy target at all.**

**Read together, this means `main`'s current direction is: ship the static HTML/JS prototype
as-is, backed by a lightweight blob-store "backend" just capable enough to make it not purely
client-side.** That is a fundamentally different product than the one this branch has been
building — not a superset, a different architecture for the same idea.

**Recommendation**: do not merge `origin/main`'s backend code, `docker-compose.yml`, or
`frontend-static.Dockerfile` into `aslan-backend`. Keep pulling `main`'s **static HTML/CSS/JS/asset
changes** in as UI/UX and copy reference only — exactly the policy this repo has followed
consistently since Phase 0 (`root CLAUDE.md`: "the static HTML/JS prototype... is UI/UX reference
only — don't extend it, and don't wire new features to its `localStorage`-based state"). New
features found only on `main` (tournaments, direct messages, the richer coach-booking UI) are real
product signal worth building — just built properly on this branch's real schema, not imported
wholesale.

**This needs your confirmation before I touch anything else** — it's a product direction call, not
a technical one I should make unilaterally. See the Open Questions section at the end.

---

## 2. Inventory: what's actually new on `origin/main` (44 commits, `66f5dc0..ca51e2c`)

### 2a. New static pages with real, substantial content — port into the real CMS

`backend/src/content/` (the admin-editable static-page CMS this branch already built) currently
holds **placeholder** copy for 5 pages ("Replace this placeholder with your actual terms..."). The
new pages on `main` have **real, properly written Georgian legal copy**, not placeholders:

| New file on `main` | Maps to existing `content_pages` slug | Action |
|---|---|---|
| `terms-of-service.html` | `terms-of-service` | Replace placeholder body with real copy (13 sections — accounts, marketplace, coaching, payments, wallet, payouts, delivery, refunds, disputes, prohibited items, content, etc.) |
| `privacy-policy.html` | `privacy-policy` | Replace placeholder body with real copy |
| `refund-cancellation.html` | `refund-policy` | Replace placeholder body with real copy |
| `about.html` / `about-us.html` | `about` | Replace placeholder — two files exist on `main`, need to pick one (probably a duplicate from iteration) |
| `contact-information.html` | `contact` | Replace placeholder — note this branch's `Footer.tsx` deliberately points Contact at `/support` instead of a static page (real ticket flow > static contact info); revisit once real content exists |
| `delivery-policy.html` | *(none yet)* | New `content_pages` row needed |
| `dispute-resolution.html` | *(none yet)* | New `content_pages` row needed |
| `community-guidelines.html` | *(none yet)* | New `content_pages` row needed |
| `coach-standards.html` | *(none yet)* | New `content_pages` row needed |
| `seller-standards.html` | *(none yet)* | New `content_pages` row needed |

This is low-risk, high-value, and doesn't touch any architecture question — just a content-sync
task once the direction in §1 is confirmed. Should be one of the first things done.

### 2b. Tournaments — genuinely new feature, not in the original spec

`tournaments.html`, `tournament-detail.html`, `tournaments.js`, `tournament-detail.js`. Confirmed:
**not mentioned anywhere in `SPECIFICATION.md`** (grepped for "tournament" — zero matches), so this
isn't a spec feature finally being built, it's new scope.

On `main` it's simple: an admin posts a tournament (game, name, description, prize, start date,
max players, cover image) into the `state` blob under `wavehub.tournaments`; the public page reads
it back and lets a logged-in user "register" (pushed into a `registeredUsers` array in the same
blob, no capacity/duplicate-registration enforcement server-side, no real prize distribution — it's
a content/announcement feature, not a real bracket/matchmaking system).

**This maps cleanly onto the same pattern already used for `Coach`/`ContentPage`** — a real
`Tournament` entity + admin CRUD + public browse + a `TournamentRegistration` join table
(`tournamentId`, `userId`, unique constraint, registered-at timestamp), gated by `maxPlayers`. No
prize-payout automation needed for a first pass (admin marks a winner, pays out manually via the
existing withdrawal/admin-adjustment tooling) — matches this repo's own established pattern of
shipping the structural core first and flagging automation as a deliberate follow-up (see how
`backend/src/withdrawals/` still has "no real bank/PayPal/Wise payout API integration — manual/
admin-marked per the MVP decision" as a long-standing, accepted gap).

### 2c. Coaching — session booking UI got much richer; confirms this branch's own in-progress work

`coach-booking-flow.js` is a large (1000+ line), polished 6-step wizard (Session → Schedule → Your
Goal → Review → Payment → Confirmed). This is UI/UX reference, not a backend to adopt — it's still
writing into `localStorage`/the `state` blob, no real scheduling or escrow underneath it. See §5:
this branch already has a real (uncommitted, in-progress) `CoachingSession` entity + escrow-payment
backend under construction that's a more scoped, single-step version of this same idea (buyer picks
a date/time/duration, pays immediately, no multi-step wizard yet). **Recommendation**: finish the
backend first (§5), then revisit whether the frontend booking flow should adopt this richer
multi-step UX once there's a real API under it.

### 2d. Steam Keys — currently pure mock, lowest priority

`steam-keys.html`/`steam-keys.js` — 4 hardcoded games, no backend at all (not even the `state`
blob — just a `localStorage` favorites array). This reads as an exploratory UI mockup for a
possible future "digital key" listing type, not a committed feature. **Needs a real product
decision before any backend work**: is this a new `ListingType` (alongside `Service`/`Item`) with
license-key inventory/stock, or out of scope for now? Flagged as an open question, not started.

### 2e. Everything else — cosmetic, no backend implication

Currency label changes ("dollar to lari" — GEL formatting), footer icon replacements, favicon,
marketplace card visual updates, profile mini-info-boxes, "how it works" page, mobile layout
fixes, logo replacement. Worth a normal `git merge origin/main` for the static-file changes once
§1 is resolved (this repo has done that merge routinely throughout its history with zero backend
conflict, since it only ever touched static files before now) — but the merge needs to explicitly
exclude `docker-compose.yml`, `frontend-static.Dockerfile`, and everything under `backend/src/`
per the recommendation in §1, or be done as a selective cherry-pick of the static-only paths
rather than a blanket `git merge`.

---

## 3. BOG subscription + payment

**Not built on either branch.** `main`'s BOG changes (see §1) only wire the existing one-time
top-up flow into the new blob-store wallet — no recurring-billing concept exists anywhere yet, and
it isn't in `SPECIFICATION.md` either (the spec's payment model is WaveCoin top-up + internal
escrow, no subscription tier).

Before any implementation, this needs a real product definition — "subscription" could mean
several different things and the backend design differs a lot depending on which:

1. **A recurring WaveCoin auto-top-up** (e.g. "top up 50 GEL automatically every month") — the
   simplest to build: a `RecurringTopup` record (userId, amountGel, intervalDays, nextChargeAt,
   BOG payment-method token) + a cron job that re-charges it, reusing the existing
   `BogPaymentsService`/`WalletService.recordTopup` plumbing. Requires BOG's **saved
   card / recurring charge API** (not just their one-time checkout redirect flow this repo
   currently integrates with) — needs checking against BOG's actual API docs for what that
   requires (tokenization consent flow, mandate creation, etc.), same "research the real provider
   contract, don't guess" approach this repo took for the original BOG callback signature
   verification (see `backend/src/payments/CLAUDE.md`).
2. **A paid membership tier** (e.g. "WaveHub Pro" unlocking lower platform fees, featured listing
   slots, priority support) — a much bigger feature: a `Subscription`/`SubscriptionPlan` entity,
   gating logic across several existing modules (orders' fee calculation, listings' featured flag,
   support's priority queue), recurring billing same as above underneath it.
3. **Coach/seller subscription to a paid plan** for marketplace visibility — a narrower version of
   #2 scoped to sellers/coaches only.

**This is the highest-uncertainty item in this whole plan — needs your answer on which of these
(or something else) "subscription" means before any backend design work starts.** See Open
Questions.

---

## 4. Direct messaging — real feature now, needs a real design

`main`'s `backend/src/messages/` module (see §1) is a working proof that this is wanted. This
branch's own `frontend/CLAUDE.md` had ruled it out of scope on the theory that no conversation
concept existed outside order/ticket threads — that reasoning no longer holds if the product
actually wants general user-to-user messaging.

If confirmed in scope, the real-architecture version should reuse this repo's existing
`backend/src/chat/` conventions (`Conversation`/`Message` entities, `ConversationType` enum already
has a `Direct` value defined and unused — see `packages/shared-types`) rather than building a
second, parallel `DirectMessage` entity next to `chat/`'s `Message` entity. This was flagged back
when Order Chat first shipped ("no Direct (non-order) conversations... yet") as the natural next
step for that module — this is that step, now with real signal that it's wanted.

---

## 5. Coaching session booking + escrow payment — in progress, uncommitted, needs finishing

This branch already has real, uncommitted work toward this (interrupted mid-session, not from
`main` — this branch's own design, following `backend/src/orders/`'s existing patterns exactly):

**Backend, already written** (builds clean, not yet migrated/tested against the live DB, not yet
committed):
- `backend/src/coaching/coaching-session.entity.ts` — `CoachingSession`: coach/buyer FKs,
  `scheduledAt`, `durationMinutes`, price/fee/payout snapshots (same "never re-derive from a live
  rate" principle as `Order`), status.
- `backend/src/coaching/coaching-session-lifecycle.ts` — a small state machine:
  `Scheduled → Completed | Cancelled` (both terminal, reachable directly from `Scheduled`).
- `backend/src/coaching/coaching-sessions.service.ts` — `request()` (validates the coach is
  verified + active, computes price from `hourlyRateWaveCoin × duration`, debits the buyer and
  inserts the session in one transaction, best-effort notifies the coach), `complete()`
  (coach-only, releases escrow with the same 7-day hold as an order), `cancel()` (either party,
  refunds the buyer), `findMineAsBuyer`/`findMineAsCoach`/`getForParticipant`.
- `backend/src/coaching/coaching-sessions.controller.ts` — `POST coaches/:id/sessions`,
  `GET coaching-sessions/mine-as-{buyer,coach}`, `GET coaching-sessions/:id`,
  `POST coaching-sessions/:id/{complete,cancel}`.
- `backend/src/wallet/wallet.service.ts` — three new methods (`debitForSession`/
  `releaseCoachEarnings`/`refundBuyerForSession`), structurally identical to the existing
  Order-escrow trio but writing a new `sessionId` column instead of reusing `orderId` (kept as
  **separate** ledger types — `SessionEscrowHold`/`SessionRelease`/`SessionRefund` — so a
  transaction-history listing can tell a session charge from an order charge; see
  `packages/shared-types/src/index.ts`).
- `backend/src/migrations/1784342000000-CreateCoachingSessions.ts` — creates `coaching_sessions`
  + adds the `sessionId` column to `wallet_ledger_entries`. **Not yet run against the live DB.**

**Still needed to actually finish this** (none of it started):
1. Run the migration, run `npm run backend:test`/`lint`, do a real end-to-end verification against
   the live Postgres (curl a booking, complete it, confirm the escrow release and 7-day hold — same
   bar every other money-moving feature in this repo was held to).
2. Frontend: `coaching/[id].tsx`'s "book a session" button is currently a disabled placeholder —
   needs a real booking form (date/time, duration select, optional message) wired to
   `POST coaches/:id/sessions`.
3. A sessions list + detail page (mirroring `orders/index.tsx`/`orders/[id].tsx`) so a buyer/coach
   can see and act on (complete/cancel) their sessions.
4. Update `backend/src/coaching/CLAUDE.md`'s Status section once this lands — it currently says
   "no session booking... yet," which becomes stale the moment this ships.
5. **No dispute path yet** — an order can be disputed; a session currently cannot (only `Completed`/
   `Cancelled` are reachable from `Scheduled`). Worth deciding whether a session needs the same
   dispute machinery `backend/src/disputes/` gives orders, or whether "either party can cancel
   for a full refund" is an acceptable substitute for a first version (a real dispute would need a
   3-party chat + evidence + admin resolution — a much bigger addition than the trio of methods
   above).

---

## 6. Everything else already flagged as remaining, still remaining

Carried forward from before this analysis (unaffected by any of the above):

- **Task #72 — e2e/HTTP test suite** against a real test DB. Still only unit tests with fake
  repositories. Explicitly deprioritized behind finishing the system, per earlier instruction —
  still true, now behind §3/§4/§5 too.
- **Public seller-profile page enrichment** — `frontend/pages/u/[username].tsx` ships today with
  only 3 stat tiles (Rating, Public listings, Member since) because "Orders received"/"Buyer
  reviews" aren't cheaply computable yet. Low priority.
- **Admin panel visual restyle** — functional today on legacy design-system classes; no
  static-prototype admin page exists to port from, so this stays deliberately deferred (see
  `frontend/CLAUDE.md`).
- **Docker verification** — `docker-compose.yml`/`Dockerfile`s on *this* branch (not `main`'s
  nginx-static version) have never been run against a real Docker daemon. Worth doing before an
  actual deployment.
- **Trust & Safety / Analytics** (build-plan Phase 11e/11g) — fully ahead, not started.

---

## 7. Suggested order of work, once §1's direction is confirmed

1. **Content sync** (§2a) — smallest, safest, immediately valuable. Port the real legal copy into
   `content_pages`, add rows for the 5 new page types. No architecture risk.
2. **Finish coaching session booking** (§5) — closest to done, already has real backend code
   sitting uncommitted. Migrate, test, verify against live Postgres, build the frontend booking
   form + sessions list.
3. **Tournaments** (§2b) — clean, well-scoped new module following the existing `Coach`/
   `ContentPage` pattern exactly. Good next chunk after coaching sessions.
4. **BOG subscriptions** (§3) — blocked on your answer to which subscription model is wanted;
   start the real design once that's clear.
5. **Direct messaging** (§4) — blocked on confirming it's actually in scope (it was previously
   ruled out); if yes, build on `chat/`'s existing `Direct` conversation type rather than a new
   parallel entity.
6. **Steam Keys** (§2d) — blocked on a real product decision; currently pure mockup.
7. **e2e test suite** (§6) — last, as already agreed.

---

## Open questions — need your answer before implementation starts

1. **Confirm the §1 recommendation**: keep building the real Next.js + Postgres backend on
   `aslan-backend` as the one real product, treat `main`'s static files as reference-only (current,
   long-standing policy), and do **not** adopt `main`'s `state`/blob-store backend, hand-rolled
   auth, or its nginx-static Docker target? Or is there a reason to reconsider (e.g. a hard
   deadline that only the simpler static+blob approach could hit)?
2. **BOG "subscription"** — which of §3's three interpretations (recurring auto-top-up, paid
   membership tier, seller/coach paid visibility plan) — or something else entirely?
3. **Direct messaging** — back in scope, yes/no? If yes, any constraints (e.g. only between a buyer
   and a seller they've transacted with, vs. fully open)?
4. **Steam Keys** — real feature (needs a license-key inventory/stock model + legal handling of
   third-party key resale) or drop it?
5. **Tournaments** — confirm the scoped-down version in §2b (admin posts, users register, no
   automated bracket/prize payout) is the right first version, not a fuller esports-bracket system?
6. **`about.html` vs `about-us.html`** on `main` — which one is the real one to port copy from?
