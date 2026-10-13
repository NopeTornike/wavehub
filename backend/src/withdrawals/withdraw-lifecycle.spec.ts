import { WithdrawStatus } from '@wavehub/shared-types';
import { assertValidTransition, InvalidWithdrawTransitionError } from './withdraw-lifecycle';

describe('assertValidTransition (withdrawals)', () => {
  const valid: Array<[WithdrawStatus, WithdrawStatus]> = [
    [WithdrawStatus.Pending, WithdrawStatus.Processing],
    [WithdrawStatus.Pending, WithdrawStatus.Rejected],
    [WithdrawStatus.Pending, WithdrawStatus.Cancelled],
    [WithdrawStatus.Processing, WithdrawStatus.Completed],
    [WithdrawStatus.Processing, WithdrawStatus.Rejected],
  ];

  it.each(valid)('allows %s -> %s', (from, to) => {
    expect(() => assertValidTransition(from, to)).not.toThrow();
  });

  const invalid: Array<[WithdrawStatus, WithdrawStatus]> = [
    [WithdrawStatus.Pending, WithdrawStatus.Completed], // must go through Processing
    [WithdrawStatus.Processing, WithdrawStatus.Cancelled], // cancel only while still Pending
    [WithdrawStatus.Completed, WithdrawStatus.Rejected], // terminal
    [WithdrawStatus.Rejected, WithdrawStatus.Pending], // terminal
    [WithdrawStatus.Cancelled, WithdrawStatus.Pending], // terminal
  ];

  it.each(invalid)('rejects %s -> %s', (from, to) => {
    expect(() => assertValidTransition(from, to)).toThrow(InvalidWithdrawTransitionError);
  });
});
