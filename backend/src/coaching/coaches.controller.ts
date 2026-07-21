import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AdminRole } from '@wavehub/shared-types';
import { CoachesService } from './coaches.service';
import { ApplyCoachDto } from './dto/apply-coach.dto';
import { RejectCoachDto } from './dto/reject-coach.dto';
import { BrowseCoachesDto } from './dto/browse-coaches.dto';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUserId } from '../auth/current-user.decorator';
import { AdminGuard } from '../admin/admin-role.guard';
import { RequireAdminRole } from '../admin/require-admin-role.decorator';
import { CurrentAdminRole } from '../admin/current-admin-role.decorator';
import { AdminAuditService } from '../admin/admin-audit.service';

// Roles per SPECIFICATION.md §5.13's per-role Coach Management CAN lists — Operation Lead
// (§5.13.2: "approve/reject coach verification"), Main Administrator (§5.13.3: same wording),
// Marketplace & Coaching Ops Manager (§5.13.4: "approve/reject verification, grant/remove
// verification badge, ... temp suspend, restore coaching"). Super Admin passes any admin-guarded
// route implicitly (see backend/src/admin/CLAUDE.md), not listed here.
const COACH_MANAGEMENT_ROLES = [AdminRole.OperationLead, AdminRole.MainAdministrator, AdminRole.MarketplaceCoachingOpsManager];

@Controller()
export class CoachesController {
  constructor(
    private readonly coaches: CoachesService,
    private readonly audit: AdminAuditService,
  ) {}

  @Post('coaches/apply')
  @UseGuards(AuthGuard)
  apply(@CurrentUserId() userId: string, @Body() dto: ApplyCoachDto) {
    return this.coaches.apply(userId, dto);
  }

  @Get('coaches/mine')
  @UseGuards(AuthGuard)
  findMine(@CurrentUserId() userId: string) {
    return this.coaches.findMine(userId);
  }

  @Get('coaches')
  browse(@Query() query: BrowseCoachesDto) {
    return this.coaches.browseVerified(query);
  }

  // Admin-only — MUST stay registered before `coaches/:id` below, same Express
  // registration-order gotcha documented in backend/src/listings/CLAUDE.md's `pending-review` note.
  @Get('coaches/pending-verification')
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole(...COACH_MANAGEMENT_ROLES)
  listPendingVerification() {
    return this.coaches.listPendingVerification();
  }

  @Get('coaches/all')
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole(...COACH_MANAGEMENT_ROLES)
  listAll() {
    return this.coaches.listAll();
  }

  @Get('coaches/:id')
  findOne(@Param('id') id: string) {
    return this.coaches.findPublicById(id);
  }

  @Post('coaches/:id/approve')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole(...COACH_MANAGEMENT_ROLES)
  async approve(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Param('id') id: string) {
    const coach = await this.coaches.approve(id);
    await this.audit.log({ adminId, adminRole, action: 'coach.approve', entityType: 'coach', entityId: id });
    return coach;
  }

  @Post('coaches/:id/reject')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole(...COACH_MANAGEMENT_ROLES)
  async reject(
    @CurrentUserId() adminId: string,
    @CurrentAdminRole() adminRole: string,
    @Param('id') id: string,
    @Body() dto: RejectCoachDto,
  ) {
    const coach = await this.coaches.reject(id, dto.reason);
    await this.audit.log({
      adminId,
      adminRole,
      action: 'coach.reject',
      entityType: 'coach',
      entityId: id,
      metadata: { reason: dto.reason },
    });
    return coach;
  }

  @Post('coaches/:id/suspend')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole(...COACH_MANAGEMENT_ROLES)
  async suspend(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Param('id') id: string) {
    const coach = await this.coaches.suspend(id);
    await this.audit.log({ adminId, adminRole, action: 'coach.suspend', entityType: 'coach', entityId: id });
    return coach;
  }

  @Post('coaches/:id/restore')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole(...COACH_MANAGEMENT_ROLES)
  async restore(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Param('id') id: string) {
    const coach = await this.coaches.restore(id);
    await this.audit.log({ adminId, adminRole, action: 'coach.restore', entityType: 'coach', entityId: id });
    return coach;
  }
}
