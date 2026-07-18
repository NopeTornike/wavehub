import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AdminRole } from '@wavehub/shared-types';
import { AdminGuard } from './admin-role.guard';

// Fakes both collaborators (Reflector, UsersService) directly rather than spinning up Nest's DI —
// same lightweight approach as every other *.service.spec.ts in this repo.
describe('AdminGuard', () => {
  function build(requiredRoles: AdminRole[] | undefined, user: any, userId = 'user-1') {
    const reflector = { getAllAndOverride: jest.fn(() => requiredRoles) } as any;
    const users = { findById: jest.fn(async () => user) } as any;
    const guard = new AdminGuard(reflector, users);

    const request: any = { userId };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => undefined,
      getClass: () => undefined,
    } as any;

    return { guard, context, request };
  }

  it('rejects a route with no @RequireAdminRole(...) decorator at all', async () => {
    const { guard, context } = build(undefined, { adminRole: AdminRole.SuperAdmin });
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('rejects when there is no authenticated user on the request', async () => {
    const { guard, context } = build([AdminRole.SuperAdmin], null, null as any);
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a user with no adminRole at all', async () => {
    const { guard, context } = build([AdminRole.OperationLead], { adminRole: null });
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('rejects a user whose adminRole is not in the required list', async () => {
    const { guard, context } = build([AdminRole.OperationLead], { adminRole: AdminRole.SupportSpecialist });
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('allows a user whose adminRole is explicitly listed', async () => {
    const { guard, context, request } = build([AdminRole.OperationLead], { adminRole: AdminRole.OperationLead });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.adminRole).toBe(AdminRole.OperationLead);
  });

  it('SuperAdmin always passes, even against an empty required-roles list', async () => {
    const { guard, context } = build([], { adminRole: AdminRole.SuperAdmin });
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('SuperAdmin passes against a list that does not explicitly name it', async () => {
    const { guard, context } = build([AdminRole.TrustSafetyOfficer], { adminRole: AdminRole.SuperAdmin });
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('an empty required-roles list rejects every non-SuperAdmin role', async () => {
    const { guard, context } = build([], { adminRole: AdminRole.OperationLead });
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });
});
