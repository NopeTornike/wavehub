import { SetMetadata } from '@nestjs/common';
import type { AdminRole } from '@wavehub/shared-types';

export const ADMIN_ROLES_KEY = 'adminRoles';

// SuperAdmin always passes regardless of what's listed here (see AdminGuard) — per
// SPECIFICATION.md §5.13, Super Admin has unrestricted access to everything, so it's never worth
// repeating in every call site. `@RequireAdminRole()` with no arguments means "SuperAdmin only" —
// an empty explicit list, not "no requirement" (a route with this guard and no decorator at all is
// a misconfiguration AdminGuard rejects outright).
export const RequireAdminRole = (...roles: AdminRole[]) => SetMetadata(ADMIN_ROLES_KEY, roles);
