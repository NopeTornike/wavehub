# orders

## Purpose
The structural core of the marketplace — the purchase flow, delivery lifecycle, and the only thing
that actually triggers WaveCoin movement between buyer and seller. Reviews, disputes, and seller
payouts (future phases) all hang off an Order existing.

## Key files
- `order.entity.ts` — `Order`: buyer/seller/listing/package refs, a `status` (`OrderStatus`), and
  **snapshots** of everything agreed at purchase time (price, fee, delivery deadline) — never
  re-derived from the live listing/package afterward
- `order-delivery-file.entity.ts` — files a seller attaches when delivering
- `order-lifecycle.ts` — `assertValidTransition(from, to)`, the only place order status transitions
  are validated (same pattern as `backend/src/listings/listing-lifecycle.ts`)
- `requirements-validator.ts` — `validateRequirementsAnswers(schema, answers)`, checks a buyer's
  submitted requirements-form answers against a service listing's required fields at purchase time
- `orders.service.ts` — everything: `purchase`, `startOrder`, `deliverOrder`, `addDeliveryFile`,
  `requestRevision`, `acceptDelivery`, `cancelByBuyer`, `cancelBySeller`, and the 72h
  `autoCompleteDueOrders` cron
- `orders.controller.ts` — all routes guarded, ownership-checked per action (buyer-only vs
  seller-only) inside the service, not the controller

## Data model
`orders`, `order_delivery_files` (migration: `CreateOrdersSchema`, which also adds the `orderId` FK
onto `wallet_ledger_entries` that was left bare when the wallet ledger was built ahead of Orders).
`orderNumber` (e.g. `WH-000123`) comes from a real Postgres sequence (`order_number_seq`) for
gap-minimal, race-free numbering — not a UUID, not app-side counting.

## Conventions & gotchas
- **Checkout is one atomic transaction, not a multi-step payment flow.** Under the WaveCoin payment
  model (see root `CLAUDE.md`), there's no external payment-gateway redirect to wait on — `purchase()`
  creates the `Order` row and calls `WalletService.debitForOrder` **inside the same
  `dataSource.transaction()`**, passing the transaction's `manager` through. If the debit throws
  (insufficient balance), the whole transaction rolls back and the Order row never persists — there
  is deliberately no "pending_payment" order ever visible to anyone. This is why `WalletService`'s
  methods all accept an optional `manager` param (see `backend/src/wallet/CLAUDE.md`).
  `OrderStatus.PendingPayment`/`Expired` exist in `@wavehub/shared-types` but are unreachable in
  `order-lifecycle.ts` on purpose — there's no server-side "awaiting payment" window to expire.
- **`Order` always references TWO lifecycle state machines that must stay in sync manually**: its
  own (`order-lifecycle.ts`) and, for item-type orders, the listing's (`listing-lifecycle.ts`) when
  a unique/last-unit item sells out (auto-`Paused`) or a cancelled order restores it (back to
  `Active`). Both call sites in `orders.service.ts` go through `assertValidListingTransition` (an
  aliased import of the listings module's `assertValidTransition`) — never mutate `listing.status`
  directly here.
- **Item vs service purchase differ in what's required**: service needs `packageId` (price/delivery
  come from the `Package`) and validates `requirementsAnswers` against the listing's
  `ServiceDetails.requirementsSchema`; item needs no package, prices itself directly, and checks
  `stockQuantity`. See `purchase()`'s branch — don't add a third listing-type branch without also
  updating `listings/CLAUDE.md`'s "shared base" note.
- **Both listing types currently go through the same `Paid → InProgress → Delivered → Completed`
  flow**, even though "in progress" is a somewhat artificial step for an item sale (there's no real
  "work" to start). This was a deliberate simplification to avoid building a second state machine
  before there's real usage data suggesting item orders need different treatment — revisit if it
  turns out awkward in practice.
- **Platform fee is a hardcoded 10% constant** (`DEFAULT_PLATFORM_FEE_PERCENT` in
  `orders.service.ts`), snapshotted onto each order (`platformFeePercentSnapshot`) so a later rate
  change never retroactively changes historical orders' math. Becomes admin-configurable in
  build-plan Phase 11 (Platform Settings) — when that lands, read the rate from wherever that phase
  stores it instead of this constant, but keep snapshotting it per-order.
- **`listing.ordersCount` increments on order *completion*, not on purchase** — it's meant to reflect
  "orders completed" (what marketplace cards show per the spec), not "orders placed." Don't move this
  increment earlier.
- **The 72h auto-complete cron (`@Cron('0 * * * *')`) runs hourly**, not continuously — a 72h window
  doesn't need per-minute precision. It's a single in-process `@nestjs/schedule` job; if this backend
  ever runs as more than one instance, add a distributed lock before scaling out, or every instance
  will try to auto-complete the same due orders redundantly (harmless today since
  `releaseSellerEarnings`/order-save aren't idempotent against a second call on an
  already-`Completed` order — `assertValidTransition` would just throw and the cron logs it — but
  still wasteful and worth fixing properly if/when multi-instance happens).
- **Revision history is a single field, not a log.** `order.revisionReason` holds only the latest
  request; a full per-revision history belongs to Order Chat (build-plan Phase 6) once it exists —
  don't build a parallel `order_revisions` table for this now.
- **Delivery files accept a broader format set than listing images** (JPG/PNG/WEBP/PDF/ZIP, 20MB —
  matching the source spec's file-upload spec for order/chat context) vs listings' JPG/PNG/WEBP-only,
  5MB. Don't unify these two limits without checking both specs again.
- **Buyer cancellation is only allowed from `Paid`** (before the seller starts work) — enforced with
  an explicit status check in `cancelByBuyer` *in addition to* `assertValidTransition`, since the
  state machine alone would also structurally allow other buyer-initiated-shaped cancellations if
  called wrong; the extra check is deliberate belt-and-suspenders for a money-moving action, not
  redundant.
- **`WalletService.debitForOrder`'s `INSUFFICIENT_BALANCE`/`USER_NOT_FOUND` are plain `Error`s, not
  `HttpException`s** — `purchase()` catches `INSUFFICIENT_BALANCE` specifically and rethrows as
  `ForbiddenException` so a real buyer sees a clean 4xx instead of an unhandled 500 (found and fixed
  while wiring the frontend checkout flow — nothing had ever exercised this path with a real
  insufficient-balance buyer before). Any other error from the wallet call still propagates
  unmodified (real bug, should 500).
- **`findMineAsBuyer`/`findMineAsSeller`/`findForParticipant` return `PublicOrderSummary`/
  `PublicOrderDetail` (from `@wavehub/shared-types`), not bare `Order` rows** — joins
  `listing`/`package`/`buyer`/`seller` (same N+1-avoidance reasoning as
  `ListingsService#browseActive`) and, for the detail call, a separate `deliveryFiles` query. The
  private `toSummary(order)` mapper is the one place that shapes an `Order` entity into the public
  response — update it (and the matching shared-types interface) together if either changes.

## Related modules
- `backend/src/wallet/` — every money-moving action here (`debitForOrder`, `releaseSellerEarnings`,
  `refundBuyer`) goes through it, always composed into this module's own transaction via the
  `manager` param.
- `backend/src/listings/` — the listing/package data this module reads at purchase time, and the
  listing lifecycle this module drives for item sell-outs/restocks.
- `backend/src/storage/` — delivery file persistence, same interface as listing images.
- `backend/src/auth/` — every route is `AuthGuard`-protected; ownership (`buyerId`/`sellerId` match)
  is checked in the service layer, not the controller.
- `backend/src/reviews/` gates review creation on `order.status === Completed` and denormalizes
  `listingId`/`sellerId` from the order onto each review.
- Future `backend/src/disputes/` (Phase 8) will extend `order-lifecycle.ts`'s transition map to
  reach `Disputed`/`Refunded` — those targets exist in the enum but aren't wired here on purpose;
  don't guess at dispute rules in this module.

## Status
Full purchase-to-completion flow implemented and unit-tested at the validation/lifecycle layer
(guard clauses, state machine, requirements validation, and now the INSUFFICIENT_BALANCE
translation) — 90 backend tests total after this update. Not verified against a live Postgres
transaction (no DB available in the sandbox this was built in — see the migration's own notes and
`backend/src/wallet/CLAUDE.md`'s equivalent caveat). Frontend now exists: checkout is wired from
`frontend/pages/listings/[id].tsx` (including the requirements-form for service listings), an order
list at `frontend/pages/orders/index.tsx` (buyer/seller tabs), and an order detail/actions page at
`frontend/pages/orders/[id].tsx` (start/deliver/accept/revision/cancel + delivery-file upload +
leave-a-review once completed) — see `frontend/CLAUDE.md`. Still deferred: dispute integration,
per-revision history, admin-configurable fee rate, multi-instance-safe cron.
