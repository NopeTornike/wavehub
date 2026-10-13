import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { AdminRole } from '@wavehub/shared-types';
import { ReviewsService } from './reviews.service';
import { AdminEditReviewDto, ListAdminReviewsDto } from './dto/admin-reviews.dto';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUserId } from '../auth/current-user.decorator';
import { AdminGuard } from '../admin/admin-role.guard';
import { RequireAdminRole } from '../admin/require-admin-role.decorator';
import { CurrentAdminRole } from '../admin/current-admin-role.decorator';
import { AdminAuditService } from '../admin/admin-audit.service';

// Admin → Reviews: every product (order) and coach (session) review. Browsing is open to the
// review-moderation roles (same as the reported queue); changing a review's words or stars, or
// deleting a coach review, is Super Admin only (only its spec CAN list edits/deletes content).
// Every change is audit-logged with the before/after values.
@Controller('admin/reviews')
@UseGuards(AuthGuard, AdminGuard)
export class AdminReviewsController {
  constructor(
    private readonly reviews: ReviewsService,
    private readonly audit: AdminAuditService,
  ) {}

  @Get()
  @RequireAdminRole(AdminRole.OperationLead, AdminRole.MarketplaceCoachingOpsManager, AdminRole.TrustSafetyOfficer)
  list(@Query() dto: ListAdminReviewsDto) {
    return this.reviews.listAll(dto);
  }

  @Patch('product/:id')
  @RequireAdminRole()
  async editProduct(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AdminEditReviewDto) {
    const change = await this.reviews.adminEditProduct(id, dto);
    await this.audit.log({ adminId, adminRole, action: 'review.edit', entityType: 'review', entityId: id, metadata: change });
    return { ok: true };
  }

  @Patch('coach/:id')
  @RequireAdminRole()
  async editCoach(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AdminEditReviewDto) {
    const change = await this.reviews.adminEditCoach(id, dto);
    await this.audit.log({ adminId, adminRole, action: 'coach_review.edit', entityType: 'coaching_session_review', entityId: id, metadata: change });
    return { ok: true };
  }

  @Delete('coach/:id')
  @HttpCode(HttpStatus.OK)
  @RequireAdminRole()
  async deleteCoach(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Param('id', ParseUUIDPipe) id: string) {
    const removed = await this.reviews.adminDeleteCoach(id);
    await this.audit.log({ adminId, adminRole, action: 'coach_review.delete', entityType: 'coaching_session_review', entityId: id, metadata: removed });
    return { ok: true };
  }
}
