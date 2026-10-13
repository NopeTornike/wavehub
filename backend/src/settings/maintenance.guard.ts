import { CanActivate, ExecutionContext, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { SESSION_COOKIE_NAME, SessionService } from '../auth/session.service';
import { UsersService } from '../users/users.service';
import { PlatformSettingsService } from './platform-settings.service';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Mutating routes that must keep working during maintenance:
//  - the two BOG server-to-server callbacks — real money has already moved at the bank; dropping
//    the callback would leave a paying customer uncredited (payments/CLAUDE.md);
//  - login/logout — otherwise the admin who needs to switch maintenance mode back off couldn't
//    sign in (a non-admin can still log in but every other write stays blocked).
const EXEMPT_PATHS = new Set(['/payments/bog/callback', '/subscriptions/bog-callback', '/auth/login', '/auth/logout']);

// Global (APP_GUARD) enforcement of `platform_settings.maintenanceMode`: while on, every mutating
// (non-GET/HEAD/OPTIONS) request from anyone who isn't a staff account gets 503 + Retry-After.
// Reads stay available so the site can still render (read-only browsing + a banner). It runs
// before the per-route AuthGuard, so it identifies an admin itself from the session cookie — and
// checks the role against the DB rather than trusting anything in the token.
@Injectable()
export class MaintenanceGuard implements CanActivate {
  constructor(
    private readonly settings: PlatformSettingsService,
    private readonly sessions: SessionService,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const req = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(req.method.toUpperCase())) return true;
    if (!(await this.settings.isMaintenanceMode())) return true;

    const path = req.path.toLowerCase().replace(/\/+$/, '') || '/';
    if (EXEMPT_PATHS.has(path)) return true;

    if (await this.isStaff(req)) return true;

    context.switchToHttp().getResponse<Response>().setHeader('Retry-After', '300');
    const message = 'WaveHub is undergoing scheduled maintenance. Please try again shortly.';
    // `error` carries the human text on purpose: frontend/lib/api.ts shows `data.error` before
    // `data.message`, so this is what a user actually sees when a write is refused.
    throw new ServiceUnavailableException({ statusCode: 503, error: message, message, maintenance: true });
  }

  private async isStaff(req: Request): Promise<boolean> {
    const token = req.cookies?.[SESSION_COOKIE_NAME];
    if (!token) return false;
    try {
      const { sub } = this.sessions.verify(token);
      const user = await this.users.findById(sub);
      return !!user?.adminRole;
    } catch {
      return false;
    }
  }
}
