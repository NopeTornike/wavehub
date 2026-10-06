import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseEnumPipe, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsEnum } from 'class-validator';
import { BadgeKey } from '@wavehub/shared-types';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUserId } from '../auth/current-user.decorator';
import { VerifiedEmailGuard } from '../auth/verified-email.guard';
import { AdminGuard } from '../admin/admin-role.guard';
import { RequireAdminRole } from '../admin/require-admin-role.decorator';
import { CurrentAdminRole } from '../admin/current-admin-role.decorator';
import { AdminAuditService } from '../admin/admin-audit.service';
import { CREATE_THROTTLE } from '../common/throttle';
import { BADGE_ADMIN_ROLES, BadgesService } from './badges.service';

class BadgeDto {
  @IsEnum(BadgeKey)
  badgeKey: BadgeKey;
}

// Path `:badgeKey` is parsed on its own (ParseEnumPipe): a whole-`@Param()` DTO would also receive
// `:id`/`:studentId` and be rejected by the global forbidNonWhitelisted pipe.
const badgeKeyPipe = new ParseEnumPipe(BadgeKey);

// Staff grant/revoke (per-badge permission checked in BadgesService) and a coach's own-student
// grants. Every grant/revoke is audit-logged (spec acceptance criteria).
@Controller()
export class BadgesController {
  constructor(
    private readonly badges: BadgesService,
    private readonly audit: AdminAuditService,
  ) {}

  @Get('admin/users/:id/badges')
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole(...BADGE_ADMIN_ROLES)
  adminList(@Param('id', ParseUUIDPipe) id: string) {
    return this.badges.listForAdmin(id);
  }

  @Post('admin/users/:id/badges')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole(...BADGE_ADMIN_ROLES)
  async adminGrant(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: BadgeDto) {
    const result = await this.badges.adminGrant({ id: adminId, role: adminRole }, id, dto.badgeKey);
    await this.audit.log({ adminId, adminRole, action: 'badge.grant', entityType: 'user', entityId: id, metadata: { badgeKey: dto.badgeKey } });
    return result;
  }

  @Delete('admin/users/:id/badges/:badgeKey')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole(...BADGE_ADMIN_ROLES)
  async adminRevoke(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Param('id', ParseUUIDPipe) id: string, @Param('badgeKey', badgeKeyPipe) badgeKey: BadgeKey) {
    const result = await this.badges.adminRevoke({ id: adminId, role: adminRole }, id, badgeKey);
    await this.audit.log({ adminId, adminRole, action: 'badge.revoke', entityType: 'user', entityId: id, metadata: { badgeKey } });
    return result;
  }

  @Get('coaches/mine/students')
  @UseGuards(AuthGuard)
  students(@CurrentUserId() userId: string) {
    return this.badges.coachStudents(userId);
  }

  @Post('coaches/mine/students/:studentId/badges')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, VerifiedEmailGuard)
  @Throttle(CREATE_THROTTLE)
  async coachGrant(@CurrentUserId() userId: string, @Param('studentId', ParseUUIDPipe) studentId: string, @Body() dto: BadgeDto) {
    await this.badges.coachGrant(userId, studentId, dto.badgeKey);
    await this.audit.log({ adminId: userId, adminRole: 'coach', action: 'badge.grant', entityType: 'user', entityId: studentId, metadata: { badgeKey: dto.badgeKey } });
    return { ok: true };
  }

  @Delete('coaches/mine/students/:studentId/badges/:badgeKey')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  async coachRevoke(@CurrentUserId() userId: string, @Param('studentId', ParseUUIDPipe) studentId: string, @Param('badgeKey', badgeKeyPipe) badgeKey: BadgeKey) {
    await this.badges.coachRevoke(userId, studentId, badgeKey);
    await this.audit.log({ adminId: userId, adminRole: 'coach', action: 'badge.revoke', entityType: 'user', entityId: studentId, metadata: { badgeKey } });
    return { ok: true };
  }
}
