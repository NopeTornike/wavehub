import { ForbiddenException } from '@nestjs/common';
import { UserStatus } from '@wavehub/shared-types';
import { VerifiedEmailGuard } from './verified-email.guard';

describe('VerifiedEmailGuard', () => {
  const ctx = (userStatus?: string) => ({ switchToHttp: () => ({ getRequest: () => ({ userStatus }) }) }) as any;
  const guard = new VerifiedEmailGuard();

  it('allows an active (email-verified) account', () => {
    expect(guard.canActivate(ctx(UserStatus.Active))).toBe(true);
  });
  it('rejects a pending_verification account', () => {
    expect(() => guard.canActivate(ctx(UserStatus.PendingVerification))).toThrow(ForbiddenException);
  });
  it('rejects when AuthGuard never ran (no status on the request)', () => {
    expect(() => guard.canActivate(ctx(undefined))).toThrow(ForbiddenException);
  });
});
