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
- **`approve`/`reject` exist on `ListingsService` but have no HTTP route yet.** They're built ahead
  of the admin panel (build-plan Phase 11), same pattern as `WalletService`'s primitives being built
  ahead of Orders. Until Phase 11 adds a guarded admin controller calling these, the only way to
  move a listing from `pending_review` to `active` is a direct DB update or calling the service
  method from a script — this is intentional (nothing goes live without an approval step existing in
  the code, even before there's a UI for it), not an oversight.
- **`findPublicById`/`browseActive` only ever return `Active` listings.** A draft/pending/paused
  listing is 404 to anyone but its owner (who uses `findMine` instead). Don't add a "preview" path
  that bypasses this without deciding who's allowed to see a non-active listing and why.
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
- Future `backend/src/orders/` (Phase 5) will reference `listings`/`packages` by id when a buyer
  purchases — read this doc before wiring that up, especially the ownership-check pattern.
- Future `backend/src/admin/` (Phase 11) wraps `approve`/`reject`/`pause` in guarded routes.

## Status
Seller-facing CRUD (create draft, add packages, add images, submit for review, pause/unpause) and
public browse/detail are implemented and unit-tested where the logic doesn't require a live DB (the
lifecycle state machine and the item/service branching in `createDraft`). Not yet built: listing
edit after draft (a submitted/active listing can't currently be revised — only paused, or rejected
and resubmitted from scratch), the admin-facing HTTP routes for approve/reject/pause (service-layer
methods exist, no controller yet — see the gotcha above), search/filtering beyond the basic
category/game/type query params (`backend/src/search/` per the build plan is its own future module),
and the frontend — no marketplace/listing-detail/create-listing pages exist in `frontend/` yet, only
this backend API.
