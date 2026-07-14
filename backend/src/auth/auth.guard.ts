import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { SESSION_COOKIE_NAME, SessionService } from './session.service';

// Verifies the session cookie's signature and expiry only — it does not re-check the user's
// current status (active/suspended/banned) against the database on every request, to keep guarded
// requests cheap. Endpoints that need up-to-date status (e.g. GET /auth/me) load the fresh user row
// themselves. If real-time revocation (e.g. "log this user out now") becomes a requirement, that's
// the point to add a lookup here — not before, since it adds a DB round-trip to every request.
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly sessions: SessionService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const token = request.cookies?.[SESSION_COOKIE_NAME];

    if (!token) {
      throw new UnauthorizedException('Not authenticated');
    }

    try {
      const payload = this.sessions.verify(token);
      request.userId = payload.sub;
      return true;
    } catch {
      throw new UnauthorizedException('Session expired or invalid');
    }
  }
}
