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
- `admin-disputes.controller.ts` — `AdminDisputesController` (`@Controller('disputes')`, separate
  from `DisputesController` above — see the first gotcha below for why): `GET disputes` (the
  cross-order open-dispute queue) and `GET disputes/:orderId` (full thread, no participant check)
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
- **`AdminDisputesController` is a *second*, separate controller** (`@Controller('disputes')`
  rather than `DisputesController`'s `@Controller('orders/:orderId/dispute')`) because `GET
  disputes` (the cross-order list) genuinely doesn't fit the order-scoped path — there's no single
  `orderId` to nest it under. `GET disputes/:orderId` lives on this same controller (not
  `DisputesController`) specifically because it skips the participant check `getForOrder` enforces
  — mixing an admin-only, no-ownership-check route onto a controller whose other routes all assume
  "caller is a participant" would be an easy place to introduce a real authz bug later. Both
  routes are `@RequireAdminRole()` (Super Admin only), same gating as `resolve()` below —
  `getForOrderAsAdmin()` exists so a Super Admin's resolve decision can be evidence-informed rather
  than blind by orderId; wider roles (Operation Lead/Main Administrator can "view all" disputes per
  spec) aren't opened up here yet for the same reason `resolve()` stays Super-Admin-only — their
  narrower review/prepare/escalate actions aren't built.
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
- **`resolve()` now has a real route**: `POST orders/:orderId/dispute/resolve`, reached via the
  thin `resolveForOrder(orderId, ...)` lookup wrapper (the controller only has `orderId`, not the
  dispute's own id — every other route on this controller navigates the same way). Guarded by
  `AdminGuard` + `@RequireAdminRole()` — **Super Admin only**, per SPECIFICATION.md §5.13.1: only
  Super Admin's CAN list includes "refund buyer, release funds to seller"; Operation Lead/Main
  Administrator can participate in the dispute workflow but are explicitly barred from approving
  refunds independently, and their narrower review/prepare/escalate actions aren't built (no
  service method exists for them — don't guess at them). `resolve()` itself still does zero role
  checking — the guard is what enforces this, and `resolve()`'s `adminId` param is just whoever the
  guard resolved the caller to. Audit-logged from the controller. **This is the first module in the
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
  lock was needed for this half of the "freeze" the build plan calls for. The other half — "blocks
  withdrawal of tied funds" — now exists too: `backend/src/withdrawals/WithdrawalsService#request`
  queries `Dispute` directly (any non-terminal status blocks a *new* withdrawal request). This is a
  request-time check only, not a standing hold — an existing `Pending`/`Processing` withdrawal
  isn't automatically cancelled if a dispute opens on a *different* order afterward; see
  `withdrawals/CLAUDE.md`'s Status section for that gap.
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
- `backend/src/notifications/` — `DisputeOpened` (to the counterpart) and `DisputeResolved` (to
  both parties), via the same private `notify` helper shape as `backend/src/orders/`.
- `backend/src/storage/` — evidence file persistence, same interface as delivery files/listing
  images.
- `packages/shared-types/` — `DisputeStatus`/`DisputeResolution` enums, `PublicDispute` +
  `PublicDisputeMessage`/`PublicDisputeEvidence` response shapes.
- `backend/src/admin/` — `AdminGuard`/`@RequireAdminRole`/`AdminAuditService`, used by
  `resolve()`'s route. This is the "highest-stakes screen" the build plan calls out (dispute
  resolution touches wallet + order + dispute state together) — read `disputes.service.spec.ts`'s
  `resolve` block before changing anything here.

## Status
`open`/`getForOrder`/`addMessage`/`addEvidence`/`resolve`/`listOpen`/`getForOrderAsAdmin` are all
implemented and unit-tested (guard clauses, the 7-day window, the unique-constraint race, all three
resolution outcomes) — 176 backend tests total as of the last update. Not verified against a live
Postgres transaction (no DB available in the sandbox this was built in). Frontend now covers the
full loop: `frontend/pages/admin/disputes.tsx` lists open disputes (linking into the order detail
page), and `frontend/pages/orders/[id].tsx` shows the buyer/seller "open dispute" form or the
message-thread/evidence panel as before, **plus** a resolve form (three buttons, one per
`DisputeResolution`, gated to `dispute.status === Open` and the viewer's `adminRole === SuperAdmin`)
— that page's dispute-loading logic now falls back to the admin-only `GET disputes/:orderId` route
when the participant-only `getDispute` 403s, so a Super Admin viewing an order they aren't the
buyer/seller of can still see the thread. See `frontend/CLAUDE.md`.
