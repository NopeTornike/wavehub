import { OrderStatus } from '@wavehub/shared-types';

// The one place order status transitions are validated — same pattern as
// backend/src/listings/listing-lifecycle.ts. Every status change must go through
// `assertValidTransition` first.
//
// `PendingPayment`/`Expired` are deliberately NOT reachable through this map: under the WaveCoin
// payment model, checkout is a single atomic debit-and-create — an Order row is only ever created
// already `Paid`, there's no server-side "awaiting payment" window to expire (see
// backend/src/orders/CLAUDE.md).
//
// `Disputed`/`Refunded` are reachable as of build-plan Phase 8 (Disputes) — a dispute can be
// opened from any "work in flight" state (`Paid`/`InProgress`/`Delivered`, see
// backend/src/disputes/CLAUDE.md for the extra 7-day-since-delivery gate on the `Delivered` case),
// and resolves to exactly one of `Completed` (release to seller), `Refunded` (refund buyer), or
// `Cancelled` (cancel — same status a pre-work buyer cancellation reaches, different path). Every
// one of those three resolution transitions is only ever driven by `backend/src/disputes/
// disputes.service.ts#resolve` — this map allows them structurally, but `order-lifecycle.ts` has
// no opinion on who's allowed to call `assertValidTransition(Disputed, ...)`; that's the caller's
// job (see disputes/CLAUDE.md's ownership/admin gating notes).
const ALLOWED_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  [OrderStatus.Paid]: [OrderStatus.InProgress, OrderStatus.Cancelled, OrderStatus.Disputed],
  [OrderStatus.InProgress]: [OrderStatus.Delivered, OrderStatus.Cancelled, OrderStatus.Disputed],
  [OrderStatus.Delivered]: [OrderStatus.Completed, OrderStatus.InProgress, OrderStatus.Disputed],
  [OrderStatus.Disputed]: [OrderStatus.Completed, OrderStatus.Refunded, OrderStatus.Cancelled],
};

export class InvalidOrderTransitionError extends Error {
  constructor(from: OrderStatus, to: OrderStatus) {
    super(`Cannot transition order from "${from}" to "${to}"`);
  }
}

export function assertValidTransition(from: OrderStatus, to: OrderStatus): void {
  if (!ALLOWED_TRANSITIONS[from]?.includes(to)) {
    throw new InvalidOrderTransitionError(from, to);
  }
}
