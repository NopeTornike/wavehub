# listings

## Purpose
Marketplace listings — both gaming *services* (rank push, coaching, duo play — priced via
`packages`, with a seller-defined requirements form) and simple *item* listings (accounts/skins —
priced directly). Owns the moderation lifecycle (draft → pending_review → active/rejected →
paused). See root `CLAUDE.md` for why both listing types exist under one shared concept.

## Key files
- `listing.entity.ts` — the shared base row every listing has, regardless of type
- `service-details.entity.ts` / `item-details.entity.ts` — 1:1 type-specific extensions (only one
  exists per listing, matching `listing.type`)
- `package.entity.ts` — child rows of a service-type listing only
- `listing-image.entity.ts`, `category.entity.ts`, `game.entity.ts` — supporting tables
- `listing-lifecycle.ts` — `assertValidTransition(from, to)`, the **only** place status transitions
  are validated; every status change anywhere must go through this
- `listings.service.ts` — all business logic: creation, ownership checks, the lifecycle, image
  upload, public browse/detail
- `listings.controller.ts` — routes (see Status below for exactly which admin-side ones don't exist
  yet)
- `dto/` — `CreateListingDto` (one DTO for both listing types, see its own comment for why
  cross-field validation is imperative in the service rather than decorator-based),
  `CreatePackageDto`, `BrowseListingsDto`, `RejectListingDto`

## Data model
`categories`, `games` (fixed taxonomy, seeded by the `CreateListingsSchema` migration itself — see
that migration's `CATEGORIES`/`GAMES` constants, not a separate seed script), `listings`,
`listing_images`, `service_details`, `item_details`, `packages`. All in one migration
(`CreateListingsSchema`) since they landed together as one cohesive schema.

## Conventions & gotchas
- **Every status change goes through `assertValidTransition`** (`listing-lifecycle.ts`). The
  allowed graph: `draft/rejected → pending_review → active/rejected`, `active ⇄ paused`. Don't
  mutate `listing.status` directly anywhere, including in future modules — import and use this.
  `backend/src/orders/orders.service.ts` is the first outside caller (auto-pausing a unique/
  last-unit item listing when it sells out, and un-pausing it if that order is later cancelled) —
  it imports this function under an alias (`assertValidListingTransition`) rather than mutating
  status directly; follow that pattern for any other cross-module listing-status change.
- **`approve`/`reject` now have real HTTP routes** — `POST listings/:id/approve` and
  `POST listings/:id/reject`, guarded by `AdminGuard` + `@RequireAdminRole(MarketplaceCoachingOpsManager)`
  (Super Admin passes any admin-guarded route implicitly — see `backend/src/admin/CLAUDE.md`). The
  role comes straight from SPECIFICATION.md §5.13.4's CAN list, not a guess. Both routes audit-log
  via `AdminAuditService` in the controller, not the service — `ListingsService.approve`/`.reject`
  themselves are unchanged (no actor param), same signatures as before.
- **`findPublicById`/`browseActive` only ever return `Active` listings.** A draft/pending/paused
  listing is 404 to anyone but its owner (who uses `findMine` instead). Don't add a "preview" path
  that bypasses this without deciding who's allowed to see a non-active listing and why.
- **`browseActive` computes `startingPriceWaveCoin` per item** — the listing's own `priceWaveCoin`
  for item-type listings, or the cheapest package's price for service-type listings (which don't
  have their own price). This isn't a stored column; it's one batched `MIN(priceWaveCoin) GROUP BY
  listingId` query over `packages` for the service-type ids in the current page, merged onto each
  item in memory — not N+1 (one extra query per page, not per listing). See
  `packages/shared-types/CLAUDE.md` for the corresponding `PublicListingSummary` field.
- **Ownership is checked on every seller-facing mutation** (`getOwnedListing` — throws
  `ForbiddenException` if `listing.sellerId !== callerId`). Every new seller-facing method must call
  this before touching a listing by id; don't trust an id path param alone.
- **`CreateListingDto` intentionally doesn't use `@ValidateIf` for type-specific required fields**
  (e.g. item needs `priceWaveCoin`, service doesn't). With one DTO covering two listing types,
  decorator-based conditional validation got hard to read quickly — the check is a plain `if` at the
  top of `createDraft` instead. See `listings.service.spec.ts` for the tests covering this branch.
- **Image storage goes through `StorageService`** (`backend/src/storage/`), not directly to disk —
  see that module's doc for why the current implementation isn't production-ready as-is.
- Max 5 images/listing, JPG/PNG/WEBP only, 5MB/file — enforced in `ListingsService.addImage`, not
  just at the multer/interceptor level (interceptor-level limits alone wouldn't produce a clean API
  error, just a raw multipart failure).

## Related modules
- `backend/src/auth/` — every seller-facing route is `AuthGuard`-protected via `@CurrentUserId()`.
- `backend/src/storage/` — image persistence.
- `packages/shared-types/` — `ListingType`, `ListingStatus` enums.
- `backend/src/orders/` — references `listings`/`packages` by id at purchase time (snapshotting
  price/delivery-time onto the `Order`), and drives listing pause/unpause for item sell-outs — read
  that module's doc before changing anything about how a listing's price or stock is read.
- `backend/src/reviews/` — writes `listing.ratingAvg`/`ratingCount` (added by the `CreateReviewsSchema`
  migration) whenever a review is created, hidden, or restored; this module doesn't write those
  columns itself.
- `backend/src/admin/` — `AdminGuard`/`@RequireAdminRole`/`AdminAuditService`, used by the
  `approve`/`reject` routes. `pause` still has no admin route — only the seller-facing
  `pause`/`unpause` exist; an admin-forced pause (distinct from a seller's own) wasn't part of this
  pass, don't assume it exists.

## Status
Seller-facing CRUD (create draft, add packages, add images, submit for review, pause/unpause),
public browse/detail, admin approve/reject, and being purchasable (via `backend/src/orders/`) are
all implemented and unit-tested where the logic doesn't require a live DB (the lifecycle state
machine and the item/service branching in `createDraft`). Not yet built: listing edit after draft
(a submitted/active listing can't currently be revised — only paused, or rejected and resubmitted
from scratch), an admin-forced pause route (see the gotcha above), search/filtering beyond the
basic category/game/type query params (`backend/src/search/` per the build plan is its own future
module). The frontend now has real
`marketplace`/`listings/[id]` pages (`frontend/pages/marketplace.tsx`,
`frontend/pages/listings/[id].tsx`) consuming `browseActive`/`findPublicById` — see
`frontend/CLAUDE.md`. Still no create-listing or checkout pages.
