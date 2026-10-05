import { ListingStatus } from '@wavehub/shared-types';

// The one place listing status transitions are validated. Every status change — seller-initiated
// or (once Phase 11 lands) admin-initiated — must go through `assertValidTransition` first. Don't
// mutate `listings.status` anywhere without checking this.
const ALLOWED_TRANSITIONS: Record<ListingStatus, ListingStatus[]> = {
  [ListingStatus.Draft]: [ListingStatus.PendingReview],
  // Rejected → PendingReview only: the seller revised and resubmitted. Deliberately NOT → Active —
  // this table also gates the seller's own unpause, so a taken-down listing must never be able to
  // reach Active through it. Staff restore is its own admin-only path (ListingsService#adminRestore).
  [ListingStatus.Rejected]: [ListingStatus.PendingReview],
  [ListingStatus.PendingReview]: [ListingStatus.Active, ListingStatus.Rejected], // admin decision
  // Active/Paused → PendingReview: the seller edited a live (or paused) listing — the change goes
  // back through moderation before anyone can buy the edited version (ListingsService#update).
  // → Rejected from Active/Paused: staff take a live listing down (ListingsService#adminTakeDown);
  // the seller sees the reason and must fix + resubmit — they can't simply unpause it.
  [ListingStatus.Active]: [ListingStatus.Paused, ListingStatus.PendingReview, ListingStatus.Rejected],
  [ListingStatus.Paused]: [ListingStatus.Active, ListingStatus.PendingReview, ListingStatus.Rejected],
};

export class InvalidListingTransitionError extends Error {
  constructor(from: ListingStatus, to: ListingStatus) {
    super(`Cannot transition listing from "${from}" to "${to}"`);
  }
}

export function assertValidTransition(from: ListingStatus, to: ListingStatus): void {
  if (!ALLOWED_TRANSITIONS[from]?.includes(to)) {
    throw new InvalidListingTransitionError(from, to);
  }
}
