import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { AdminRole } from '@wavehub/shared-types';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUserId } from '../auth/current-user.decorator';
import { AdminGuard } from '../admin/admin-role.guard';
import { RequireAdminRole } from '../admin/require-admin-role.decorator';
import { CurrentAdminRole } from '../admin/current-admin-role.decorator';
import { AdminAuditService } from '../admin/admin-audit.service';
import { TranslationsService } from './translations.service';
import { UpsertTranslationDto } from './dto/translation.dto';

// Content Management (Super Admin + Main Administrator), the same roles as the CMS pages.
const TRANSLATION_ROLES = [AdminRole.MainAdministrator];

@Controller()
export class TranslationsController {
  constructor(
    private readonly translations: TranslationsService,
    private readonly audit: AdminAuditService,
  ) {}

  // Public: every visitor's browser applies these over the built-in texts.
  @Get('translations')
  publicMap() {
    return this.translations.publicMap();
  }

  @Get('admin/translations')
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole(...TRANSLATION_ROLES)
  list() {
    return this.translations.adminList();
  }

  @Post('admin/translations')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole(...TRANSLATION_ROLES)
  async upsert(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Body() dto: UpsertTranslationDto) {
    const row = await this.translations.upsert(adminId, dto);
    await this.audit.log({ adminId, adminRole, action: 'translation.upsert', entityType: 'ui_translation', entityId: row.id || 'none', metadata: { key: row.key.slice(0, 200), en: !!row.en, ka: !!row.ka } });
    return row;
  }

  @Delete('admin/translations/:id')
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole(...TRANSLATION_ROLES)
  async remove(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Param('id', ParseUUIDPipe) id: string) {
    const { key } = await this.translations.remove(id);
    await this.audit.log({ adminId, adminRole, action: 'translation.delete', entityType: 'ui_translation', entityId: id, metadata: { key: key.slice(0, 200) } });
    return { ok: true };
  }
}
