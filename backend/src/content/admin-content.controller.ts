import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AdminRole } from '@wavehub/shared-types';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUserId } from '../auth/current-user.decorator';
import { AdminGuard } from '../admin/admin-role.guard';
import { RequireAdminRole } from '../admin/require-admin-role.decorator';
import { CurrentAdminRole } from '../admin/current-admin-role.decorator';
import { AdminAuditService } from '../admin/admin-audit.service';
import { ContentService } from './content.service';
import { UpsertContentPageDto } from './dto/upsert-content-page.dto';

// SPECIFICATION.md §5.13's "Content Management" CAN list appears on Super Admin's full catalog
// and explicitly on Main Administrator ("edit banners, edit FAQ, add news, edit categories, edit
// game info") — no other role's list includes it. Static/legal pages are treated as falling under
// that same capability rather than inventing a separate permission for them.
const CONTENT_MANAGEMENT_ROLES = [AdminRole.MainAdministrator];

@Controller('admin/content')
@UseGuards(AuthGuard, AdminGuard)
export class AdminContentController {
  constructor(
    private readonly content: ContentService,
    private readonly audit: AdminAuditService,
  ) {}

  @Get()
  @RequireAdminRole(...CONTENT_MANAGEMENT_ROLES)
  list() {
    return this.content.listAll();
  }

  @Get(':slug')
  @RequireAdminRole(...CONTENT_MANAGEMENT_ROLES)
  getOne(@Param('slug') slug: string) {
    return this.content.getBySlugAdmin(slug);
  }

  @Post()
  @RequireAdminRole(...CONTENT_MANAGEMENT_ROLES)
  async upsert(
    @CurrentUserId() adminId: string,
    @CurrentAdminRole() adminRole: string,
    @Body() dto: UpsertContentPageDto,
  ) {
    const page = await this.content.upsert(dto);
    await this.audit.log({
      adminId,
      adminRole,
      action: 'content_page.upsert',
      entityType: 'content_page',
      entityId: page.id,
      metadata: { slug: page.slug, status: page.status },
    });
    return page;
  }
}
