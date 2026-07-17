import { OrderStatus } from '@wavehub/shared-types';

// The one place order status transitions are validated — same pattern as
// backend/src/listings/listing-lifecycle.ts. Every status change must go through
// `assertValidTransition` first.
//
// `PendingPayment`/`Expired` (from @wavehub/shared-types) are deliberately NOT reachable through
// this map: under the WaveCoin payment model, checkout is a single atomic debit-and-create — an
// Order row is only ever created already `Paid`, there's no server-side "awaiting payment" window
// to expire (see backend/src/orders/CLAUDE.md). `Disputed`/`Refunded` are also not reachable here
// yet — build-plan Phase 8 (Disputes) extends this map when it lands; don't guess at those rules
// now for a module that doesn't exist.
const ALLOWED_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  [OrderStatus.Paid]: [OrderStatus.InProgress, OrderStatus.Cancelled],
  [OrderStatus.InProgress]: [OrderStatus.Delivered, OrderStatus.Cancelled],
  [OrderStatus.Delivered]: [OrderStatus.Completed, OrderStatus.InProgress],
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
