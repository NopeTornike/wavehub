# reviews

## Purpose
Buyer reviews of completed orders, plus the seller-facing rating aggregates shown across the
marketplace. One review per order, gated on the order actually being `Completed`.

## Key files
- `review.entity.ts` — `Review`: `orderId` is `UNIQUE` (one review per order, enforced at the DB
  level), `listingId`/`sellerId` denormalized from the order for fast per-listing/per-seller
  queries, `rating` (1-5), optional `body` + fixed-vocabulary `tags`, `status`
  (`published|hidden|reported|deleted`), a single `sellerReply`
- `review-report.entity.ts` — `ReviewReport`: any user can file one against a review
- `reviews.service.ts` — `create` (gates on order ownership + `Completed` status + the DB unique
  constraint), `reply` (seller-only, once), `report`, `findForListing` (sort: newest/highest/
  lowest), and admin-only `hide`/`remove`/`restore` (now real guarded routes — see the gotcha below)
- `dto/create-review.dto.ts` — also exports `REVIEW_TAGS`, the fixed tag vocabulary from the source
  spec (Fast Delivery, Good Communication, Friendly, Professional, Highly Skilled, Recommended)

## Data model
`reviews`, `review_reports` (migration: `CreateReviewsSchema`, which also adds `ratingAvg`/
`ratingCount` to `listings` and `sellerRatingAvg`/`sellerRatingCount` to `users` — see the gotcha
below on why they live there). `reviews.orderId` has a `UNIQUE` constraint and a `CHECK (rating
BETWEEN 1 AND 5)` — both enforced by Postgres, not just app-layer validation.

## Conventions & gotchas
- **"One review per order" is a DB constraint, not just a service-layer check.** `create()` does
  check first, but the real guarantee is the `UNIQUE` constraint on `reviews.orderId` — a
  Postgres `23505` unique-violation error is caught and translated into a clean
  `ForbiddenException`. This closes the race where two concurrent requests for the same order both
  pass the app-layer check before either has committed. Follow this pattern (check-then-DB-
  constraint-as-backstop) for any other "at most once" rule; don't trust the app-layer check alone.
- **Rating aggregates live on `Listing.ratingAvg`/`ratingCount` and `User.sellerRatingAvg`/
  `sellerRatingCount`, not on a `seller_profiles` table** — that table doesn't exist yet (see
  build-plan schema notes). Putting seller-level rating fields on `User` is a pragmatic stopgap,
  same precedent as `wavecoinBalance` living there — move both to `seller_profiles` together if/when
  that table gets built, don't duplicate the fields onto both.
- **Both aggregates are recomputed with a fresh `AVG()`/`COUNT()` query** inside the same transaction
  as the write that changed them (new review, or an admin hide/restore), not incremented/decremented
  in place. Simpler and self-correcting (a stray inconsistency can't compound), at the cost of an
  extra query per write — fine at this scale, reconsider only if review volume ever makes this a
  real hot path.
- **`ratingAvg` columns are `numeric(3,2)`, typed as `string | null` in TypeScript** — this is
  deliberate (TypeORM's standard pattern for `numeric` columns, avoiding float-precision surprises),
  not a bug. Don't "fix" it to `number`.
- **`hide`/`remove`/`restore` now have real routes**: `POST reviews/:id/hide` and `.../restore` are
  guarded by `AdminGuard` + `@RequireAdminRole(OperationLead, MarketplaceCoachingOpsManager,
  TrustSafetyOfficer)` (all three explicitly have "hide" in SPECIFICATION.md §5.13's CAN lists);
  `.../remove` (permanent delete) is `@RequireAdminRole()` — Super Admin only, since only its CAN
  list uses the word "delete." Audit-logged from `reviews.controller.ts`, not the service — the
  service methods themselves take no actor param, unchanged. All three recompute both rating
  aggregates, since the aggregate query only counts `status = 'published'` reviews.
- **`report()` immediately flips the review to `Reported` status** on the first report — there's no
  threshold. This matches the source spec's status list but means a single bad-faith report hides a
  review from aggregate-affecting queries until an admin acts on it (`hide`/`restore` — no separate
  reports-queue view exists yet, see Status). If this turns out to be abusable, the narrow fix is
  not flipping status until N reports or an admin action, not rearchitecting this file.

## Related modules
- `backend/src/orders/` — `create()`'s only real dependency: an order must exist, belong to the
  caller, and be `Completed`.
- `backend/src/listings/` — `Listing.ratingAvg`/`ratingCount` written here, read there (and by
  marketplace browse/search once that exists).
- `backend/src/users/` — `User.sellerRatingAvg`/`sellerRatingCount` written here.
- `backend/src/notifications/` — `ReviewPosted`, best-effort, chained after `create()`'s
  transaction resolves (not inside it — see `notifications/CLAUDE.md`).
- `packages/shared-types/` — `ReviewStatus` enum.
- `backend/src/admin/` — `AdminGuard`/`@RequireAdminRole`/`AdminAuditService`, used by
  `hide`/`remove`/`restore`. No reports-queue view over `review_reports` exists yet — an admin has
  no way to browse pending reports, only to act on a review by id once they know it's reported.

## Status
Create/reply/report/browse/admin-moderate are implemented and unit-tested (guard clauses,
duplicate-review race-safety via the DB constraint, reply-once enforcement) — 127 backend tests
total as of the last update. Not verified against a live Postgres transaction (no DB available in
the sandbox this was built in). Frontend now exists: `frontend/pages/listings/[id].tsx` displays a
listing's reviews (sortable), and `frontend/pages/orders/[id].tsx` shows a submission form once an
order is `Completed` and the viewer is the buyer — it doesn't pre-check "have I already reviewed
this order,"
it just lets the backend's `orderId` unique constraint reject a second attempt with a clear error.
No seller-reply UI yet (reply is backend-only so far), and no admin moderation UI either — the
`hide`/`remove`/`restore` routes work but nothing in `frontend/` calls them. Still no
reports-queue view.
