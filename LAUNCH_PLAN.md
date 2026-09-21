# WaveHub: Launch Readiness Analysis & Workplan (2026-09-16)

Written in response to: "we need bog subscription and payment, also new frontend files added and
things like tournament, coaching backend for that, what we left to do, update md files, then we
will implement all carefully — check new files, analyze, write workplans, make this project ready
to launch."

**Status: analysis complete, all open product questions answered — this is now the confirmed
workplan.** Nothing described here has been implemented yet except what's noted as already
in-progress (§5). §1's direction, §3's subscription design, §4's messaging scope, and §2's
Tournaments/Steam Keys decisions are all confirmed below (see "Decisions" at the end for the raw
answers) — implementation starts from here, in the priority order in §7.

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

**Confirmed (2026-09-16): "main branch is just frontend side, our branch is the real main."**
`aslan-backend` is the authoritative product going forward — real Next.js + Postgres backend.
`origin/main` is UI/UX and copy reference only, same policy this repo has followed since Phase 0
(`root CLAUDE.md`: "the static HTML/JS prototype... is UI/UX reference only — don't extend it, and
don't wire new features to its `localStorage`-based state"). Do **not** merge `origin/main`'s
backend code, `docker-compose.yml`, or `frontend-static.Dockerfile`. New features found only on
`main` (tournaments, direct messages, the richer coach-booking UI, Steam Keys) are real product
signal worth building — built properly on this branch's real schema, not imported wholesale. A
plain `git merge origin/main` is still fine for the **static file changes** (§2e) since those carry
no backend conflict — just exclude `docker-compose.yml`/`frontend-static.Dockerfile`/anything under
`backend/src/` from that merge, or cherry-pick the static paths explicitly.

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
| `about.html` | `about` | Replace placeholder. (`about-us.html` also exists on `main` but is a stale duplicate — 47 lines vs. `about.html`'s 101, and only `about.html` is actually linked from `index.html`/`profile-nav.js`/the real footer. Use `about.html`, ignore `about-us.html`.) |
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

### 2d. Steam Keys — confirmed real feature, needs its own inventory model

`steam-keys.html`/`steam-keys.js` on `main` is currently 4 hardcoded games with a `localStorage`
favorites array, no backend. **Confirmed: build this for real**, not just port the mockup.

This is a meaningfully different shape from an ordinary `Item` listing, because the thing being
sold is a **secret, single-use string** (a Steam activation key) that must stay hidden until
purchase and must never be sold twice. Recommended design, following this repo's existing
"structural core first" pattern:

- New `ListingType.DigitalKey` (alongside the existing `Service`/`Item`) — reuses `Listing`'s
  existing category/game/title/description/images fields, since a key listing is still browsable
  the same way an item is.
- New `ListingKeyInventory` table: `listingId` FK, `keyValue` (**encrypted at rest**, not plaintext
  — this is exactly the kind of secret this repo's non-negotiable rule #2 ("no raw card/payment
  data ever touches WaveHub's own servers") extends the spirit of, even though it's not payment
  data specifically: a leaked key is a direct financial loss to the seller), `status`
  (`available`/`sold`/`revoked`), `orderId` (set once sold, `NULL` while available). Stock is just
  `COUNT(*) WHERE status = 'available'` — no separate `stockQuantity` column to keep in sync.
- Purchase flow: `OrdersService.purchase()` for a `DigitalKey` listing atomically claims one
  `available` row (`SELECT ... FOR UPDATE SKIP LOCKED` or an equivalent row-lock, so two
  simultaneous buyers can't both claim the same key) and flips it to `sold` in the same transaction
  as the existing WaveCoin debit — same "one atomic transaction, no compensating delete" principle
  `OrdersService` already uses everywhere else.
- Delivery: the buyer only ever sees the key value after `status = paid` on their own order — same
  ownership-gated pattern `OrderDeliveryFile`s already use for service-listing deliverables.
- Seller-side: a bulk key-upload form (paste a list of keys, or upload a CSV) rather than one key
  at a time — sellers realistically have dozens/hundreds of keys per title.
- **Legal**: third-party key resale is a real compliance question (Steam's own terms restrict
  resale of purchased keys in some circumstances) — worth a line in the Terms of Service content
  (§2a) explicitly, and probably a seller-facing attestation at listing-creation time ("I have the
  legal right to resell this key"). Not a blocker to building the technical feature, but should
  ship alongside it, not as an afterthought.

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

## 3. BOG subscription + membership/visibility plans — confirmed design

**Not built on either branch yet — new scope, confirmed 2026-09-16.** Confirmed shape: **two
separate subscription products**, each with multiple tiers (Basic/Pro/Elite-style), and an
explicitly extensible perks model rather than a hardcoded one ("all of that and can be added things
too").

### 3a. The two plan types

- **Buyer Membership** — perks framed around the buying experience: priority support, a profile
  badge, and whatever else gets added later (early access to new listings, exclusive promo codes,
  etc. — not designing those now, just making sure the schema doesn't need a migration to add one).
- **Seller/Coach Visibility Plan** — perks framed around marketplace visibility and take-home
  earnings: a platform-fee discount, featured/boosted placement in marketplace and coaching browse
  results, priority support, a profile badge.

Both plan types share one schema (a `plans` table with an `audience` column distinguishing
`buyer`/`seller_coach`, not two separate tables) — same reasoning as `Listing` covering both
`Service` and `Item` with one table: the two plan types share almost every column (name, tier,
price, perks), and a shared table means one admin CRUD screen and one `UserSubscription` join
table instead of two of everything.

### 3b. Extensible perks — a jsonb bag, not one column per perk

`SubscriptionPlan.perks` is a `jsonb` column, e.g.
`{ "platformFeeDiscountPercent": 3, "featuredListings": true, "prioritySupport": true, "profileBadge": "pro" }`.
Adding a new perk later (e.g. "early access to new listings") means adding a new key to this bag
and teaching whichever module reads it what the key means — no new migration, no new column. The
handful of perks confirmed now:

| Perk key | Applied where | Notes |
|---|---|---|
| `platformFeeDiscountPercent` | `OrdersService.purchase()` / `CoachingSessionsService.request()` | Subtracted from `PlatformSettingsService.getPlatformFeePercent()`'s result before snapshotting — read at purchase/booking time, same as the base fee already is. Only meaningful for the seller/coach's own active plan, not the buyer's. |
| `featuredListings` | `ListingsService.browseActive()` / `CoachesService.browseVerified()` | Sort/boost query changes: an active seller/coach with this perk gets ordered ahead of non-featured results. Read live via a join to `UserSubscription` at query time, **not** a cached `isFeatured` flag on `Listing` — a lapsed subscription must stop boosting immediately, not linger until something re-syncs a flag. |
| `prioritySupport` | `SupportService.createTicket()` | Defaults a new ticket's `TicketPriority` to `High` instead of `Medium` when the requester has an active plan with this perk. |
| `profileBadge` | `PublicUser` / `PublicCoachSummary` / `pages/u/[username].tsx` | A tier-labeled badge rendered next to the username — purely cosmetic trust signal. |

### 3c. Billing

`UserSubscription`: `userId`, `planId`, `status` (`active`/`past_due`/`cancelled`/`expired`),
`currentPeriodEnd`, `cancelAtPeriodEnd`, plus whatever reference BOG's recurring-charge API needs
to actually re-bill (see below). A `@nestjs/schedule` cron (same pattern as
`OrdersService`'s existing 72h auto-complete cron) sweeps subscriptions due at `currentPeriodEnd`
and attempts a recharge; a failed charge moves the subscription to `past_due` rather than
immediately cancelling it (a brief grace period, not an instant perk cutoff on one declined card).

**Real unknown, needs research before implementation, not guessing**: this repo's existing BOG
integration (`backend/src/payments/bog-payments.service.ts`) only implements BOG's one-time
checkout-redirect flow. A recurring charge needs BOG's **saved-card / recurring-payment API**
(tokenizing a card once, then charging that token on a schedule without the user re-entering
details) — this needs to be checked against BOG's actual current API documentation before writing
any code, the same "research the real provider contract, don't guess the shape" approach this repo
took for the original BOG callback signature verification (see `backend/src/payments/CLAUDE.md`).
If BOG's public API doesn't expose recurring/tokenized charges at all, the fallback is: charge a
one-time top-up-sized amount each period and require the user to reauthorize via the normal
checkout redirect on each renewal (worse UX, but doesn't require a capability BOG might not offer).

---

## 4. Direct messaging — confirmed in scope, transacted users only, coordination not transactions

**Confirmed 2026-09-16**: real feature, but scoped down from `main`'s open-messaging version in two
ways:

1. **Transacted users only** — a buyer and a seller/coach can message each other directly only
   once they have (or have had) a real order or coaching session together. No cold-messaging a
   stranger. Enforced server-side at conversation-creation time (check for an `Order`/
   `CoachingSession` row linking the two users before allowing a `Direct` conversation to open),
   not just hidden in the UI.
2. **Coordination only, not a transaction channel** — "users can't do anything without support...
   process goes through support." Direct messages are for communication (e.g. arranging session
   details, asking a clarifying question), not for negotiating price, resolving a delivery problem,
   or anything that changes the state of an order/session. Any of that must go through the existing
   Support ticket system or Order/Session-scoped chat + dispute flow, not a private DM. This is
   also a real anti-fraud guardrail, not just a UX opinion — it reinforces the same
   "no platform bypass" rule the new Terms of Service copy (§2a) already states explicitly
   (arranging deals or payment outside WaveHub's own checkout is prohibited). Implementation-wise
   this doesn't need content filtering — it's a policy communicated in the UI (a persistent note in
   the message thread: "Need help with an order or payment? Contact Support instead.") plus a
   one-click "Open a support ticket about this conversation" action, not an attempt to parse
   message content for transaction language.

Build on this repo's existing `backend/src/chat/` conventions (`Conversation`/`Message` entities,
`ConversationType` enum already has a `Direct` value defined and unused — see
`packages/shared-types`) rather than a second, parallel `DirectMessage` entity like `main`'s. This
was flagged back when Order Chat first shipped ("no Direct (non-order) conversations... yet") as
the natural next step for that module — this is that step. The "must have transacted" gate is new
logic in `ChatService`/a new `DirectMessagesController`, not something `chat/`'s existing
Order-conversation code needs to change.

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

## 7. Suggested order of work

1. **Content sync** (§2a) — **done (2026-09-16)**, commit-pending. `SyncRealContentPageCopy`
   migration replaced the 5 placeholder pages with real copy and added the 5 new ones
   (`delivery-policy`/`dispute-resolution`/`community-guidelines`/`coach-standards`/
   `seller-standards`), all wired into `Footer.tsx`. Verified against the live Postgres instance
   and in a real browser (`GET /content/coach-standards` and `/pages/coach-standards` both render
   the real Georgian copy). See `backend/src/content/CLAUDE.md`.
2. **Finish coaching session booking** (§5) — **done (2026-09-16)**. Migrated, 16 new unit tests,
   verified end to end against live Postgres and through the real UI (book → complete → escrow
   release + 7-day hold; book → cancel → full refund). Built the booking form on `coaching/[id].tsx`
   and a real sessions list + detail page. Dispute-path question resolved: no dispute machinery for
   a first version, cancel-for-full-refund is the accepted substitute — see `backend/src/coaching/
   CLAUDE.md`. Also found and fixed a real bug this surfaced: `WalletService.getBalanceSummary()`
   was only summing `OrderRelease` earnings, silently excluding `SessionRelease` — see
   `backend/src/wallet/CLAUDE.md`.
3. **Tournaments** (§2b) — **done (2026-09-16)**. New `backend/src/tournaments/` module (entity +
   registration entity, DTOs, service, controller, migration, 9 unit tests), migrated against live
   Postgres, and verified through a real browser click-through as testadmin: created a tournament
   through the admin UI, uploaded a real cover image, browsed/filtered the public list, registered
   as a buyer (confirmed live in the DB and cascade-deleted along with the tournament on delete),
   clicked through all 4 detail-page tabs, edited a tournament in place. Frontend: `tournaments/
   {index,[id]}.tsx` (public browse + 4-tab detail page) and `admin/tournaments.tsx` (create/edit/
   cover-upload/delete), new "Tournaments" sidebar nav item. Also found and fixed a real,
   previously-invisible bug this surfaced: `helmet()`'s default same-origin
   `Cross-Origin-Resource-Policy` header was silently blocking every uploaded image (not just
   tournament covers — listing photos and coach photos too) from loading cross-origin in the
   frontend; fixed in `backend/src/main.ts`. See `backend/src/tournaments/CLAUDE.md` for the full
   writeup.
4. **Direct messaging** (§4) — **done (2026-09-17)**. Reused the existing `Conversation`/`Message`
   entities and the already-scaffolded `ConversationType.Direct` value rather than a new table.
   `ChatService` gained a real "have these two users transacted together?" gate (checks `Order` in
   either direction, and `CoachingSession` joined through `Coach` to compare `coach.userId`), a
   DB-level partial unique index (`UQ_direct_conversation_pair`) so at most one thread exists per
   user pair regardless of race conditions, and a new `DirectMessagesController`. 10 new unit tests.
   Migrated (`EnableDirectConversations`) and verified with two real logged-in browser sessions
   (`testbuyer`/`testseller`, who share a real completed order) messaging each other live, including
   the 5s poll picking up the other side's reply with no reload, the notification bell deep-linking
   correctly, a non-transacted user's attempt getting a real 403, and a `psql` check confirming the
   unique-index guard actually holds under a repeated `start` call. Frontend: a single two-pane
   inbox page (`pages/messages/index.tsx`, reusing `messages.html`'s real markup which was already
   sitting unused in `global.css`), a "Message the buyer/seller" button on `orders/[id].tsx` and
   "Message the buyer/coach" on `coaching-sessions/[id].tsx`, and a "შეტყობინებები" Sidebar nav item.
   The "coordination only, not a transaction channel" rule is a persistent UI notice linking to
   Support, not message-content filtering (as originally scoped). See `backend/src/chat/CLAUDE.md`.
5. **Steam Keys** (§2d) — **done (2026-09-17)**. New `ListingType.DigitalKey`, `ListingKeyInventory`
   table (AES-256-GCM encrypted at rest, `key-encryption.util.ts`), and a race-safe claim in
   `OrdersService#purchase()` (`SELECT ... FOR UPDATE SKIP LOCKED` via TypeORM's QueryBuilder
   `.execute()`/`UpdateResult.affected`). A DigitalKey order is never plain-cancellable by either
   party (final sale — disputes are the venue for "this key doesn't work"); the key is revealed to
   the buyer via a separate `GET orders/:id/key` pull as soon as the order is `Paid`. Seller-facing
   bulk key-upload/inventory-management pages and buyer-facing marketplace/detail/order-reveal UI
   all shipped. Migrated and verified against live Postgres with **real concurrent-purchase
   testing**, not just curl — this caught and fixed a genuine correctness bug (a `manager.query()`
   return-shape misunderstanding that let the race-safety check silently never fire, allowing a
   purchase to succeed with zero keys actually claimed) and surfaced a separate, pre-existing
   same-buyer wallet-lock deadlock (unrelated to this feature, confirmed to affect plain Item
   purchases too, flagged as its own follow-up rather than fixed here). Also fixed a real stale-
   balance bug on the original (pre-existing) marketplace purchase flow, found during this same
   verification pass. Full writeup: `backend/src/listings/CLAUDE.md` and `backend/src/orders/
   CLAUDE.md`'s Status sections.
6. ✅ **BOG subscriptions** (§3) — **done.** Research resolved the §3c unknown: BOG supports saved-card
   background recharges (`PUT …/orders/:id/subscriptions` to save the card, then
   `POST …/ecommerce/orders/:parent/subscribe`; amount fixed to the parent order). Built: plans +
   subscriptions + charge-attempt tables, checkout/callback/cancel, hourly recharge sweep with 7-day
   `past_due` grace, all four perks wired (fee discount in percentage points, featured boost for
   listings + coaches, priority support, profile badge), `/plans` + admin plan CRUD UI. Verified live
   against Postgres and in a browser. **Caveats**: not verified against real BOG (no credentials /
   public callback URL); BOG may require saved-card enablement on the merchant account — confirm.
   Deferred: admin manual grant/revoke, past_due emails, proration. Full writeup:
   `backend/src/subscriptions/CLAUDE.md`.
7. **e2e test suite** (§6) — last, as already agreed with the user before this analysis started.

---

## Decisions (2026-09-16) — raw record of what was confirmed

- **Branch direction**: "main branch is just frontend side, our branch is the real main." →
  confirmed, see §1.
- **Subscription audience**: two separate plans (buyer membership + seller/coach visibility) → §3a.
- **Subscription perks**: all four (fee discount, featured listings, priority support, profile
  badge) plus explicitly designed to be extensible ("can be added things too") → §3b.
- **Subscription billing**: multiple tiers (Basic/Pro/Elite-style) per plan type → §3c.
- **Direct messaging**: in scope, transacted users only, and explicitly "users can't do anything
  without support — buy or process goes through support" (coordination channel, not a transaction
  channel) → §4.
- **Steam Keys**: build as a real feature, not a mockup port → §2d.
- **Tournaments**: confirmed the scoped-down version (admin posts, users register, manual
  prize payout) is the right first version → §2b.
- **`about.html` vs `about-us.html`**: resolved without needing to ask — `about.html` is the real,
  linked page; `about-us.html` is a stale duplicate → §2a.

No open product questions remain blocking §7's workplan. Implementation starts from item 1.
