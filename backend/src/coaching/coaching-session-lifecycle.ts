import { CoachingSessionStatus } from '@wavehub/shared-types';

// Lifecycle v2 (2026-10-02). Money only moves on Completed (escrow → coach) and Cancelled
// (escrow → student):
//   Scheduled ──both confirm the start──▶ InProgress ──coach marks done──▶ AwaitingConfirmation
//   AwaitingConfirmation ──student confirms (or 48h pass)──▶ Completed
//   Scheduled ──either cancels / nobody confirms within the start window──▶ Cancelled
//   InProgress ──coach cancels──▶ Cancelled
// A coach can no longer complete (and get paid for) a session that never started.
//   InProgress / AwaitingConfirmation ──either side opens a dispute──▶ Disputed ──Super Admin──▶
//   Completed (pay the coach) or Cancelled (refund the student)
const S = CoachingSessionStatus;
const ALLOWED_TRANSITIONS: Partial<Record<CoachingSessionStatus, CoachingSessionStatus[]>> = {
  [S.Scheduled]: [S.InProgress, S.Cancelled],
  [S.InProgress]: [S.AwaitingConfirmation, S.Cancelled, S.Disputed],
  [S.AwaitingConfirmation]: [S.Completed, S.Disputed],
  // Only a Super Admin's dispute decision leaves Disputed (coaching-session-disputes.service.ts).
  [S.Disputed]: [S.Completed, S.Cancelled],
};

export class InvalidCoachingSessionTransitionError extends Error {
  constructor(from: CoachingSessionStatus, to: CoachingSessionStatus) {
    super(`Cannot transition coaching session from "${from}" to "${to}"`);
  }
}

export function assertValidSessionTransition(from: CoachingSessionStatus, to: CoachingSessionStatus): void {
  if (!ALLOWED_TRANSITIONS[from]?.includes(to)) {
    throw new InvalidCoachingSessionTransitionError(from, to);
  }
}
