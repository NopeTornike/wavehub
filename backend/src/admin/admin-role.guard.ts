import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AdminRole } from '@wavehub/shared-types';
import { UsersService } from '../users/users.service';
import { ADMIN_ROLES_KEY } from './require-admin-role.decorator';

// Must run AFTER AuthGuard in the same @UseGuards(...) array — it reads `request.userId`, which
// only AuthGuard sets. Unlike AuthGuard (deliberately cheap, no DB lookup per request — see its
// own comment), this guard always loads the fresh user row, since admin actions are far
// lower-traffic than public/buyer/seller routes and a role check that could be stale (e.g. a
// revoked admin still authorized off session-cookie data alone) is a real security gap that
// doesn't apply to AuthGuard's status-check tradeoff.
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<AdminRole[] | undefined>(ADMIN_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (required === undefined) {
      // A route using AdminGuard without @RequireAdminRole(...) is a bug, not "no restriction" —
      // fail closed rather than silently allowing every admin role (or none) through.
      throw new ForbiddenException('This route has no admin role requirement configured');
    }

    const request = context.switchToHttp().getRequest<Request>();
    const userId = request.userId;
    if (!userId) {
      throw new UnauthorizedException('Not authenticated');
    }

    const user = await this.users.findById(userId);
    if (!user || !user.adminRole) {
      throw new ForbiddenException('You do not have permission to perform this action');
    }
    if (user.adminRole !== AdminRole.SuperAdmin && !required.includes(user.adminRole)) {
      throw new ForbiddenException('You do not have permission to perform this action');
    }

    request.adminRole = user.adminRole;
    return true;
  }
}
