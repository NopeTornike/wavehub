import { CREATE_THROTTLE } from '../common/throttle';
import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Logger, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { VerifiedEmailGuard } from '../auth/verified-email.guard';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { SubscriptionsService } from './subscriptions.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { CheckoutSubscriptionDto } from './dto/checkout-subscription.dto';
import { GrantSubscriptionDto } from './dto/grant-subscription.dto';
import { RevokeSubscriptionDto } from './dto/revoke-subscription.dto';
import { ListPlansDto } from './dto/list-plans.dto';
import { verifyBogCallbackSignature } from '../payments/bog-signature.util';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUserId } from '../auth/current-user.decorator';
import { AdminGuard } from '../admin/admin-role.guard';
import { RequireAdminRole } from '../admin/require-admin-role.decorator';
import { CurrentAdminRole } from '../admin/current-admin-role.decorator';
import { AdminAuditService } from '../admin/admin-audit.service';

@Controller()
export class SubscriptionsController {
  private readonly logger = new Logger(SubscriptionsController.name);

  constructor(
    private readonly subscriptions: SubscriptionsService,
    private readonly audit: AdminAuditService,
  ) {}

  @Get('subscriptions/plans')
  listPlans(@Query() query: ListPlansDto) {
    return this.subscriptions.listActivePlans(query.audience);
  }

  @Get('subscriptions/mine')
  @UseGuards(AuthGuard)
  listMine(@CurrentUserId() userId: string) {
    return this.subscriptions.listMine(userId);
  }

  @Post('subscriptions/checkout')
  @Throttle(CREATE_THROTTLE)
  @UseGuards(AuthGuard, VerifiedEmailGuard)
  checkout(@CurrentUserId() userId: string, @Body() dto: CheckoutSubscriptionDto) {
    return this.subscriptions.startCheckout(userId, dto);
  }

  @Post('subscriptions/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  cancel(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.subscriptions.cancel(userId, id);
  }

  // Same shape and reasoning as backend/src/payments/bog-payments.controller.ts's `callback`:
  // verify the signature, then re-fetch the authoritative order status from BOG before acting on
  // anything, and always return 200 so BOG doesn't retry a notification we've already permanently
  // rejected. A deliberately separate endpoint from the WaveCoin top-up callback (not reused) —
  // see backend/src/subscriptions/CLAUDE.md for why keeping them apart was the safer choice.
  @Post('subscriptions/bog-callback')
  @HttpCode(HttpStatus.OK)
  @SkipThrottle()
  async bogCallback(@Req() req: Request, @Headers('callback-signature') signature: string | undefined) {
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!rawBody || !verifyBogCallbackSignature(rawBody, signature || '')) {
      this.logger.warn('Rejected BOG subscription callback with invalid or missing signature.');
      return { ok: true };
    }

    const bogOrderId: string | undefined = (req.body as any)?.body?.order_id;
    if (!bogOrderId) {
      this.logger.warn('BOG subscription callback missing body.order_id.');
      return { ok: true };
    }

    try {
      await this.subscriptions.handleBogCallback(bogOrderId);
    } catch (err) {
      this.logger.error(`Failed to process BOG subscription callback for order ${bogOrderId}`, err as Error);
    }
    return { ok: true };
  }

  // Admin plan management — SuperAdmin only, same gate as backend/src/settings/ (platform-wide
  // financial configuration), since a subscription plan's price/perks are just as sensitive.
  @Get('admin/subscription-plans')
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole()
  listAllPlans() {
    return this.subscriptions.listAllPlansForAdmin();
  }

  @Post('admin/subscription-plans')
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole()
  async createPlan(
    @CurrentUserId() adminId: string,
    @CurrentAdminRole() adminRole: string,
    @Body() dto: CreatePlanDto,
  ) {
    const plan = await this.subscriptions.createPlan(dto);
    await this.audit.log({
      adminId,
      adminRole,
      action: 'subscription-plan.create',
      entityType: 'subscription_plan',
      entityId: plan.id,
    });
    return plan;
  }

  @Post('admin/subscription-plans/:id')
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole()
  async updatePlan(
    @CurrentUserId() adminId: string,
    @CurrentAdminRole() adminRole: string,
    @Param('id') id: string,
    @Body() dto: UpdatePlanDto,
  ) {
    const plan = await this.subscriptions.updatePlan(id, dto);
    await this.audit.log({
      adminId,
      adminRole,
      action: 'subscription-plan.update',
      entityType: 'subscription_plan',
      entityId: id,
      metadata: dto as Record<string, unknown>,
    });
    return plan;
  }

  // Manual grant / revoke of a user's subscription — SuperAdmin only, audit-logged with the reason.
  // A grant has no BOG card behind it: never recharged, just expires at period end. POST-only like
  // every mutating route here; VerifiedEmailGuard follows AuthGuard per the marketplace-mutation rule.
  @Get('admin/subscriptions')
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole()
  listLive() {
    return this.subscriptions.listLiveForAdmin();
  }

  @Post('admin/subscriptions/grant')
  @UseGuards(AuthGuard, VerifiedEmailGuard, AdminGuard)
  @RequireAdminRole()
  async grant(
    @CurrentUserId() adminId: string,
    @CurrentAdminRole() adminRole: string,
    @Body() dto: GrantSubscriptionDto,
  ) {
    const sub = await this.subscriptions.grantSubscription(adminId, dto);
    await this.audit.log({
      adminId,
      adminRole,
      action: 'subscription.grant',
      entityType: 'user_subscription',
      entityId: sub.id,
      metadata: { userId: dto.userId, planId: dto.planId, periodDays: dto.periodDays ?? null, reason: dto.reason },
    });
    return { id: sub.id, currentPeriodEnd: sub.currentPeriodEnd.toISOString() };
  }

  @Post('admin/subscriptions/:id/revoke')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, VerifiedEmailGuard, AdminGuard)
  @RequireAdminRole()
  async revoke(
    @CurrentUserId() adminId: string,
    @CurrentAdminRole() adminRole: string,
    @Param('id') id: string,
    @Body() dto: RevokeSubscriptionDto,
  ) {
    const sub = await this.subscriptions.revokeSubscription(id);
    await this.audit.log({
      adminId,
      adminRole,
      action: 'subscription.revoke',
      entityType: 'user_subscription',
      entityId: id,
      metadata: { userId: sub.userId, reason: dto.reason },
    });
    return { id: sub.id, status: sub.status };
  }
}
