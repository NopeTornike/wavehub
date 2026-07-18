import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AdminRole } from '@wavehub/shared-types';
import { UsersService } from './users.service';
import { ListUsersDto } from './dto/list-users.dto';
import { ModerateUserDto } from './dto/moderate-user.dto';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUserId } from '../auth/current-user.decorator';
import { AdminGuard } from '../admin/admin-role.guard';
import { RequireAdminRole } from '../admin/require-admin-role.decorator';
import { CurrentAdminRole } from '../admin/current-admin-role.decorator';
import { AdminAuditService } from '../admin/admin-audit.service';

// View roles per SPECIFICATION.md §5.13: every role whose CAN list includes "view/search" a user
// at all. Marketplace & Coaching Ops Manager is deliberately excluded — its own section only
// grants Seller/Coach Management, not general User Management.
const USER_VIEW_ROLES = [
  AdminRole.OperationLead,
  AdminRole.MainAdministrator,
  AdminRole.TrustSafetyOfficer,
  AdminRole.SupportSpecialist,
];

// Suspend/restore roles: only Super Admin, Operation Lead, and Main Administrator's CAN lists
// include "temp suspend"/"restore" directly. Trust & Safety Officer can only "request temporary
// suspension" (recommend, not action) per its own CANNOT note — there's no separate
// request/approval workflow built yet, so it isn't granted direct suspend access here; Support
// Specialist's list explicitly says "CANNOT: ... suspend account".
const USER_SUSPEND_ROLES = [AdminRole.OperationLead, AdminRole.MainAdministrator];

@Controller('admin/users')
@UseGuards(AuthGuard, AdminGuard)
export class AdminUsersController {
  constructor(
    private readonly users: UsersService,
    private readonly audit: AdminAuditService,
  ) {}

  @Get()
  @RequireAdminRole(...USER_VIEW_ROLES)
  list(@Query() query: ListUsersDto) {
    return this.users.listAdmin(query);
  }

  @Get(':id')
  @RequireAdminRole(...USER_VIEW_ROLES)
  getOne(@Param('id') id: string) {
    return this.users.getAdminOne(id);
  }

  @Post(':id/suspend')
  @HttpCode(HttpStatus.OK)
  @RequireAdminRole(...USER_SUSPEND_ROLES)
  async suspend(
    @CurrentUserId() adminId: string,
    @CurrentAdminRole() adminRole: string,
    @Param('id') id: string,
    @Body() dto: ModerateUserDto,
  ) {
    const user = await this.users.suspend(id, dto.reason);
    await this.audit.log({
      adminId,
      adminRole,
      action: 'user.suspend',
      entityType: 'user',
      entityId: id,
      metadata: { reason: dto.reason },
    });
    return user;
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @RequireAdminRole(...USER_SUSPEND_ROLES)
  async restore(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Param('id') id: string) {
    const user = await this.users.restore(id);
    await this.audit.log({ adminId, adminRole, action: 'user.restore', entityType: 'user', entityId: id });
    return user;
  }

  // Permanent ban / remove-ban — Super Admin only. SPECIFICATION.md §5.13.1 is the only role
  // section whose User Management CAN list includes "permanently ban" / "remove ban"; Trust &
  // Safety Officer's own section explicitly states it "cannot permanently ban a user
  // independently" (recommends only, no approval-queue workflow exists yet to action that).
  @Post(':id/ban')
  @HttpCode(HttpStatus.OK)
  @RequireAdminRole()
  async ban(
    @CurrentUserId() adminId: string,
    @CurrentAdminRole() adminRole: string,
    @Param('id') id: string,
    @Body() dto: ModerateUserDto,
  ) {
    const user = await this.users.ban(id, dto.reason);
    await this.audit.log({
      adminId,
      adminRole,
      action: 'user.ban',
      entityType: 'user',
      entityId: id,
      metadata: { reason: dto.reason },
    });
    return user;
  }

  @Post(':id/unban')
  @HttpCode(HttpStatus.OK)
  @RequireAdminRole()
  async unban(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Param('id') id: string) {
    const user = await this.users.unban(id);
    await this.audit.log({ adminId, adminRole, action: 'user.unban', entityType: 'user', entityId: id });
    return user;
  }
}
