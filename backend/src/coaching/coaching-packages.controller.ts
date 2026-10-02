import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUserId } from '../auth/current-user.decorator';
import { AdminGuard } from '../admin/admin-role.guard';
import { RequireAdminRole } from '../admin/require-admin-role.decorator';
import { CurrentAdminRole } from '../admin/current-admin-role.decorator';
import { AdminAuditService } from '../admin/admin-audit.service';
import { CoachingPackagesService } from './coaching-packages.service';
import { UpdateCoachingPackageDto } from './dto/coaching-package.dto';
import { COACH_MANAGEMENT_ROLES } from './coaches.controller';

// Platform coaching packages: public list; staff view; Super Admin edits (prices are money), audit-logged.
@Controller()
export class CoachingPackagesController {
  constructor(
    private readonly packages: CoachingPackagesService,
    private readonly audit: AdminAuditService,
  ) {}

  @Get('coaching-packages')
  listActive() {
    return this.packages.listActive();
  }

  @Get('admin/coaching-packages')
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole(...COACH_MANAGEMENT_ROLES)
  listAll() {
    return this.packages.listAll();
  }

  @Patch('admin/coaching-packages/:id')
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole()
  async update(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCoachingPackageDto) {
    const change = await this.packages.update(id, dto);
    await this.audit.log({ adminId, adminRole, action: 'coaching_package.update', entityType: 'coaching_package', entityId: id, metadata: change });
    return (await this.packages.listAll()).find((p) => p.id === id);
  }
}
