import { OrderStatus } from '@wavehub/shared-types';
import { assertValidTransition, InvalidOrderTransitionError } from './order-lifecycle';

describe('assertValidTransition', () => {
  const valid: Array<[OrderStatus, OrderStatus]> = [
    [OrderStatus.Paid, OrderStatus.InProgress],
    [OrderStatus.Paid, OrderStatus.Cancelled],
    [OrderStatus.InProgress, OrderStatus.Delivered],
    [OrderStatus.InProgress, OrderStatus.Cancelled],
    [OrderStatus.Delivered, OrderStatus.Completed],
    [OrderStatus.Delivered, OrderStatus.InProgress], // revision request
  ];

  it.each(valid)('allows %s -> %s', (from, to) => {
    expect(() => assertValidTransition(from, to)).not.toThrow();
  });

  const invalid: Array<[OrderStatus, OrderStatus]> = [
    [OrderStatus.Paid, OrderStatus.Delivered], // can't skip in-progress
    [OrderStatus.Paid, OrderStatus.Completed],
    [OrderStatus.InProgress, OrderStatus.Completed], // can't skip delivery
    [OrderStatus.Completed, OrderStatus.InProgress], // terminal
    [OrderStatus.Completed, OrderStatus.Cancelled], // terminal
    [OrderStatus.Cancelled, OrderStatus.Paid], // terminal
    [OrderStatus.Delivered, OrderStatus.Cancelled], // no direct cancel path after delivery
    [OrderStatus.Paid, OrderStatus.Disputed], // not wired until Phase 8
    [OrderStatus.Paid, OrderStatus.Refunded], // not wired until Phase 8
  ];

  it.each(invalid)('rejects %s -> %s', (from, to) => {
    expect(() => assertValidTransition(from, to)).toThrow(InvalidOrderTransitionError);
  });

  it('rejects transitions from a status with no outgoing edges at all', () => {
    expect(() => assertValidTransition(OrderStatus.PendingPayment, OrderStatus.Paid)).toThrow();
    expect(() => assertValidTransition(OrderStatus.Expired, OrderStatus.Paid)).toThrow();
  });
});
