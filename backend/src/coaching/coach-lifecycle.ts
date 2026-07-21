import { VerificationStatus } from '@wavehub/shared-types';

// Coach.verificationStatus transitions — a much smaller graph than listing-lifecycle.ts's (no
// Draft/PendingReview split, since a coach application goes straight to Pending on creation).
// Coach.status (Active/Suspended) is a separate, orthogonal axis with only two states and no
// interesting transition rules, so it doesn't get its own map — see CoachesService#suspend/restore.
const ALLOWED_TRANSITIONS: Record<VerificationStatus, VerificationStatus[]> = {
  [VerificationStatus.NotVerified]: [],
  [VerificationStatus.Pending]: [VerificationStatus.Verified, VerificationStatus.Rejected],
  [VerificationStatus.Verified]: [],
  [VerificationStatus.Rejected]: [VerificationStatus.Pending], // reapply
};

export class InvalidCoachVerificationTransitionError extends Error {
  constructor(from: VerificationStatus, to: VerificationStatus) {
    super(`Cannot transition coach verification from "${from}" to "${to}"`);
  }
}

export function assertValidVerificationTransition(from: VerificationStatus, to: VerificationStatus): void {
  if (!ALLOWED_TRANSITIONS[from]?.includes(to)) {
    throw new InvalidCoachVerificationTransitionError(from, to);
  }
}
