# coaching

## Purpose
Coach profiles, the public coach directory, and admin verification/suspension. Build-plan Phase
11b. SPECIFICATION.md §5.13.7 is explicit that a **Coach is a structurally separate concept from
Seller/Listing**, not a variant of either — own verification flow, own profile, own
session-based (not order-based) delivery, own quality-score tracking. The original spec only had
"Coaching" as one service *category* under Listings; this module is that parallel concept.

**Deliberately sliced down from the full Phase 11b scope** — this covers profile creation,
verification, the public directory, and admin suspend/restore only. This mirrors how Listings
(Phase 3) shipped before Orders (Phase 4) — profile/catalog first, money-moving transactions as
their own later phase, not bolted on quickly alongside the profile work.

**Session booking + escrow payment (2026-09-16) — code written, not yet migrated/tested/wired to
the frontend.** See Status below for exactly what exists and what's still needed before this is
real. See `/Users/sarvat/Desktop/wavehub/LAUNCH_PLAN.md` §5 for the full writeup and next steps.

## Key files
- `coach.entity.ts` — `Coach`: 1:1 with `User` (`userId` unique), `gameId` (nullable FK to the
  existing `Game` taxonomy — one primary game only, see gotcha below), `specialty`, `bio`,
  `languages` (text array), `hourlyRateWaveCoin`, `verificationStatus` (`VerificationStatus` —
  reused from `@wavehub/shared-types`, not a new enum), `rejectionReason`, `status` (`CoachStatus`
  — `active`/`suspended`, a separate axis from verification), `ratingAvg`/`ratingCount` (unused
  stopgap columns, same precedent as `User.sellerRatingAvg`/`Listing.ratingAvg` — nothing writes
  these yet since there are no coaching-session reviews).
- `coach-lifecycle.ts` — `assertValidVerificationTransition`: a much smaller graph than
  `listing-lifecycle.ts`'s (`Pending → Verified`, `Pending → Rejected`, `Rejected → Pending` for
  reapplication). `Coach.status` (active/suspended) has only two states with no interesting rules,
  so it doesn't get a map — see `CoachesService#suspend`/`restore`'s inline guards instead.
- `coaches.service.ts` — `CoachesService`. User-facing: `apply`/`findMine`/`browseVerified`/
  `findPublicById`. Admin-facing: `listPendingVerification`/`listAll`/`approve`/`reject`/
  `suspend`/`restore`.
- `coaches.controller.ts` — `CoachesController`. `GET coaches/pending-verification` and
  `GET coaches/all` **must stay registered before** `GET coaches/:id` — same Express
  registration-order gotcha documented in `backend/src/listings/CLAUDE.md`'s `pending-review` note.
- `coaching-session.entity.ts` — `CoachingSession`: coach/buyer FKs, `scheduledAt`,
  `durationMinutes`, `priceWaveCoin`/`platformFeePercentSnapshot`/`platformFeeWaveCoin`/
  `coachPayoutWaveCoin` (snapshots, same "never re-derive from a live rate" principle as `Order`),
  `status` (`CoachingSessionStatus`). **New, uncommitted as of 2026-09-16 — see Status.**
- `coaching-session-lifecycle.ts` — `assertValidSessionTransition`: `Scheduled → Completed`,
  `Scheduled → Cancelled`, both terminal. Much smaller than `order-lifecycle.ts`'s graph — a
  session is a single point-in-time event, no InProgress/Delivered split.
- `coaching-sessions.service.ts` — `CoachingSessionsService.request()` (validates the coach is
  `Verified`+`Active`, computes `priceWaveCoin = round(hourlyRateWaveCoin × durationMinutes / 60)`,
  atomically inserts the session and debits the buyer via `WalletService.debitForSession` — same
  one-transaction principle as `OrdersService#purchase`), `complete()` (coach-only, releases
  escrow via `WalletService.releaseCoachEarnings`, same 7-day hold as an order), `cancel()` (either
  participant, refunds the buyer via `WalletService.refundBuyerForSession`),
  `findMineAsBuyer`/`findMineAsCoach`/`getForParticipant`.
- `coaching-sessions.controller.ts` — `POST coaches/:id/sessions`,
  `GET coaching-sessions/mine-as-{buyer,coach}` (**must stay registered before**
  `GET coaching-sessions/:id`, same Express ordering gotcha as above),
  `POST coaching-sessions/:id/{complete,cancel}`.

## Data model
`coaches` (migration: `CreateCoaches`). `userId` is `UNIQUE` — one Coach row per user, reused
across reject→reapply cycles rather than creating a new row each time (see `apply()`'s gotcha
below).

`coaching_sessions` (migration: `CreateCoachingSessions`, **not yet run** — see Status) — FKs to
`coaches`/`users`, `ON DELETE CASCADE` on both. Also adds a `sessionId` column to
`wallet_ledger_entries`, parallel to and mutually exclusive with the existing `orderId` column —
see `backend/src/wallet/CLAUDE.md`.

## Conventions & gotchas
- **`complete()`/`cancel()` re-check `Scheduled` under a row lock** (`lockAndRevalidate`) — a coach
  completing while the buyer cancels used to both pay the coach and refund the buyer. Covered by
  `test/coaching.e2e-spec.ts`.
- **`apply()` reuses the same row on reapplication after rejection** rather than inserting a new
  one — `userId`'s `UNIQUE` constraint makes a second row impossible anyway, so this is required,
  not just tidy. A first-time applicant gets a new row at `Pending`; a previously-`Rejected`
  applicant's row is updated back to `Pending` with a fresh `specialty`/`bio`/`rate` and
  `rejectionReason` cleared. Applying while already `Pending` or `Verified` is rejected outright
  (`assertValidVerificationTransition` throws) — there's no "edit while pending" flow, matching
  Listings' own lack of an edit-after-submit path.
- **Only one primary game per coach** (`Coach.gameId`, nullable, reuses the existing `Game`
  taxonomy from `backend/src/listings/`) — real coaches often teach several games (see the static
  prototype's mock `coaches-data.js`, which has a `games: [...]` array). A real multi-game model
  would need a join table; not built since nothing yet depends on filtering/displaying more than
  one game per coach.
- **`Coach.status` and `Coach.verificationStatus` are independent axes.** A `Verified` coach can
  still be temp-suspended (SPECIFICATION.md §5.13.2/.3/.4's "temp suspend, restore coaching")
  without losing verification — suspending doesn't touch `verificationStatus`, and the admin
  frontend only shows the suspend/restore action for coaches that are already `Verified` (a
  `Pending`/`Rejected` coach isn't a real target for suspension yet).
- **Role gating is the same three-role group for every admin action here** (approve/reject/
  suspend/restore) — `COACH_MANAGEMENT_ROLES` in `coaches.controller.ts`: Operation Lead + Main
  Administrator + Marketplace & Coaching Ops Manager, per each of their CAN lists in
  SPECIFICATION.md §5.13.2/.3/.4 (all three explicitly grant "approve/reject coach verification" /
  "temp suspend, restore coaching"). Unlike `backend/src/support/`'s finer-grained split, there's
  no role here that can view/manage without also being allowed the rest — don't invent one without
  re-checking the spec.

## Related modules
- `backend/src/listings/` — reuses the `Game` entity/taxonomy; no other coupling (a `Coach` is not
  a kind of `Listing`).
- `backend/src/users/` — 1:1 `userId`; a coach application doesn't change anything on the `User`
  row itself (no `role` flip, matching the "role is still a blunt buyer/seller flag" note in
  `users/CLAUDE.md` — being a coach is orthogonal to that).
- `backend/src/admin/` — `AdminGuard`/`@RequireAdminRole`/`AdminAuditService`, used by every admin
  route here.
- `backend/src/wallet/` — `WalletService.debitForSession`/`releaseCoachEarnings`/
  `refundBuyerForSession`, the session-escrow trio `coaching-sessions.service.ts` calls.
- `backend/src/settings/` — `PlatformSettingsService.getPlatformFeePercent()`, read at booking time
  and snapshotted onto the session, same as `OrdersService#purchase`.
- `backend/src/notifications/` — best-effort `SessionBooked`/`SessionCompleted`/`SessionCancelled`
  notifications, same try/catch-and-log pattern as every other module's `notify()` helper.
- `backend/src/chat/` — read-only entity dependency (not a module import) for Direct messaging's
  "have these two users transacted?" eligibility check, joining `CoachingSession` through `Coach` to
  compare against `coach.userId` — see that module's `CLAUDE.md`. `PublicCoachingSession.coachUserId`
  (2026-09-16) was added specifically so the frontend's "Message the coach" button has a real user
  id to pass to `api.startDirectConversation`, since `coachId` on this type is the `Coach` profile
  id, not a user id — don't confuse the two.
- `packages/shared-types/` — `CoachStatus` (new), reuses the existing `VerificationStatus` enum
  rather than duplicating it. `PublicCoachSummary`/`PublicCoachDetail`/`AdminCoachSummary`/
  `PublicCoachingSession` response shapes. `CoachingSessionStatus` and the three `Session*`
  `WalletLedgerType` values are also new here.
- `frontend/pages/coaching/*.tsx` (public directory/profile/apply) and
  `frontend/pages/admin/coaches.tsx` (staff verification queue) — see `frontend/CLAUDE.md`. No
  frontend yet for the new session-booking backend — see Status.

## Status
`apply`/`findMine`/`browseVerified`/`findPublicById`/`listPendingVerification`/`listAll`/
`approve`/`reject`/`suspend`/`restore` are all implemented and unit-tested (the reapply-reuses-row
behavior, both verification-transition guard clauses, both suspend/restore guard clauses) — 199
backend tests total as of the last update, verified against a real Postgres instance (see root
`CLAUDE.md`'s "Real-database verification" section). Frontend: `frontend/pages/coaching/index.tsx`
(verified-coach directory, filterable by game), `frontend/pages/coaching/[id].tsx` (profile detail
— the "book a session" button is a **visible, disabled placeholder**, same pattern Listings used
for its "buy" button before Orders existed), `frontend/pages/coaching/apply.tsx` (application
form), `frontend/pages/admin/coaches.tsx` (pending-verification queue with approve/reject, plus a
full coach list with suspend/restore for verified coaches).

**Session booking + escrow payment — shipped and fully verified (2026-09-16).**
`apply`/`request`/`complete`/`cancel`/`findMineAsBuyer`/`findMineAsCoach`/`getForParticipant` are
all implemented and unit-tested (16 new tests: every guard clause, the fee-split math, the
INSUFFICIENT_BALANCE translation, both cancel-initiator paths) — 216 backend tests total. Verified
end to end against the real, running Postgres instance, not just unit-tested: applied as a coach,
approved via the real admin flow, booked a real session as a buyer (60 min × 20 WC/hr → exactly 20
WC debited), completed it as the coach (exactly 18 WC released after the 10% platform fee, `pending`
status with a real 7-day `availableAt` hold), booked and cancelled a second session (buyer refunded
in full), and confirmed both through the real Next.js UI, not just curl — including watching the
topbar balance update live after a booking/cancel with no page reload.

**Real bug found and fixed by that verification**: `WalletService.getBalanceSummary()` — the method
`GET /wallet/balance` calls — summed only `WalletLedgerType.OrderRelease` when computing
`totalEarned`/`pendingClearance`/`availableToWithdraw`, so a coach's `SessionRelease` earnings were
silently excluded from their own balance summary even though the WaveCoin really was credited to
`wavecoinBalance`. Fixed by having `sumEntries()` accept multiple ledger types and summing
`[OrderRelease, SessionRelease]` together — see `backend/src/wallet/CLAUDE.md`. Exactly the kind of
bug this repo's real-database verification passes exist to catch; a fake-repo unit test would never
have exercised the real query.

Frontend: `coaching/[id].tsx`'s booking form (date/time/duration/optional message, duration select
shows the live computed price per option) replaces the old disabled placeholder button, and calls
`refresh()` on the cached session before navigating away so the topbar balance doesn't go stale.
`frontend/pages/coaching-sessions/{index,[id]}.tsx` (new — mirrors `orders/index.tsx`/
`orders/[id].tsx`'s `.orders-page-head`/`.order-card` design exactly, no static-prototype reference
of its own) give buyers and coaches a real session list (buyer/coach tabs) and a detail page with
complete/cancel actions, same `refresh()`-after-action treatment.

**Deliberate scope decision, not left open**: no dispute path.
`coaching-session-lifecycle.ts`'s only transitions out of `Scheduled` are `Completed`/`Cancelled` —
there's no `Disputed` state and none of `backend/src/disputes/`'s 3-party chat/evidence/
admin-resolution machinery applies to sessions. For this first version, "either party can cancel
for a full refund while still `Scheduled`" is the accepted substitute — a real dispute system would
need its own evidence/chat/admin-resolution build-out comparable in size to `backend/src/disputes/`
itself, which wasn't justified for a first pass with no real usage data yet. Revisit if session
disputes (e.g. "the coach didn't show up but marked it complete anyway") turn out to be a real
problem in practice.

**Not built — the rest of Phase 11b**, deliberately deferred:
- **Coach quality-score tracking**, session history/upcoming-sessions views (both user- and
  admin-facing), and the "reassign session to a different coach" admin action — all depend on
  sessions existing first.
- **Admin's `Coaching Management` capabilities beyond verification/suspend** (add/remove/edit a
  coach, change a coach's price, cancel/reschedule a session) — some of these (edit profile, change
  price) could be added cheaply on top of what exists; session-related ones need the booking model
  first.

## Subscription perks
`CoachesService.browseVerified` orders `featured_boost` (Seller/Coach plan with `featuredListings`)
ahead of rating and attaches `profileBadge` via one batched `getActivePerksForUsers` per page;
`findPublicById` attaches it for the detail. `CoachingSessionsService.request` uses
`SubscriptionsService.effectiveFeePercent(coach.userId, base)` for the snapshotted fee %.

## 2026-09 directory filters + presence
`GET /coaches` (`BrowseCoachesDto`) gained the prototype filter panel's real filters: `gameIds`
(comma-separated uuids, ≤20), `maxRate` (hourly rate ceiling), `language` (two-letter code matched
against `languages`), `sort` (`rating` default | `price_asc` | `price_desc` | `reviews`; featured
boost still first, then `coach.id` as a stable tiebreak for paging). Invalid values are 400s.
`PublicCoachSummary` now carries `gameSlug`, `languages` (moved up from the detail shape),
`avatarUrl` and `online` — the last is `user.lastSeenAt` within `community/`'s
`ONLINE_WINDOW_MINUTES`; the directory's green avatar dot renders only when it's true (it used to
be always on — a fabricated signal, rule #6). Rank / availability / service-type filters from the
prototype are not built: coaches have no such data.
