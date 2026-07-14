import { ListingStatus } from '@wavehub/shared-types';
import { assertValidTransition, InvalidListingTransitionError } from './listing-lifecycle';

describe('assertValidTransition', () => {
  const valid: Array<[ListingStatus, ListingStatus]> = [
    [ListingStatus.Draft, ListingStatus.PendingReview],
    [ListingStatus.Rejected, ListingStatus.PendingReview],
    [ListingStatus.PendingReview, ListingStatus.Active],
    [ListingStatus.PendingReview, ListingStatus.Rejected],
    [ListingStatus.Active, ListingStatus.Paused],
    [ListingStatus.Paused, ListingStatus.Active],
  ];

  it.each(valid)('allows %s -> %s', (from, to) => {
    expect(() => assertValidTransition(from, to)).not.toThrow();
  });

  const invalid: Array<[ListingStatus, ListingStatus]> = [
    [ListingStatus.Draft, ListingStatus.Active], // can't skip review
    [ListingStatus.Draft, ListingStatus.Paused],
    [ListingStatus.Active, ListingStatus.Draft], // no going back to draft once live
    [ListingStatus.Active, ListingStatus.PendingReview],
    [ListingStatus.Rejected, ListingStatus.Active], // must go through review again
    [ListingStatus.PendingReview, ListingStatus.Draft],
    [ListingStatus.PendingReview, ListingStatus.Paused],
  ];

  it.each(invalid)('rejects %s -> %s', (from, to) => {
    expect(() => assertValidTransition(from, to)).toThrow(InvalidListingTransitionError);
  });

  it('rejects a same-status no-op transition', () => {
    expect(() => assertValidTransition(ListingStatus.Active, ListingStatus.Active)).toThrow();
  });
});
