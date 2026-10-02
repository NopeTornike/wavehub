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

## 2026-09-24 profiles, reviews, favourites (docs/design-mockups 06/14)
Migration `1784355000000-CoachProfilesReviewsFavorites`.
- **Coach-entered profile content**: `rank`, `videoUrl` (YouTube/Vimeo `https://` only —
  `COACH_VIDEO_URL`), `quote`, `coachingStyle` (≤6 × 2–60 chars), `extraGameIds` (≤4, must exist,
  main game dropped). `GET/PATCH coaches/mine/profile` (`UpdateCoachProfileDto`; languages are
  two-letter codes, ≤6 — `ApplyCoachDto` now enforces the same). Frontend `/coaching/profile`.
- **Session reviews** (`coaching-session-review.entity.ts`, `coaching_session_reviews`, unique per
  session, rating 1–5 CHECK): `POST coaching-sessions/:id/review` (buyer only, completed only, once →
  409), `GET coaching-sessions/:id/review` (participants), `GET coaches/:id/reviews` (public, buyer
  username only). Creating one recomputes `coaches.ratingAvg/ratingCount` in the same transaction
  with the coach row locked — these columns were never populated before.
- **Favourites** (`coach_favorites`): `GET me/coach-favorites/ids`, `POST/DELETE coaches/:id/favorite`
  (idempotent).
- **Computed facts** on the public shapes: `completedSessions`; detail `stats` (distinct students,
  completed sessions, success rate = completed / (completed + cancelled)); `responseMinutes` —
  median minutes to answer a new message in the coach's order + direct chats over 90 days (SQL with
  `lag()` turns + `LATERAL` first reply; null below 3 samples); `waveScore` = the coach account's
  community Wave rank / 10 (CoachingModule imports CommunityModule). `userId` is on the summary for
  "Message Coach" (same exposure as `PublicSeller.id`).
- Frontend tags only when earned: "Fast Responder" (median ≤10 min), "Top Rated" (≥4.8 from ≥5
  reviews). Tests: `test/coach-profiles.e2e-spec.ts`.

## 2026-10-01 packages, pre-booking questions, uploaded video, staff-managed coaches
Migration `1784360000000-CoachPackagesVideo` (runs on boot).
- **Packages** (`coach-package.entity.ts`, `coach_packages`, ≤6 per coach, name 2–60, description
  ≤300, 15–480 min, 1–100000 GEL — DB CHECKs mirror the DTO): `PUT coaches/mine/packages` replaces
  the whole list in order (`SetCoachPackagesDto`). Public on `PublicCoachDetail.packages`.
- **Booking from a package**: `BookSessionDto.packageId` (must belong to that coach) takes the
  package's duration and price instead of `durationMinutes` × hourly rate. The session snapshots
  `packageName`; `packageId` is `ON DELETE SET NULL`, so editing packages never rewrites history.
- **Pre-booking questions**: `coaches.bookingQuestions` (jsonb, `RequirementField[]`, ≤10 — the same
  shape and validator as service-listing buyer questions, `booking-questions.ts`), edited through
  `PATCH coaches/mine/profile { bookingQuestions }`. Answers are validated on booking and stored on
  `coaching_sessions.answers`; only the session's participants see them (`/coaching-sessions/[id]`).
- **Uploaded intro video**: `POST coaches/mine/video` (multipart `file`, `StorageService` kind
  `'video'` — byte-sniffed MP4/WebM, `MAX_COACH_VIDEO_BYTES` 50MB, `UPLOAD_THROTTLE`) →
  `coaches.videoFileUrl`; `DELETE coaches/mine/video` clears it. When set it replaces the
  YouTube/Vimeo `videoUrl` on the public profile. Caddy's `request_body` cap was raised to 55MB for
  this (`deploy/Caddyfile` — reload Caddy after deploying).
- **Staff add / edit coaches** (`COACH_MANAGEMENT_ROLES` = Operation Lead, Main Administrator,
  Marketplace & Coaching Ops Manager, plus Super Admin; every mutation audit-logged as
  `coach.create|update|set_packages|set_video|clear_video`): `POST admin/coaches`
  (`AdminCreateCoachDto` — an existing **active** account by username becomes a verified, active
  coach; a pending/rejected application of that account is verified with these details; an already
  verified coach → 409), `GET/PATCH admin/coaches/:id/profile` (same `UpdateCoachProfileDto` as the
  coach's own), `PUT admin/coaches/:id/packages`, `POST/DELETE admin/coaches/:id/video`.
- Frontend: the coach edits all of it on `/coaching/profile`; staff on Admin → Coaches ("ქოუჩის
  დამატება" form + per-coach "რედაქტირება" panel) — both use `components/CoachExtras.tsx`.
  `/coaching` now shows a visible "გახდი ქოუჩი" button in its header (it was a link buried in the
  subtitle and production showed no applications).
- Tests: `test/coach-admin.e2e-spec.ts` (staff-only create, package/question bounds for coach and
  staff, video MP4/WebM-only + served inline, booking a package charges its price and stores the
  answers for participants only).

## 2026-10-02 Lifecycle v2 + the 6-step booking (client feedback)
Migration `1784362000000-CoachingLifecycle`. **The coach can no longer complete (and get paid
for) a session that never happened** — client bug #7.
- **Statuses** (`coaching-session-lifecycle.ts`): `scheduled → in_progress → awaiting_confirmation →
  completed`, and `scheduled|in_progress → cancelled`. Money moves only on `completed` (escrow →
  coach, 7-day hold) and `cancelled` (escrow → student).
- **Start**: `POST coaching-sessions/:id/confirm-start`, either side, from 15 min before
  (`START_EARLY_MINUTES`) until 60 min after (`START_GRACE_MINUTES`) the scheduled time; both →
  `in_progress`. **Finish**: `POST …/complete` (coach, only `in_progress`) → `awaiting_confirmation`;
  `POST …/confirm-complete` (student) → `completed` + payout. The student can cancel only while
  `scheduled`; the coach also while `in_progress` (full refund).
- **Sweep** `@Cron('*/2 * * * *') sweepCron → sweep(now)` (public for e2e):
  - "starting soon" plus reminders every 10 min (`REMINDER_EVERY_MINUTES`) to whoever hasn't
    confirmed the start;
  - after the start window → cancel + refund + notify both;
  - `awaiting_confirmation` older than 48h (`AUTO_CONFIRM_HOURS`) → auto-complete.
  - Each change re-checks under the row lock (`lockAndRevalidate`), so a user action at the same
    moment can't double-pay or double-refund.
- **Notifications** — natural Georgian with Tbilisi times (`formatSessionTime`); EN patterns live in
  `frontend/lib/i18n-ka-en.app.json`:
  - booking: the student and the coach (#6);
  - "confirm start", plus the other side confirmed;
  - started;
  - coach marked done → student asked to confirm; coach told it's waiting (#5);
  - completed → coach told the payout **and the fee %/amount** (#9); student asked for a review (#4);
  - cancelled / auto-cancelled.
- **6-step booking**: `POST coaches/:id/bookings` (`BookSessionsDto`):
  - single session (`durationMinutes`) or a package (`packageId`, now with `sessionsCount` 1–10)
    with exactly that many `slots`;
  - `goal` (5–500, required), `challenges` (≤300), `discord` (required), `answers`;
  - one escrow debit per session; a package total is split over its sessions (remainder on the
    first); sessions share a `bookingGroupId`;
  - **no double-booking**: the coach row is locked and overlapping `scheduled|in_progress|awaiting`
    sessions → 409.
- `GET coaches/:id/busy` → `{start,end}[]` for the booking calendar (times only).
- `PublicCoachingSession` gained:
  - `goal`/`challenges`/`discord`/`bookingGroupId`;
  - the confirmation timestamps;
  - `startDeadline`/`autoConfirmAt`;
  - `platformFeePercent`/`platformFeeWaveCoin`/`coachPayoutWaveCoin` (participants only).
- `GET coaching-sessions/:id/review` now answers `{ review }` — a bare `null` sent an empty body that
  the frontend read as "already reviewed" and hid the form (client bug #3).
- e2e: `test/coaching-lifecycle.e2e-spec.ts`; `test/flows.ts#startSession/completeSession`.
  `coaching.e2e-spec.ts` books distinct slots (overlaps are refused now).

## 2026-10-02 Working hours (`coaches.availability`)
- **Shape** (`CoachAvailability` in `@wavehub/shared-types`): `weekly` ranges
  (`{ day 0–6, from, to }` in minutes after **Tbilisi** midnight, 30-minute steps, never crossing
  midnight), `daysOff` (`YYYY-MM-DD`, Tbilisi dates) and `noticeHours` (0–72). jsonb column, migration
  `CoachAvailability1784363000000`. **`NULL` = not set** → `DEFAULT_COACH_AVAILABILITY` (every day
  10:00–24:00, 1 hour's notice). `PublicCoachDetail.availability` always carries the effective hours;
  `MyCoachProfile.availability` is `null` until set (so the editor can say "default schedule").
- **One rule set, both sides**: the pure helpers live in shared-types — the booking calendar offers
  `coachAvailabilityStarts(...)` and `CoachingSessionsService#book` rejects every slot for which
  `coachAvailabilityProblem(...)` is non-null (400: notice / 60-day horizon
  (`COACH_BOOKING_HORIZON_DAYS`) / outside hours or a day off). Change the rules there, never in one
  side only. A session may run past midnight only if the next day's hours continue from 00:00.
- **Editing**: `availability` on `UpdateCoachProfileDto` (`CoachAvailabilityDto`), so the coach's own
  `PATCH coaches/mine/profile` and the staff edit route both accept it; `null` resets to the default.
  `normalizeAvailability` (coaches.service.ts) sorts and rejects non-30-minute steps, `from >= to`,
  same-day overlaps and invalid dates.
- Timezone is fixed UTC+4 (no DST in Georgia) — `tbilisiLocal`/`tbilisiInstant`; nothing uses the
  server's or the browser's zone.
- **Notifications**: `coach_approved` (on verify and on staff-created/re-activated coaches) and
  `coach_rejected` (with the reason) via `NotificationsService#tryEmit`.
- e2e: `coaching-lifecycle.e2e-spec.ts` (validation, inside/outside hours, day off, notice, horizon,
  past-midnight, reset to default); the other coaching specs call `helpers.ts#openAllHours` first so
  their fixed slots stay bookable.

## 2026-10-02 Platform packages (owner spec), session clock + auto-end (client launch fixes)
Migration `1784371000000-CoachingPackages`.
- **Packages are the platform's, not the coach's** (owner spec "WaveHubX Coaching Packages —
  Developer UI / Content Specification"): `coaching-package.entity.ts` → `coaching_packages`
  (`key` starter|growth|elite, `name`, `sessionsCount` 1–10, `durationMinutes` 15–480,
  `priceWaveCoin` whole GEL, `tagline` (the bold question), `description`, `features` jsonb
  bullets, `sortOrder`, `active`). Seeded: STARTER 1×40 19₾, GROWTH 3×50 39₾, ELITE 6×60 69₾ with
  the spec's copy. **Elite**: the spec's summary and bullets say 6 sessions, one title line said 5 —
  6 was used; change it on Admin → Coaching packages if the owner confirms 5.
- Every verified coach offers the active packages: `PublicCoachDetail.packages` comes from
  `CoachingPackagesService.listActive()`; booking a `packageId` takes `getActive()` (inactive → 404).
  The per-coach `coach_packages` table, `PUT coaches/mine/packages` and
  `PUT admin/coaches/:id/packages` are gone (404); booked sessions keep their `packageName`
  snapshot (their `packageId` was cleared — it pointed at the dropped table).
- Routes (`coaching-packages.controller.ts`): `GET coaching-packages` (public),
  `GET admin/coaching-packages` (`COACH_MANAGEMENT_ROLES` + Super Admin),
  `PATCH admin/coaching-packages/:id` (**Super Admin only** — prices are money; audit-logged
  `coaching_package.update` with before/after).
- The single hourly session stays in the API (`durationMinutes` × hourly rate) and is the booking
  page's fallback only when no package is active.
- **Session clock** (client bug "pressed Start, it still says 15 minutes before"): the start window
  was timed on the device clock; a phone with a wrong clock showed a Start button the server then
  refused (409s in production logs). `PublicCoachingSession.serverNow` lets the page time everything
  on the server's clock.
- **Auto-end** (client: "when the time is over the end isn't confirmed"): the sweep moves an
  `in_progress` session to `awaiting_confirmation` `END_GRACE_MINUTES` (15) after its booked end and
  asks the student to confirm (`sweep()` returns `autoEnded`). `complete()` and the sweep share
  `markDone()`.
- Tests: `coach-admin.e2e-spec.ts` (spec values, staff-only edit, deactivation, snapshot on rename),
  `coaching-lifecycle.e2e-spec.ts` (Growth booking split 13/13/13, auto-end, `serverNow`).
