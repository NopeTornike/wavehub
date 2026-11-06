import { createParamDecorator, ExecutionContext, ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { AdminRole, type StaffGameScopes } from '@wavehub/shared-types';

// What a staff member may touch, per area (owner 2026-11-06). Every role except Game Manager is
// unlimited within the routes its role list already lets it reach (null = every game). A Game
// Manager carries the game ids from `users.staffScopes` — an empty list means no access to that
// area at all. AdminGuard attaches this to the request; controllers pass it to the service calls
// that read or change a game's listings / tournaments.
export type StaffArea = 'marketplace' | 'tournaments';
export interface StaffScope {
  marketplaceGameIds: string[] | null;
  tournamentGameIds: string[] | null;
}

export const UNLIMITED_SCOPE: StaffScope = { marketplaceGameIds: null, tournamentGameIds: null };

export function staffScopeFor(adminRole: AdminRole | null, scopes: StaffGameScopes | null | undefined): StaffScope {
  if (adminRole !== AdminRole.GameManager) return UNLIMITED_SCOPE;
  return {
    marketplaceGameIds: [...(scopes?.marketplaceGameIds ?? [])],
    tournamentGameIds: [...(scopes?.tournamentGameIds ?? [])],
  };
}

export function scopeGameIds(scope: StaffScope | undefined, area: StaffArea): string[] | null {
  if (!scope) return null;
  return area === 'marketplace' ? scope.marketplaceGameIds : scope.tournamentGameIds;
}

// Throws unless the scope covers this game. A listing without a game (some services) is outside
// every Game Manager's scope.
export function assertGameInScope(scope: StaffScope | undefined, area: StaffArea, gameId: string | null | undefined): void {
  const ids = scopeGameIds(scope, area);
  if (ids === null) return;
  if (!gameId || !ids.includes(gameId)) {
    throw new ForbiddenException('This game is outside your staff access');
  }
}

// The scope AdminGuard attached. Only valid on AdminGuard routes (like CurrentAdminRole).
export const CurrentStaffScope = createParamDecorator((_: unknown, ctx: ExecutionContext): StaffScope => {
  const request = ctx.switchToHttp().getRequest<Request>();
  return request.staffScope ?? UNLIMITED_SCOPE;
});
