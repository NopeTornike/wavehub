# coaching

## Purpose
Coach profiles, the public coach directory, and admin verification/suspension. Build-plan Phase
11b. SPECIFICATION.md §5.13.7 is explicit that a **Coach is a structurally separate concept from
Seller/Listing**, not a variant of either — own verification flow, own profile, own
session-based (not order-based) delivery, own quality-score tracking. The original spec only had
"Coaching" as one service *category* under Listings; this module is that parallel concept.

**Deliberately sliced down from the full Phase 11b scope** — this covers profile creation,
verification, the public directory, and admin suspend/restore only. Session booking and payment
are a separate, not-yet-built follow-up; see Status below for exactly why and what it would need.
This mirrors how Listings (Phase 3) shipped before Orders (Phase 4) — profile/catalog first,
money-moving transactions as their own later phase, not bolted on quickly alongside the profile
work.

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

## Data model
`coaches` (migration: `CreateCoaches`). `userId` is `UNIQUE` — one Coach row per user, reused
across reject→reapply cycles rather than creating a new row each time (see `apply()`'s gotcha
below).

## Conventions & gotchas
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
- `packages/shared-types/` — `CoachStatus` (new), reuses the existing `VerificationStatus` enum
  rather than duplicating it. `PublicCoachSummary`/`PublicCoachDetail`/`AdminCoachSummary`
  response shapes.
- `frontend/pages/coaching/*.tsx` (public directory/profile/apply) and
  `frontend/pages/admin/coaches.tsx` (staff verification queue) — see `frontend/CLAUDE.md`.

## Status
`apply`/`findMine`/`browseVerified`/`findPublicById`/`listPendingVerification`/`listAll`/
`approve`/`reject`/`suspend`/`restore` are all implemented and unit-tested (the reapply-reuses-row
behavior, both verification-transition guard clauses, both suspend/restore guard clauses) — 199
backend tests total as of the last update. Not verified against a live Postgres transaction (no DB
available in the sandbox this was built in). Frontend: `frontend/pages/coaching/index.tsx`
(verified-coach directory, filterable by game), `frontend/pages/coaching/[id].tsx` (profile detail
— the "book a session" button is a **visible, disabled placeholder**, same pattern Listings used
for its "buy" button before Orders existed), `frontend/pages/coaching/apply.tsx` (application
form), `frontend/pages/admin/coaches.tsx` (pending-verification queue with approve/reject, plus a
full coach list with suspend/restore for verified coaches).

**Not built — the rest of Phase 11b**, deliberately deferred as its own follow-up chunk rather than
rushed alongside the profile work above:
- **Session booking and scheduling** — no availability/calendar model, no way for a buyer to
  actually request a session with a coach. The static prototype's `coach-book-session.js` (a large
  mock UI) is the closest existing reference for what a real booking flow's shape should look
  like, but nothing there is backed by a real data model yet.
- **Payment** — sessions have no `WalletService` integration at all. `WalletLedgerEntry.orderId`
  is a real FK to `orders(id)`, so wiring session payments in will need either a schema change
  (a nullable `sessionId` column alongside `orderId`, or a shared "chargeable thing" abstraction)
  or routing coaching payments through the existing Order machinery after all — this is a real
  design decision that shouldn't be guessed at inside an unrelated chunk, which is the main reason
  booking/payment was cut from this pass rather than rushed.
- **Coach quality-score tracking**, session history/upcoming-sessions views (both user- and
  admin-facing), and the "reassign session to a different coach" admin action — all depend on
  sessions existing first.
- **Admin's `Coaching Management` capabilities beyond verification/suspend** (add/remove/edit a
  coach, change a coach's price, cancel/reschedule a session) — some of these (edit profile, change
  price) could be added cheaply on top of what exists; session-related ones need the booking model
  first.
