# listings

## Purpose
Marketplace listings — gaming *services* (rank push, coaching, duo play — priced via `packages`,
with a seller-defined requirements form), simple *item* listings (accounts/skins — priced
directly), and (2026-09-17) *digital key* listings — a secret, single-use activation code (Steam
key or similar) sold from a per-listing inventory rather than described by a single row. Owns the
moderation lifecycle (draft → pending_review → active/rejected → paused). See root `CLAUDE.md` for
why the listing types exist under one shared concept.

## Key files
- `listing.entity.ts` — the shared base row every listing has, regardless of type. `priceWaveCoin`
  is used directly by both Item and DigitalKey listings (a key's price is fixed per listing, same
  as an item's); `stockQuantity` is Item-only — a DigitalKey listing's "stock" is never stored
  here, see `ListingKeyInventory` below. `resaleRightsAttestedAt` is DigitalKey-only (null for
  Service/Item) — the seller's confirmation, at creation time, that they have the legal right to
  resell these keys (LAUNCH_PLAN.md §2d's compliance ask).
- `service-details.entity.ts` / `item-details.entity.ts` — 1:1 type-specific extensions (only one
  exists per listing, matching `listing.type`). **DigitalKey has no equivalent details table** —
  everything type-specific about a key listing lives in `ListingKeyInventory` instead.
- `listing-key-inventory.entity.ts` — `ListingKeyInventory`: one row per secret key. `listingId`
  FK (cascade), `keyValueEncrypted` (AES-256-GCM ciphertext, see `key-encryption.util.ts` — the
  plaintext is never stored), `status` (`KeyInventoryStatus`: `available`/`sold`/`revoked`),
  `orderId` (nullable, unique — set once sold, never unset), `soldAt`.
- `key-encryption.util.ts` — `encryptKeyValue`/`decryptKeyValue`, standalone and unit-tested
  (`key-encryption.util.spec.ts`) same as `bog-signature.util.ts`/`same-origin.util.ts` elsewhere
  in this codebase. `KEY_ENCRYPTION_SECRET` env var, same required-in-production/insecure-dev-
  fallback pattern as `JWT_SECRET` — see that file's own comment.
- `package.entity.ts` — child rows of a service-type listing only
- `listing-image.entity.ts`, `category.entity.ts`, `game.entity.ts` — supporting tables
- `listing-lifecycle.ts` — `assertValidTransition(from, to)`, the **only** place status transitions
  are validated; every status change anywhere must go through this
- `listings.service.ts` — creation, ownership checks, the lifecycle, image upload, public
  browse/detail, and (new) `addKeys`/`listKeys`/`removeKey` — the seller-facing key-inventory
  management trio. See the gotcha below on what `listKeys` deliberately never returns.
- `listings.controller.ts` — routes, including `POST`/`GET listings/:id/keys` and
  `DELETE listings/:id/keys/:keyId` (see Status below for exactly which admin-side ones don't exist
  yet)
- `dto/` — `CreateListingDto` (one DTO for all three listing types, see its own comment for why
  cross-field validation is imperative in the service rather than decorator-based),
  `CreatePackageDto`, `BrowseListingsDto`, `RejectListingDto`, `AddListingKeysDto` (bulk
  paste-a-list upload, 1–500 keys per call)

## Data model
`categories`, `games` (fixed taxonomy, seeded by the `CreateListingsSchema` migration itself — see
that migration's `CATEGORIES`/`GAMES` constants, not a separate seed script), `listings`,
`listing_images`, `service_details`, `item_details`, `packages`. All in one migration
(`CreateListingsSchema`) since they landed together as one cohesive schema. `listing_key_inventory`
and `listings.resaleRightsAttestedAt` (migration: `CreateDigitalKeys`) came later, alongside
Steam Keys.

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
- **`GET listings/pending-review`** (same role as approve/reject) is the queue those two routes
  act on — `ListingsService.listPendingReview()` returns `AdminListingSummary[]`
  (`@wavehub/shared-types`), a purpose-built projection, not the raw entity — a bare
  `Listing.seller` relation would leak the seller's full `User` row (email, `wavecoinBalance`,
  etc.) into an approval-queue table that has no reason to see it. **Must stay registered before
  `GET listings/:id`** in `listings.controller.ts` — Express matches routes in registration order,
  so `:id` would otherwise swallow `pending-review` as if it were an id. Rendered by
  `frontend/pages/admin/listings.tsx`.
- **Public listing responses project `seller` through `toPublicSeller()`** (id, username, first/last
  name, rating aggregates — exactly the shared `PublicSeller` type). Until the launch-readiness
  pass, `browseActive`/`findPublicById` serialized the joined `User` entity, so every anonymous
  `GET /listings` leaked each seller's **email, WaveCoin balance, admin role and moderation
  reason**. `backend/test/security.e2e-spec.ts` sweeps every response for such fields — keep any new
  read path that joins a user going through a projection like this one.
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
  it validates the file's real type by magic bytes (an HTML file labelled `image/png` is rejected
  with 415) and supports local disk or S3-compatible storage; see that module's doc.
- Max 5 images/listing, JPG/PNG/WEBP only, 5MB/file — enforced in `ListingsService.addImage`, not
  just at the multer/interceptor level (interceptor-level limits alone wouldn't produce a clean API
  error, just a raw multipart failure).
- **`listKeys` never returns the key value, encrypted or plaintext, even to the listing's own
  seller.** Once uploaded, a seller has no way to read a key back through this app — matching real
  key-reseller platforms, and consistent with "keep your own record before pasting it in." The only
  place a plaintext key is ever reconstructed is `OrdersService#getRevealedKey`, for the buyer who
  bought it, exactly once per request (see `backend/src/orders/CLAUDE.md`).
- **`addKeys`/`removeKey` both re-check `listing.type === DigitalKey`** even though only a
  DigitalKey listing's page would ever call them — defense against a seller hitting these routes
  directly against a Service/Item listing id they own.
- **`removeKey` is a soft delete** (`status → revoked`), not a `DELETE` row — its `WHERE` clause
  only ever matches a currently-`available` row, so attempting to "remove" an already-`sold` key
  cleanly 404s instead of silently no-op'ing on the wrong row or, worse, ever touching a sold key's
  row.
- **DigitalKey `stockQuantity` in `browseActive`/`findPublicById`'s response is always a live
  `COUNT(*) WHERE status = 'available'`, batched the same way `startingPriceWaveCoin` is computed
  for service listings** (one extra grouped query per page, not per listing) — never a stored
  column. If you add a new listing read path, don't forget this override or a DigitalKey listing
  will show `stockQuantity: null` from the DB row instead of its real count.

## Related modules
- `backend/src/auth/` — every seller-facing route is `AuthGuard`-protected via `@CurrentUserId()`.
- `backend/src/storage/` — image persistence.
- `packages/shared-types/` — `ListingType` (now three values), `ListingStatus`,
  `KeyInventoryStatus` enums, `SellerListingKeySummary` response shape.
- `backend/src/orders/` — references `listings`/`packages` by id at purchase time (snapshotting
  price/delivery-time onto the `Order`), drives listing pause/unpause for item sell-outs and
  DigitalKey sellouts, and is the only place a key is ever claimed
  (`SELECT ... FOR UPDATE SKIP LOCKED`) or revealed — read that module's doc before changing
  anything about how a listing's price, stock, or key inventory is read.
- `backend/src/reviews/` — writes `listing.ratingAvg`/`ratingCount` (added by the `CreateReviewsSchema`
  migration) whenever a review is created, hidden, or restored; this module doesn't write those
  columns itself.
- `backend/src/admin/` — `AdminGuard`/`@RequireAdminRole`/`AdminAuditService`, used by the
  `approve`/`reject` routes. `pause` still has no admin route — only the seller-facing
  `pause`/`unpause` exist; an admin-forced pause (distinct from a seller's own) wasn't part of this
  pass, don't assume it exists.

## Status
Seller-facing CRUD (create draft, add packages, add images, submit for review, pause/unpause),
public browse/detail, admin approve/reject + the pending-review queue, and being purchasable (via
`backend/src/orders/`) are all implemented and unit-tested where the logic doesn't require a live
DB (the lifecycle state machine and the item/service branching in `createDraft`). The admin queue
is now reachable from a real frontend page (`frontend/pages/admin/listings.tsx`), not just curl.
Not yet built: listing edit after draft
(a submitted/active listing can't currently be revised — only paused, or rejected and resubmitted
from scratch), an admin-forced pause route (see the gotcha above), search/filtering beyond the
basic category/game/type query params (`backend/src/search/` per the build plan is its own future
module). The frontend has real `marketplace`/`listings/[id]` pages consuming
`browseActive`/`findPublicById`, a real checkout button, and (new) real seller-facing pages at
`frontend/pages/sell/digital-keys/{index,[id]}.tsx` for creating and managing DigitalKey listings
specifically — see `frontend/CLAUDE.md`. There is still no generic "create a listing" page for
Service/Item — that gap predates and is broader than Steam Keys, not something this pass closed.

**Digital Key listings (2026-09-17) — shipped and verified against the live Postgres instance**,
including real concurrent-purchase testing, not just curl. See `backend/src/orders/CLAUDE.md`'s
Status section for the full verification writeup (the claim logic lives in `OrdersService#purchase`,
not here) — including a real correctness bug found and fixed during that verification pass. Backend:
`ListingKeyInventory` entity, `key-encryption.util.ts` (unit-tested — round-trip/tamper/malformed-
input coverage), `addKeys`/`listKeys`/`removeKey` (unit-tested — encryption-never-leaks,
ownership, type-gating, and the soft-delete 404 case), `CreateDigitalKeys` migration. Frontend: a
real seller flow (create listing → paste-a-list key upload → submit for review → key inventory
list with remove) and the existing `marketplace`/`listings/[id]`/`orders/[id]` pages extended to
handle the new type (price/stock display, a "final sale, no cancellation" notice, and a
buyer-only key-reveal panel on the order page) — verified end to end in a real two-account
(seller + buyer) browser click-through: created a listing, uploaded 2 keys, submitted, approved as
admin, bought both keys as two separate real purchases, revealed each key (confirmed it matched
exactly what was uploaded), watched the topbar WaveCoin balance update live after each purchase,
and confirmed the listing auto-paused after the last key sold.

**A real, previously-invisible correctness bug was found and fixed by concurrent-purchase testing
during this pass** (not something any unit test with a fake repository could have caught): the
original claim query used `manager.query()` (raw SQL) to run the `SELECT ... FOR UPDATE SKIP
LOCKED` claim, and checked `claimed.length === 0` to detect "no key available." `manager.query()`'s
actual return value for a raw parameterized `UPDATE ... RETURNING` is a 2-element tuple
`[rows, affectedCount]`, not a plain rows array — so `claimed.length` was always `2`, and the
"out of stock" check could never fire, meaning a purchase could succeed (charging the buyer, and
creating a real `paid` order) even when the claim query matched **zero** key rows, leaving an order
with no key ever assigned to it. Fixed by switching to TypeORM's `QueryBuilder`
`.update(ListingKeyInventory).set(...).where(rawSubquery).execute()`, checking the returned
`UpdateResult.affected` (a stable, documented number) instead. Verified correct with a dedicated
Node script issuing 5 genuinely concurrent claims against 3 real rows through the actual connection
pool (exactly 3 succeeded, 2 correctly got `affected: 0`, no double-claims), then re-verified
against the full HTTP `purchase()` path with multiple real concurrent buyers.

**A separate, pre-existing issue was found (not caused by this change; since FIXED 2026-09-22 —
see `backend/src/wallet/CLAUDE.md`, lock-account-first + retry-on-deadlock)**: firing
many truly-simultaneous purchase requests **from the same buyer account** can deadlock on
`WalletService.debitForOrder`'s `SELECT ... FOR UPDATE` lock on that buyer's `users` row (Postgres
error `40P01`, surfaced as a 500). Reproduced identically against an unmodified Item-listing
purchase, confirming it's a general `WalletService`/`OrdersService` locking-strategy gap, not
anything specific to Steam Keys — normal usage (different buyers, or one buyer clicking "buy" once)
never hits it. Flagged as a follow-up rather than fixed here since it needs a real fix across the
whole wallet-locking strategy (e.g. retry-on-deadlock or a different lock ordering), not a
listings/orders-local patch. See `backend/src/wallet/CLAUDE.md`.

## Subscription perk: featured boost
`browseActive` left-joins (quoted aliases) `user_subscriptions`/`subscription_plans` and orders by a
`featured_boost` select ahead of `isFeatured`/`createdAt`, so a seller with an active/past_due
Seller-Coach plan whose `perks.featuredListings` is true sorts first — live, no cached flag. The
`GET users/:username` profile now returns `profileBadge` too. `ListingsModule` imports
`SubscriptionsModule`. See `backend/src/subscriptions/CLAUDE.md`.
