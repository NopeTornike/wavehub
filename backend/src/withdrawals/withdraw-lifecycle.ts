import { WithdrawStatus } from '@wavehub/shared-types';

// Same pattern as backend/src/orders/order-lifecycle.ts / backend/src/listings/listing-lifecycle.ts
// — the one place WithdrawRequest status transitions are validated.
const ALLOWED_TRANSITIONS: Partial<Record<WithdrawStatus, WithdrawStatus[]>> = {
  [WithdrawStatus.Pending]: [WithdrawStatus.Processing, WithdrawStatus.Rejected, WithdrawStatus.Cancelled],
  [WithdrawStatus.Processing]: [WithdrawStatus.Completed, WithdrawStatus.Rejected],
};

export class InvalidWithdrawTransitionError extends Error {
  constructor(from: WithdrawStatus, to: WithdrawStatus) {
    super(`Cannot transition withdrawal from "${from}" to "${to}"`);
  }
}

export function assertValidTransition(from: WithdrawStatus, to: WithdrawStatus): void {
  if (!ALLOWED_TRANSITIONS[from]?.includes(to)) {
    throw new InvalidWithdrawTransitionError(from, to);
  }
}
