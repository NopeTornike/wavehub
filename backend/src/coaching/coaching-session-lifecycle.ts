import { CoachingSessionStatus } from '@wavehub/shared-types';

// A much smaller graph than order-lifecycle.ts's — no InProgress/Delivered split, since a session
// is a single point-in-time event rather than delivered work. `Scheduled` is the only non-terminal
// state; both terminal states (`Completed`/`Cancelled`) are reachable directly from it and neither
// transitions further.
const ALLOWED_TRANSITIONS: Partial<Record<CoachingSessionStatus, CoachingSessionStatus[]>> = {
  [CoachingSessionStatus.Scheduled]: [CoachingSessionStatus.Completed, CoachingSessionStatus.Cancelled],
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
