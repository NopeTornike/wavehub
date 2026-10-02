import { BadRequestException, Body, Controller, ForbiddenException, Get, HttpCode, HttpStatus, NotFoundException, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AdminRole, NotificationType } from '@wavehub/shared-types';
import { UsersService } from './users.service';
import { ListUsersDto } from './dto/list-users.dto';
import { ModerateUserDto } from './dto/moderate-user.dto';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUserId } from '../auth/current-user.decorator';
import { AdminGuard } from '../admin/admin-role.guard';
import { RequireAdminRole } from '../admin/require-admin-role.decorator';
import { CurrentAdminRole } from '../admin/current-admin-role.decorator';
import { AdminAuditService } from '../admin/admin-audit.service';
import { WalletService } from '../wallet/wallet.service';
import { SetAdminRoleDto, WalletAdjustmentDto } from './dto/admin-user-powers.dto';
import { PlatformSettingsService } from '../settings/platform-settings.service';
import { NotificationsService } from '../notifications/notifications.service';

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

// Support Specialist may also suspend/restore and adjust WaveCoin — but only when a Super Admin has
// switched that on (Admin → Platform settings → Support permissions), never on their own account or
// another staff account, and (WaveCoin) only up to the Super-Admin-set per-adjustment cap.
const SUPPORT_SWITCHABLE = AdminRole.SupportSpecialist;

@Controller('admin/users')
@UseGuards(AuthGuard, AdminGuard)
export class AdminUsersController {
  constructor(
    private readonly users: UsersService,
    private readonly audit: AdminAuditService,
    private readonly wallet: WalletService,
    private readonly settings: PlatformSettingsService,
    private readonly notifications: NotificationsService,
  ) {}

  // Re-checked on every request (the UI hiding a control is not the gate).
  private async assertSupportMay(adminRole: string, adminId: string, targetId: string, power: 'walletAdjust' | 'suspendUsers', amount?: number) {
    if (adminRole !== SUPPORT_SWITCHABLE) return;
    const perms = await this.settings.getSupportPermissions();
    if (!perms[power]) throw new ForbiddenException('A Super Admin has not enabled this for Support');
    if (targetId === adminId) throw new ForbiddenException('You cannot do this to your own account');
    const target = await this.users.getAdminOne(targetId);
    if (target.adminRole) throw new ForbiddenException('Support cannot do this to a staff account');
    if (power === 'walletAdjust' && amount !== undefined && Math.abs(amount) > perms.walletAdjustMax) {
      throw new ForbiddenException(`Support can adjust at most ${perms.walletAdjustMax} WC at a time`);
    }
  }

  // Super Admin (SPECIFICATION.md §5.13: "add/deduct funds, adjust balance" is a Super Admin
  // capability), plus Support Specialist when a Super Admin has enabled it (capped, non-staff only).
  @Post(':id/wallet-adjustment')
  @HttpCode(HttpStatus.OK)
  @RequireAdminRole(SUPPORT_SWITCHABLE)
  async adjustWallet(
    @CurrentUserId() adminId: string,
    @CurrentAdminRole() adminRole: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: WalletAdjustmentDto,
  ) {
    await this.assertSupportMay(adminRole, adminId, id, 'walletAdjust', dto.amountWaveCoin);
    try {
      const entry = await this.wallet.adminAdjust(id, dto.amountWaveCoin, adminId, `admin-adjust-${randomUUID()}`);
      await this.audit.log({
        adminId,
        adminRole,
        action: 'user.wallet_adjust',
        entityType: 'user',
        entityId: id,
        metadata: { amountWaveCoin: dto.amountWaveCoin, balanceAfter: entry.balanceAfter, reason: dto.reason },
      });
      const added = dto.amountWaveCoin > 0;
      await this.notifications.tryEmit(
        id,
        NotificationType.WalletAdjusted,
        added ? 'ბალანსს დაემატა თანხა' : 'ბალანსიდან ჩამოიჭრა თანხა',
        `WaveHub-ის ადმინისტრაციამ ${added ? 'დაამატა' : 'ჩამოჭრა'} ${Math.abs(dto.amountWaveCoin)} WaveCoin. ახალი ბალანსი: ${entry.balanceAfter}.`,
        { link: '/wallet' },
      );
      return this.users.getAdminOne(id);
    } catch (err) {
      const code = (err as Error).message;
      if (code === 'USER_NOT_FOUND') throw new NotFoundException('User not found');
      if (code === 'INSUFFICIENT_BALANCE') throw new BadRequestException('The balance would go below zero');
      throw err;
    }
  }

  // Staff Management: assign/change/remove a staff role — Super Admin only.
  @Post(':id/role')
  @HttpCode(HttpStatus.OK)
  @RequireAdminRole()
  async setRole(
    @CurrentUserId() adminId: string,
    @CurrentAdminRole() adminRole: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetAdminRoleDto,
  ) {
    const before = await this.users.getAdminOne(id);
    const user = await this.users.setAdminRole(adminId, id, dto.adminRole ?? null);
    await this.audit.log({
      adminId,
      adminRole,
      action: 'user.set_admin_role',
      entityType: 'user',
      entityId: id,
      metadata: { from: before.adminRole, to: user.adminRole, reason: dto.reason },
    });
    return user;
  }

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
  @RequireAdminRole(...USER_SUSPEND_ROLES, SUPPORT_SWITCHABLE)
  async suspend(
    @CurrentUserId() adminId: string,
    @CurrentAdminRole() adminRole: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ModerateUserDto,
  ) {
    await this.assertSupportMay(adminRole, adminId, id, 'suspendUsers');
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
  @RequireAdminRole(...USER_SUSPEND_ROLES, SUPPORT_SWITCHABLE)
  async restore(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.assertSupportMay(adminRole, adminId, id, 'suspendUsers');
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
