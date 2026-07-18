import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { UserStatus } from '@wavehub/shared-types';
import { AuthGuard } from './auth.guard';
import { SESSION_COOKIE_NAME } from './session.service';

describe('AuthGuard', () => {
  function build(cookieToken: string | undefined, verifyResult: { sub: string } | Error, statusUser: any) {
    const sessions = {
      verify: jest.fn(() => {
        if (verifyResult instanceof Error) throw verifyResult;
        return verifyResult;
      }),
    } as any;
    const users = { findStatusById: jest.fn(async () => statusUser) } as any;
    const guard = new AuthGuard(sessions, users);

    const request: any = { cookies: cookieToken !== undefined ? { [SESSION_COOKIE_NAME]: cookieToken } : {} };
    const context = { switchToHttp: () => ({ getRequest: () => request }) } as any;

    return { guard, context, request, users };
  }

  it('rejects when there is no session cookie at all', async () => {
    const { guard, context } = build(undefined, new Error('unused'), null);
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an invalid/expired token', async () => {
    const { guard, context } = build('bad-token', new Error('invalid'), null);
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects when the user from the token no longer exists', async () => {
    const { guard, context } = build('good-token', { sub: 'user-1' }, null);
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('rejects a suspended user even with a valid, unexpired token', async () => {
    const { guard, context } = build('good-token', { sub: 'user-1' }, { id: 'user-1', status: UserStatus.Suspended });
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('rejects a banned user even with a valid, unexpired token', async () => {
    const { guard, context } = build('good-token', { sub: 'user-1' }, { id: 'user-1', status: UserStatus.Banned });
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('allows an active user and attaches userId to the request', async () => {
    const { guard, context, request } = build(
      'good-token',
      { sub: 'user-1' },
      { id: 'user-1', status: UserStatus.Active },
    );
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.userId).toBe('user-1');
  });

  it('allows a pending-verification user (verification and login are separate gates)', async () => {
    const { guard, context } = build(
      'good-token',
      { sub: 'user-1' },
      { id: 'user-1', status: UserStatus.PendingVerification },
    );
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
