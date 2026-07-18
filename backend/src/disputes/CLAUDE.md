# disputes

## Purpose
Order-level dispute resolution — a buyer or seller can open a dispute on an order that's paid but
not yet cleanly completed, both sides can discuss and attach evidence, and an admin resolves it to
one of three outcomes wired straight into the wallet and order state machine. Build-plan Phase 8.

## Key files
- `dispute.entity.ts` — `Dispute`: one row per order (`orderId` is `unique`), `status`
  (`DisputeStatus`), and `resolution`/`resolutionNote`/`resolvedBy`/`resolvedAt` (all `null` until
  resolved)
- `dispute-message.entity.ts` — `DisputeMessage`: a separate table from `backend/src/chat/`'s
  `Message` — see that module's gotcha for why these aren't unified
- `dispute-evidence.entity.ts` — `DisputeEvidence`: uploaded files, same `StorageService` interface
  as delivery files/listing images
- `disputes.service.ts` — everything: `open`, `getForOrder`, `addMessage`, `addEvidence`, and the
  admin-only `resolve`
- `disputes.controller.ts` — `/orders/:orderId/dispute[...]` routes, guarded, participant checks
  live in the service (same convention as every other module)
- `dto/open-dispute.dto.ts`, `dto/add-dispute-message.dto.ts`

## Data model
`disputes`, `dispute_messages`, `dispute_evidence` (migration: `CreateDisputesSchema`).
`disputes.orderId` is `UNIQUE` — one dispute per order, enforced at the DB level, not just in
`open()`'s pre-check (see gotcha below). `dispute_messages`/`dispute_evidence` both `ON DELETE
CASCADE` from `disputes`.

## Conventions & gotchas
- **Unlike `backend/src/chat/` (no controller — piggybacks on `OrdersController`), this module has
  its own `DisputesController`.** The reasoning differs: `DisputesService` already depends directly
  on the `Order` repo for its own status-transition logic (open/resolve both read and write order
  status), so there's no dependency-direction reason to avoid a dedicated controller the way there
  was for chat. Don't use this module as a precedent for chat's decision or vice versa — they're
  different tradeoffs, not an inconsistency.
- **`order-lifecycle.ts`'s transition map now includes `Disputed`** — reachable from
  `Paid`/`InProgress`/`Delivered`, resolving to exactly one of `Completed` (release to seller),
  `Refunded` (refund buyer), or `Cancelled` (cancel order). `order-lifecycle.ts` itself has no
  opinion on *who* can drive those transitions — `open()`/`resolve()` here are the only two call
  sites, and each does its own ownership/admin check before calling `assertValidTransition`.
- **`open()`'s gate**: caller must be the order's buyer or seller; order status must be
  `Paid`/`InProgress`/`Delivered`; if `Delivered`, must be within `DISPUTE_WINDOW_DAYS` (7) of
  `deliveredAt`. One dispute per order is enforced by the DB `UNIQUE` constraint, not just the
  pre-check — a race between two concurrent opens on the same order has its loser translated from a
  raw Postgres `23505` into a clean `ForbiddenException`, same pattern as
  `backend/src/reviews/reviews.service.ts#create`.
- **`resolve()` has no HTTP route.** Same built-ahead-of-the-admin-panel pattern as
  `ListingsService.approve`/`.reject` and `ReviewsService.hide`/`.remove`/`.restore` — there's no
  `admin_role` column on `User` yet (build-plan Phase 11), so nothing can actually gate who's
  allowed to call this. The method takes a plain `adminId: string` param the future guarded admin
  controller will supply; it does zero role checking itself. **This is the first module in the
  repo where `WalletService.releaseSellerEarnings`/`refundBuyer` get a second real caller** (the
  first was `OrdersService`) — see `backend/src/wallet/CLAUDE.md`, which had flagged this as the
  expected next caller.
- **`RefundBuyer` and `CancelOrder` resolutions call the exact same wallet method
  (`refundBuyer`)** — they differ only in which terminal order status they land on (`Refunded` vs
  `Cancelled`), and `CancelOrder` additionally restocks an item-type listing (mirrors
  `OrdersService`'s private `cancelOrder`). `RESOLUTION_TARGET_STATUS` in `disputes.service.ts` is
  the one place that resolution→status mapping is defined — don't hardcode it a second time
  anywhere else.
- **A dispute being opened is what "freezes" the order for free** — once `order.status` flips to
  `Disputed`, `OrdersService.autoCompleteDueOrders`'s query (`WHERE status = 'delivered'`) simply no
  longer matches it, so the 72h auto-complete cron can't fire on a disputed order. No extra flag or
  lock was needed for this half of the "freeze" the build plan calls for. The other half —
  "blocks withdrawal of tied funds" — has nothing to block yet, since `backend/src/wallet/` has no
  withdrawal feature (build-plan Phase 9); revisit when that lands.
- **Both `open()` and `resolve()` best-effort-post a notice into the order's regular chat**
  (`backend/src/chat/`'s `ChatService.postSystemMessage`, via a private `postChatNotice` helper
  identical in spirit to `OrdersService`'s own) — "დავა გაიხსნა: ..." / "დავა გადაწყდა: ...". A chat
  failure never blocks the dispute action itself.
- **`DisputeStatus.UnderReview`/`WaitingForEvidence`/`Closed` are defined in
  `@wavehub/shared-types` but nothing in this module ever sets them.** The only status transition
  implemented is `Open → Resolved` (via `resolve()`). Moving a dispute to `UnderReview` or
  `WaitingForEvidence` is inherently an admin action (build-plan Phase 11); `Closed` is left
  ambiguous in the source spec (does it mean "withdrawn without a money-movement decision"?) — not
  guessed at here, same "don't invent rules for a phase that doesn't exist yet" discipline as
  everywhere else in this repo.
- **Evidence upload accepts the same format/size limits as order delivery files**
  (JPG/PNG/WEBP/PDF/ZIP, 20MB) — not listing images' narrower JPG/PNG/WEBP-only, 5MB.

## Related modules
- `backend/src/orders/` — every dispute reads and writes `Order.status`; `order-lifecycle.ts` lives
  there, this module imports it rather than duplicating the transition map.
- `backend/src/wallet/` — `releaseSellerEarnings`/`refundBuyer`, called from `resolve()`.
- `backend/src/chat/` — `ChatService.postSystemMessage`, called best-effort from `open()`/`resolve()`.
- `backend/src/storage/` — evidence file persistence, same interface as delivery files/listing
  images.
- `packages/shared-types/` — `DisputeStatus`/`DisputeResolution` enums, `PublicDispute` +
  `PublicDisputeMessage`/`PublicDisputeEvidence` response shapes.
- Future `backend/src/admin/` (Phase 11) wraps `resolve()` in a guarded route — this is the
  "highest-stakes screen" the build plan calls out (dispute resolution touches wallet + order +
  dispute state together), so when that controller lands, read this module's tests first.

## Status
`open`/`getForOrder`/`addMessage`/`addEvidence`/`resolve` are all implemented and unit-tested
(guard clauses, the 7-day window, the unique-constraint race, all three resolution outcomes) — 119
backend tests total after this module. Not verified against a live Postgres transaction (no DB
available in the sandbox this was built in). Frontend exists too:
`frontend/pages/orders/[id].tsx` shows an "open dispute" form when the order is in a disputable
status and no dispute exists yet, and a dispute panel (status, reason, chat-style message thread,
evidence list + upload) once one does — see `frontend/CLAUDE.md`. No admin resolution UI, since
`resolve()` has no HTTP route yet (see the gotcha above) — that arrives with Phase 11.
