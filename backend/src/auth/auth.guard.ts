import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { UserStatus } from '@wavehub/shared-types';
import { SESSION_COOKIE_NAME, SessionService } from './session.service';
import { UsersService } from '../users/users.service';

// Verifies the session cookie's signature/expiry, then does one lightweight status lookup
// (id + status only, not a full user row) to reject a suspended/banned account immediately rather
// than waiting out the JWT's 7-day expiry — a ban is meaningless if a banned user's existing
// session keeps working. This was a deliberate "not yet" gap (see auth/CLAUDE.md's prior note)
// until admin suspend/ban became a real, reachable action; now that it is, an already-issued
// session must not be able to outlive it. There is still no way to revoke ONE specific session
// early (e.g. "log out this device") — this only catches the suspended/banned case.
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly sessions: SessionService,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = request.cookies?.[SESSION_COOKIE_NAME];

    if (!token) {
      throw new UnauthorizedException('Not authenticated');
    }

    let userId: string;
    try {
      const payload = this.sessions.verify(token);
      userId = payload.sub;
    } catch {
      throw new UnauthorizedException('Session expired or invalid');
    }

    const user = await this.users.findStatusById(userId);
    if (!user || user.status === UserStatus.Suspended || user.status === UserStatus.Banned) {
      throw new ForbiddenException('Account suspended or banned');
    }

    request.userId = userId;
    return true;
  }
}
