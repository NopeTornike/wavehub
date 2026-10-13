import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AdminRole } from '@wavehub/shared-types';
import { CREATE_THROTTLE } from '../common/throttle';
import { AuthGuard } from '../auth/auth.guard';
import { VerifiedEmailGuard } from '../auth/verified-email.guard';
import { CurrentUserId } from '../auth/current-user.decorator';
import { AdminGuard } from '../admin/admin-role.guard';
import { RequireAdminRole } from '../admin/require-admin-role.decorator';
import { CurrentAdminRole } from '../admin/current-admin-role.decorator';
import { AdminAuditService } from '../admin/admin-audit.service';
import { TrustService } from './trust.service';
import { CreateReportDto, FlagUserDto, HandleReportDto, ListReportsDto, SearchTrustUsersDto, StaffNoteDto, WarnUserDto } from './dto/trust.dto';

// SPECIFICATION.md §5.13.5: Trust & Safety Officer owns this; Operation Lead and Main
// Administrator also handle reports/user safety (Super Admin implicitly). Every staff action is
// audit-logged.
const TRUST_ROLES = [AdminRole.TrustSafetyOfficer, AdminRole.OperationLead, AdminRole.MainAdministrator];

@Controller()
@UseGuards(AuthGuard)
export class TrustController {
  constructor(
    private readonly trust: TrustService,
    private readonly audit: AdminAuditService,
  ) {}

  // Any verified user can report a user, listing, coach, review or a message in their own chats.
  @Post('reports')
  @Throttle(CREATE_THROTTLE)
  @UseGuards(VerifiedEmailGuard)
  report(@CurrentUserId() userId: string, @Body() dto: CreateReportDto) {
    return this.trust.createReport(userId, dto);
  }

  @Get('admin/trust/overview')
  @UseGuards(AdminGuard)
  @RequireAdminRole(...TRUST_ROLES)
  overview() {
    return this.trust.overview();
  }

  @Get('admin/trust/reports')
  @UseGuards(AdminGuard)
  @RequireAdminRole(...TRUST_ROLES)
  reports(@Query() dto: ListReportsDto) {
    return this.trust.listReports(dto.status ?? 'open');
  }

  @Patch('admin/trust/reports/:id')
  @UseGuards(AdminGuard)
  @RequireAdminRole(...TRUST_ROLES)
  async handle(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: HandleReportDto) {
    const report = await this.trust.handleReport(adminId, id, dto.status, dto.staffNote);
    await this.audit.log({ adminId, adminRole, action: 'report.handle', entityType: 'user_report', entityId: id, metadata: { status: dto.status } });
    return report;
  }

  @Get('admin/trust/users')
  @UseGuards(AdminGuard)
  @RequireAdminRole(...TRUST_ROLES)
  search(@Query() dto: SearchTrustUsersDto) {
    return this.trust.searchUsers(dto.q);
  }

  @Get('admin/trust/users/:id')
  @UseGuards(AdminGuard)
  @RequireAdminRole(...TRUST_ROLES)
  async user(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Param('id', ParseUUIDPipe) id: string) {
    const detail = await this.trust.userDetail(id);
    // Viewing login history is itself sensitive — logged like any other staff access.
    await this.audit.log({ adminId, adminRole, action: 'trust.view_user', entityType: 'user', entityId: id });
    return detail;
  }

  @Post('admin/trust/users/:id/notes')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminGuard)
  @RequireAdminRole(...TRUST_ROLES)
  async note(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: StaffNoteDto) {
    await this.trust.addNote(adminId, id, 'note', dto.body);
    await this.audit.log({ adminId, adminRole, action: 'trust.note', entityType: 'user', entityId: id });
    return this.trust.userDetail(id);
  }

  @Post('admin/trust/users/:id/warn')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminGuard)
  @RequireAdminRole(...TRUST_ROLES)
  async warn(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: WarnUserDto) {
    await this.trust.warn(adminId, id, dto.message);
    await this.audit.log({ adminId, adminRole, action: 'trust.warn', entityType: 'user', entityId: id, metadata: { message: dto.message } });
    return this.trust.userDetail(id);
  }

  @Post('admin/trust/users/:id/flag')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminGuard)
  @RequireAdminRole(...TRUST_ROLES)
  async flag(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: FlagUserDto) {
    await this.trust.setFlag(adminId, id, dto.flagged, dto.reason);
    await this.audit.log({ adminId, adminRole, action: dto.flagged ? 'trust.flag' : 'trust.unflag', entityType: 'user', entityId: id, metadata: { reason: dto.reason } });
    return this.trust.userDetail(id);
  }
}
