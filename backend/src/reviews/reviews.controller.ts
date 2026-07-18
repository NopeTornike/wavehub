import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AdminRole } from '@wavehub/shared-types';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReplyReviewDto } from './dto/reply-review.dto';
import { ReportReviewDto } from './dto/report-review.dto';
import { BrowseReviewsDto } from './dto/browse-reviews.dto';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUserId } from '../auth/current-user.decorator';
import { AdminGuard } from '../admin/admin-role.guard';
import { RequireAdminRole } from '../admin/require-admin-role.decorator';
import { CurrentAdminRole } from '../admin/current-admin-role.decorator';
import { AdminAuditService } from '../admin/admin-audit.service';

// Roles per SPECIFICATION.md §5.13's per-role CAN lists for Reviews Management/Monitoring —
// OperationLead, MarketplaceCoachingOpsManager, and TrustSafetyOfficer all explicitly get "hide";
// only Super Admin's list uses the word "delete" (AdminGuard's implicit SuperAdmin bypass covers
// `remove`/`restore` without needing to list it here).
const REVIEW_MODERATION_ROLES = [
  AdminRole.OperationLead,
  AdminRole.MarketplaceCoachingOpsManager,
  AdminRole.TrustSafetyOfficer,
];

@Controller()
export class ReviewsController {
  constructor(
    private readonly reviews: ReviewsService,
    private readonly audit: AdminAuditService,
  ) {}

  @Get('listings/:listingId/reviews')
  findForListing(@Param('listingId') listingId: string, @Query() query: BrowseReviewsDto) {
    return this.reviews.findForListing(listingId, query.sort);
  }

  @Post('reviews')
  @UseGuards(AuthGuard)
  create(@CurrentUserId() buyerId: string, @Body() dto: CreateReviewDto) {
    return this.reviews.create(buyerId, dto);
  }

  @Post('reviews/:id/reply')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  reply(@CurrentUserId() sellerId: string, @Param('id') id: string, @Body() dto: ReplyReviewDto) {
    return this.reviews.reply(sellerId, id, dto.body);
  }

  @Post('reviews/:id/report')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  report(@CurrentUserId() reporterId: string, @Param('id') id: string, @Body() dto: ReportReviewDto) {
    return this.reviews.report(reporterId, id, dto.reason);
  }

  @Post('reviews/:id/hide')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole(...REVIEW_MODERATION_ROLES)
  async hide(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Param('id') id: string) {
    const review = await this.reviews.hide(id);
    await this.audit.log({ adminId, adminRole, action: 'review.hide', entityType: 'review', entityId: id });
    return review;
  }

  // Permanent delete — Super Admin only per the spec (see the module comment above), so no roles
  // are listed here beyond AdminGuard's implicit SuperAdmin bypass.
  @Post('reviews/:id/remove')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole()
  async remove(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Param('id') id: string) {
    const review = await this.reviews.remove(id);
    await this.audit.log({ adminId, adminRole, action: 'review.remove', entityType: 'review', entityId: id });
    return review;
  }

  @Post('reviews/:id/restore')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole(...REVIEW_MODERATION_ROLES)
  async restore(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Param('id') id: string) {
    const review = await this.reviews.restore(id);
    await this.audit.log({ adminId, adminRole, action: 'review.restore', entityType: 'review', entityId: id });
    return review;
  }
}
