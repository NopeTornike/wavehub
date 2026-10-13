import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { UserStatus } from '@wavehub/shared-types';

// Non-negotiable rule #4 (root CLAUDE.md): email verification is required before an account is
// fully active. AuthGuard only proves "who" (registration auto-logs-in a `pending_verification`
// account); this guard is the second gate — layered AFTER AuthGuard on money-moving / marketplace-
// mutating routes so an unverified account can browse and verify but not transact. Relies on
// AuthGuard having already set `request.userStatus`, so it must always be listed after it.
@Injectable()
export class VerifiedEmailGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.userStatus !== UserStatus.Active) {
      throw new ForbiddenException('Please verify your email address before doing this');
    }
    return true;
  }
}
