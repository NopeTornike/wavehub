import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { PlatformSettingsService } from './platform-settings.service';
import { UpdatePlatformSettingsDto } from './dto/update-platform-settings.dto';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUserId } from '../auth/current-user.decorator';
import { AdminGuard } from '../admin/admin-role.guard';
import { RequireAdminRole } from '../admin/require-admin-role.decorator';
import { CurrentAdminRole } from '../admin/current-admin-role.decorator';
import { AdminAuditService } from '../admin/admin-audit.service';
import { PLATFORM_SETTINGS_SINGLETON_ID } from './platform-settings.entity';
import { AdminRole } from '@wavehub/shared-types';

// Super Admin only for both view and edit — SPECIFICATION.md §5.13.1 is the only role section
// whose CAN list includes "Platform Settings" at all; every other role's CANNOT list explicitly
// excludes changing commissions/platform settings.
@Controller('admin/platform-settings')
@UseGuards(AuthGuard, AdminGuard)
export class PlatformSettingsController {
  constructor(
    private readonly settings: PlatformSettingsService,
    private readonly audit: AdminAuditService,
  ) {}

  // The caller's own Super-Admin-controlled powers (the admin UI shows/hides controls with this;
  // the routes re-check on every request). Any staff role may ask about itself.
  @Get('my-permissions')
  @RequireAdminRole(...Object.values(AdminRole))
  myPermissions(@CurrentAdminRole() adminRole: AdminRole) {
    return this.settings.staffPermissions(adminRole);
  }

  @Get()
  @RequireAdminRole()
  get() {
    return this.settings.get();
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @RequireAdminRole()
  async update(
    @CurrentUserId() adminId: string,
    @CurrentAdminRole() adminRole: string,
    @Body() dto: UpdatePlatformSettingsDto,
  ) {
    const updated = await this.settings.update(dto);
    await this.audit.log({
      adminId,
      adminRole,
      action: 'platform_settings.update',
      entityType: 'platform_settings',
      entityId: PLATFORM_SETTINGS_SINGLETON_ID,
      metadata: dto as Record<string, unknown>,
    });
    return updated;
  }
}

// Public: the two auto-accept windows, so the site can tell buyers "if you don't confirm within N
// hours…" before they pay (owner 2026-10-07). Only these numbers — nothing else from settings.
@Controller('platform')
export class PlatformTimingsController {
  constructor(private readonly settings: PlatformSettingsService) {}

  @Get('timings')
  timings() {
    return this.settings.getTimings();
  }
}
