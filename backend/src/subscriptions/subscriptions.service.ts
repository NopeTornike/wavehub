import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, IsNull, LessThanOrEqual, QueryFailedError, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { NotificationType, SubscriptionAudience, SubscriptionStatus } from '@wavehub/shared-types';
import type {
  AdminSubscriptionPlanSummary,
  AdminUserSubscriptionSummary,
  PublicSubscriptionPlan,
  PublicUserSubscription,
  SubscriptionPerks,
} from '@wavehub/shared-types';
import { SubscriptionPlan } from './subscription-plan.entity';
import { UserSubscription } from './user-subscription.entity';
import { SubscriptionChargeAttempt } from './subscription-charge-attempt.entity';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { CheckoutSubscriptionDto } from './dto/checkout-subscription.dto';
import { BogPaymentsService } from '../payments/bog-payments.service';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { GrantSubscriptionDto } from './dto/grant-subscription.dto';

// A `past_due` subscription (a declined recharge) keeps its perks for this long before the cron
// gives up and expires it — LAUNCH_PLAN.md §3c's "a brief grace period, not an instant perk
// cutoff on one declined card."
const PAST_DUE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;
// If a dispatched recharge attempt is still `pending` (no callback yet) after this long, treat it
// as lost/stuck and let the next sweep retry rather than waiting forever for a callback that may
// never arrive — never re-fire while a *recent* attempt might still be in flight, though, or every
// hourly sweep would double-charge the card while BOG is simply slow to call back.
const STUCK_ATTEMPT_MS = 24 * 60 * 60 * 1000;
// How far ahead of a non-renewing subscription's period end the "about to expire" notice goes out.
const EXPIRY_NOTICE_MS = 3 * 24 * 60 * 60 * 1000;
const ACTIVE_OR_PAST_DUE = [SubscriptionStatus.Active, SubscriptionStatus.PastDue];

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @InjectRepository(SubscriptionPlan) private readonly plans: Repository<SubscriptionPlan>,
    @InjectRepository(UserSubscription) private readonly userSubscriptions: Repository<UserSubscription>,
    @InjectRepository(SubscriptionChargeAttempt) private readonly attempts: Repository<SubscriptionChargeAttempt>,
    private readonly bogPayments: BogPaymentsService,
    private readonly users: UsersService,
    private readonly notifications: NotificationsService,
  ) {}

  // Best-effort in-app notification + email — a failure here must never block the billing/admin
  // action that triggered it (same contract as OrdersService's private `notify`).
  private async notify(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    subscriptionId: string,
  ): Promise<void> {
    try {
      const user = await this.users.findById(userId);
      await this.notifications.emit(
        userId,
        type,
        title,
        body,
        { subscriptionId },
        user?.email ? { to: user.email, subject: title } : undefined,
      );
    } catch (err) {
      this.logger.error(`Failed to notify user ${userId} about subscription ${subscriptionId}`, err as Error);
    }
  }

  private async markPastDue(sub: { id: string; userId: string; status: SubscriptionStatus }, planName: string): Promise<void> {
    const wasPastDue = sub.status === SubscriptionStatus.PastDue;
    await this.userSubscriptions.update(sub.id, { status: SubscriptionStatus.PastDue });
    // Only the active -> past_due transition notifies; the sweep re-dispatches hourly during grace
    // and must not spam the user on every failed retry.
    if (!wasPastDue) {
      await this.notify(
        sub.userId,
        NotificationType.SubscriptionPastDue,
        'გამოწერის გადახდა ვერ განხორციელდა',
        `თქვენი გეგმის „${planName}“ განახლების გადახდა ვერ განხორციელდა. შეინარჩუნეთ ბარათზე საკმარისი თანხა — 7 დღის განმავლობაში ისევ ვცდით, პრივილეგიები ჯერ კიდევ მოქმედებს.`,
        sub.id,
      );
    }
  }

  // --- Admin plan management ---

  async createPlan(dto: CreatePlanDto): Promise<AdminSubscriptionPlanSummary> {
    const plan = this.plans.create({
      audience: dto.audience,
      tier: dto.tier,
      name: dto.name,
      description: dto.description,
      priceGel: dto.priceGel,
      billingPeriodDays: dto.billingPeriodDays ?? 30,
      perks: (dto.perks ?? {}) as SubscriptionPerks,
      sortOrder: dto.sortOrder ?? 0,
      isActive: dto.isActive ?? true,
    });
    return this.toAdminPlan(await this.plans.save(plan));
  }

  async updatePlan(id: string, dto: UpdatePlanDto): Promise<AdminSubscriptionPlanSummary> {
    const plan = await this.getPlanOrThrow(id);
    Object.assign(plan, {
      ...(dto.audience !== undefined && { audience: dto.audience }),
      ...(dto.tier !== undefined && { tier: dto.tier }),
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.priceGel !== undefined && { priceGel: dto.priceGel }),
      ...(dto.billingPeriodDays !== undefined && { billingPeriodDays: dto.billingPeriodDays }),
      ...(dto.perks !== undefined && { perks: dto.perks as SubscriptionPerks }),
      ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    });
    return this.toAdminPlan(await this.plans.save(plan));
  }

  async listAllPlansForAdmin(): Promise<AdminSubscriptionPlanSummary[]> {
    const rows = await this.plans.find({ order: { audience: 'ASC', sortOrder: 'ASC' } });
    return rows.map((row) => this.toAdminPlan(row));
  }

  // --- Public ---

  async listActivePlans(audience?: SubscriptionAudience): Promise<PublicSubscriptionPlan[]> {
    const rows = await this.plans.find({
      where: { isActive: true, ...(audience ? { audience } : {}) },
      order: { audience: 'ASC', sortOrder: 'ASC' },
    });
    return rows.map((row) => this.toPublicPlan(row));
  }

  async listMine(userId: string): Promise<PublicUserSubscription[]> {
    const rows = await this.userSubscriptions.find({
      where: { userId },
      relations: ['plan'],
      order: { createdAt: 'DESC' },
    });
    return rows.map((row) => this.toPublic(row));
  }

  // --- Admin manual grant / revoke (SuperAdmin-only at the controller) ---

  async listLiveForAdmin(): Promise<AdminUserSubscriptionSummary[]> {
    const rows = await this.userSubscriptions.find({
      where: { status: In(ACTIVE_OR_PAST_DUE) },
      relations: ['plan', 'user'],
      order: { createdAt: 'DESC' },
      take: 200,
    });
    return rows.map((row) => ({
      ...this.toPublic(row),
      user: { id: row.user.id, username: row.user.username, email: row.user.email },
    }));
  }

  // A granted subscription has no BOG parent (`bogParentOrderId` NULL) so the sweep never recharges
  // it — it just expires at period end. Respects the one-live-subscription-per-audience rule:
  // rejects (409) if the user already has an active/past_due one, with the partial unique index as
  // the race-safe backstop.
  async grantSubscription(adminId: string, dto: GrantSubscriptionDto): Promise<UserSubscription> {
    const plan = await this.getPlanOrThrow(dto.planId);
    const user = await this.users.findById(dto.userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const conflict = () =>
      new ConflictException('This user already has a live subscription for this audience — revoke it first');
    const existing = await this.userSubscriptions.findOne({
      where: { userId: dto.userId, audience: plan.audience, status: In(ACTIVE_OR_PAST_DUE) },
    });
    if (existing) {
      throw conflict();
    }

    const days = dto.periodDays ?? plan.billingPeriodDays;
    let saved: UserSubscription;
    try {
      saved = await this.userSubscriptions.save(
        this.userSubscriptions.create({
          userId: dto.userId,
          planId: plan.id,
          audience: plan.audience,
          status: SubscriptionStatus.Active,
          currentPeriodEnd: new Date(Date.now() + days * 86_400_000),
          cancelAtPeriodEnd: false,
          bogParentOrderId: null,
          grantedByAdminId: adminId,
          expiryNoticeSentAt: null,
        }),
      );
    } catch (err) {
      if (err instanceof QueryFailedError && (err as QueryFailedError & { code?: string }).code === '23505') {
        throw conflict();
      }
      throw err;
    }
    await this.notify(
      dto.userId,
      NotificationType.SubscriptionGranted,
      'გამოწერა გააქტიურდა',
      `WaveHub-მა გაგიფორმათ გეგმა „${plan.name}“ ${days} დღით. ავტომატური განახლება არ არის.`,
      saved.id,
    );
    return saved;
  }

  // Ends a live subscription immediately (perks stop now). For a BOG-billed one this also stops
  // future recharges since the sweep only looks at live rows; the saved card is left untouched.
  async revokeSubscription(subscriptionId: string): Promise<UserSubscription> {
    const sub = await this.userSubscriptions.findOne({ where: { id: subscriptionId }, relations: ['plan'] });
    if (!sub) {
      throw new NotFoundException('Subscription not found');
    }
    if (!ACTIVE_OR_PAST_DUE.includes(sub.status)) {
      throw new ConflictException('This subscription is not live');
    }
    await this.userSubscriptions.update(sub.id, { status: SubscriptionStatus.Cancelled, cancelAtPeriodEnd: false });
    await this.notify(
      sub.userId,
      NotificationType.SubscriptionCancelled,
      'გამოწერა შეწყდა',
      `თქვენი გეგმა „${sub.plan.name}“ შეწყვიტა WaveHub-ის ადმინისტრაციამ.`,
      sub.id,
    );
    sub.status = SubscriptionStatus.Cancelled;
    return sub;
  }

  // Read-only API other modules call to apply a perk — e.g.
  // `(await subscriptions.getActivePerks(sellerId, SubscriptionAudience.SellerCoach))
  //   ?.platformFeeDiscountPercent ?? 0`. Deliberately includes `PastDue` (see the grace-period
  // comment on PAST_DUE_GRACE_MS above) — only `Cancelled`/`Expired` lose perks.
  async getActivePerks(userId: string, audience: SubscriptionAudience): Promise<SubscriptionPerks | null> {
    const row = await this.userSubscriptions.findOne({
      where: { userId, audience, status: In(ACTIVE_OR_PAST_DUE) },
      relations: ['plan'],
    });
    return row?.plan.perks ?? null;
  }

  // The platform fee % a given seller/coach actually pays: the global rate minus their plan's
  // `platformFeeDiscountPercent`, in percentage POINTS (a 3 turns a 10% fee into 7%), floored at 0.
  // Callers snapshot the result onto the order/session, so a later plan change never retroactively
  // alters an in-flight deal's fee. Rounded because `platformFeePercentSnapshot` is an integer
  // column and the fee is computed from the same value that gets snapshotted.
  async effectiveFeePercent(sellerOrCoachId: string, basePercent: number): Promise<number> {
    const perks = await this.getActivePerks(sellerOrCoachId, SubscriptionAudience.SellerCoach);
    const discount = Math.max(0, perks?.platformFeeDiscountPercent ?? 0);
    return Math.max(0, Math.round(basePercent - discount));
  }

  // Batched variant for list pages (e.g. the coach directory) — one query for a whole page of
  // users instead of N `getActivePerks` calls. Users with no live subscription are simply absent.
  async getActivePerksForUsers(
    userIds: string[],
    audience: SubscriptionAudience,
  ): Promise<Map<string, SubscriptionPerks>> {
    const result = new Map<string, SubscriptionPerks>();
    if (userIds.length === 0) return result;
    const rows = await this.userSubscriptions.find({
      where: { userId: In(userIds), audience, status: In(ACTIVE_OR_PAST_DUE) },
      relations: ['plan'],
    });
    for (const row of rows) result.set(row.userId, row.plan.perks);
    return result;
  }

  // --- Checkout (first payment for a plan) ---

  // Real limitation, not an oversight: BOG's background-recharge API always re-charges the exact
  // amount of the "parent" order (see BogPaymentsService#chargeSavedCard's own comment) — there is
  // no in-place way to move an existing subscription to a different price. So switching plans (or
  // re-subscribing after a lapse) always means a brand-new checkout or a brand-new parent order,
  // never an amount change on the old one. This method enforces "cancel your current plan for this
  // audience before starting a new one" for exactly that reason — a real UX constraint from BOG's
  // API shape, not a shortcut. The partial unique index on `user_subscriptions` is the actual
  // race-safe backstop; this check just gives a clean error instead of a raw constraint violation.
  async startCheckout(
    userId: string,
    dto: CheckoutSubscriptionDto,
  ): Promise<{ orderId: string; redirectUrl: string }> {
    const plan = await this.plans.findOne({ where: { id: dto.planId, isActive: true } });
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }
    const existing = await this.userSubscriptions.findOne({
      where: { userId, audience: plan.audience, status: In(ACTIVE_OR_PAST_DUE) },
    });
    if (existing) {
      throw new ForbiddenException(
        'You already have an active subscription for this audience — cancel it before subscribing to a different plan',
      );
    }
    const user = await this.users.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const transactionId = randomUUID();
    const callbackUrl = `${process.env.BACKEND_PUBLIC_URL || 'http://localhost:4000'}/subscriptions/bog-callback`;
    const order = await this.bogPayments.createSubscriptionOrder({
      amountGel: plan.priceGel,
      planName: `${plan.name} (${plan.tier})`,
      username: user.username,
      transactionId,
      successUrl: dto.successUrl,
      failUrl: dto.failUrl,
      callbackUrl,
    });

    await this.attempts.save(
      this.attempts.create({
        id: transactionId,
        kind: 'checkout',
        userId,
        planId: plan.id,
        amountGel: plan.priceGel,
        status: 'pending',
        bogOrderId: order.orderId,
      }),
    );

    return order;
  }

  // --- BOG callback handling (shared by checkout confirmation and every recharge) ---

  // Called by SubscriptionsController after signature verification — same
  // never-trust-the-callback-body-alone discipline as backend/src/payments/: re-fetches the
  // authoritative status from BOG before acting on anything.
  async handleBogCallback(bogOrderId: string): Promise<void> {
    const details = await this.bogPayments.getOrderDetails(bogOrderId);
    const transactionId = details.externalOrderId;
    if (!transactionId) {
      this.logger.warn(`BOG subscription order ${bogOrderId} has no external_order_id.`);
      return;
    }

    const attempt = await this.attempts.findOne({ where: { id: transactionId } });
    if (!attempt) {
      this.logger.warn(`No subscription charge attempt found for transactionId ${transactionId}.`);
      return;
    }

    if (details.orderStatus === 'completed') {
      if (attempt.status !== 'completed') {
        const handled =
          attempt.kind === 'checkout' ? await this.activateFromCheckout(attempt) : await this.confirmRecharge(attempt);
        // Left `pending` on failure so a BOG callback retry (or manual review) can still recover it.
        if (handled) {
          await this.attempts.update(attempt.id, { status: 'completed' });
        }
      }
    } else if (['rejected', 'refunded', 'refunded_partially'].includes(details.orderStatus)) {
      if (attempt.status === 'pending') {
        await this.attempts.update(attempt.id, { status: 'failed' });
        if (attempt.kind === 'recharge' && attempt.subscriptionId) {
          const sub = await this.userSubscriptions.findOne({ where: { id: attempt.subscriptionId }, relations: ['plan'] });
          if (sub) {
            await this.markPastDue(sub, sub.plan.name);
          } else {
            await this.userSubscriptions.update(attempt.subscriptionId, { status: SubscriptionStatus.PastDue });
          }
        }
      }
    }
  }

  private async activateFromCheckout(attempt: SubscriptionChargeAttempt): Promise<boolean> {
    const plan = attempt.planId ? await this.plans.findOne({ where: { id: attempt.planId } }) : null;
    if (!plan || !attempt.bogOrderId) {
      this.logger.error(`Cannot activate subscription for attempt ${attempt.id}: missing plan or bogOrderId.`);
      return false;
    }
    try {
      await this.bogPayments.saveCard(attempt.bogOrderId);
    } catch (err) {
      // A payment that succeeded but whose card we couldn't save is a real problem (we have the
      // buyer's money for period 1 but no way to recharge for period 2) — log loudly for manual
      // follow-up rather than silently activating a subscription with no working renewal path.
      this.logger.error(
        `Payment for subscription checkout ${attempt.id} succeeded but saving the card failed — subscription NOT activated, needs manual review.`,
        err as Error,
      );
      return false;
    }

    const currentPeriodEnd = new Date(Date.now() + plan.billingPeriodDays * 86_400_000);
    await this.userSubscriptions.save(
      this.userSubscriptions.create({
        userId: attempt.userId,
        planId: plan.id,
        audience: plan.audience,
        status: SubscriptionStatus.Active,
        currentPeriodEnd,
        cancelAtPeriodEnd: false,
        bogParentOrderId: attempt.bogOrderId,
        grantedByAdminId: null,
        expiryNoticeSentAt: null,
      }),
    );
    return true;
  }

  private async confirmRecharge(attempt: SubscriptionChargeAttempt): Promise<boolean> {
    if (!attempt.subscriptionId) {
      return false;
    }
    const sub = await this.userSubscriptions.findOne({ where: { id: attempt.subscriptionId }, relations: ['plan'] });
    if (!sub) {
      return false;
    }
    // Anchor from "now" rather than the old currentPeriodEnd if the subscription had gone
    // past_due for a while — otherwise a subscription that recovers after 5 days past_due would
    // get a new period end only 25 days out instead of a full fresh period.
    const anchor = Math.max(sub.currentPeriodEnd.getTime(), Date.now());
    await this.userSubscriptions.update(sub.id, {
      status: SubscriptionStatus.Active,
      currentPeriodEnd: new Date(anchor + sub.plan.billingPeriodDays * 86_400_000),
      expiryNoticeSentAt: null,
    });
    return true;
  }

  // --- Cancellation (perks continue until the period actually ends) ---

  async cancel(userId: string, subscriptionId: string): Promise<PublicUserSubscription> {
    const sub = await this.getOwnedOrThrow(userId, subscriptionId);
    if (!ACTIVE_OR_PAST_DUE.includes(sub.status)) {
      throw new ForbiddenException('This subscription is not active');
    }
    await this.userSubscriptions.update(sub.id, { cancelAtPeriodEnd: true });
    const updated = await this.userSubscriptions.findOne({ where: { id: sub.id }, relations: ['plan'] });
    return this.toPublic(updated!);
  }

  // --- The hourly sweep — same @nestjs/schedule cadence as OrdersService's auto-complete cron ---

  @Cron('0 * * * *')
  async sweepDueSubscriptions(): Promise<void> {
    const now = new Date();
    const due = await this.userSubscriptions.find({
      where: { status: In(ACTIVE_OR_PAST_DUE), currentPeriodEnd: LessThanOrEqual(now) },
      relations: ['plan'],
    });

    for (const sub of due) {
      try {
        await this.processDueSubscription(sub, now);
      } catch (err) {
        this.logger.error(`Failed to process due subscription ${sub.id}`, err as Error);
      }
    }

    try {
      await this.sendExpiryNotices(now);
    } catch (err) {
      this.logger.error('Failed to send subscription expiry notices', err as Error);
    }
  }

  // One "about to expire" notice per period for subscriptions that will NOT auto-renew (cancelled-
  // at-period-end, or a manual grant with no card). Auto-renewing ones aren't expiring, so no notice.
  private async sendExpiryNotices(now: Date): Promise<void> {
    const soon = new Date(now.getTime() + EXPIRY_NOTICE_MS);
    const base = { status: SubscriptionStatus.Active, currentPeriodEnd: Between(now, soon), expiryNoticeSentAt: IsNull() };
    const rows = await this.userSubscriptions.find({
      where: [
        { ...base, cancelAtPeriodEnd: true },
        { ...base, bogParentOrderId: IsNull() },
      ],
      relations: ['plan'],
    });
    for (const sub of rows) {
      await this.userSubscriptions.update(sub.id, { expiryNoticeSentAt: now });
      await this.notify(
        sub.userId,
        NotificationType.SubscriptionExpiring,
        'გამოწერა მალე ამოიწურება',
        `თქვენი გეგმა „${sub.plan.name}“ ${sub.currentPeriodEnd.toLocaleDateString('ka-GE')}-ს ამოიწურება და აღარ განახლდება.`,
        sub.id,
      );
    }
  }

  private async processDueSubscription(sub: UserSubscription, now: Date): Promise<void> {
    if (sub.cancelAtPeriodEnd) {
      await this.userSubscriptions.update(sub.id, { status: SubscriptionStatus.Cancelled });
      await this.notify(
        sub.userId,
        NotificationType.SubscriptionCancelled,
        'გამოწერა დასრულდა',
        `თქვენი გეგმა „${sub.plan.name}“ გაუქმდა პერიოდის ბოლოს, როგორც მოითხოვეთ.`,
        sub.id,
      );
      return;
    }
    const parentOrderId = sub.bogParentOrderId;
    const graceOver =
      sub.status === SubscriptionStatus.PastDue && now.getTime() - sub.currentPeriodEnd.getTime() > PAST_DUE_GRACE_MS;
    // A manual admin grant has no saved card to recharge — it simply expires at period end.
    if (!parentOrderId || graceOver) {
      await this.userSubscriptions.update(sub.id, { status: SubscriptionStatus.Expired });
      await this.notify(
        sub.userId,
        NotificationType.SubscriptionExpired,
        'გამოწერა ამოიწურა',
        `თქვენი გეგმა „${sub.plan.name}“ ამოიწურა და პრივილეგიები გამორთულია. შეგიძლიათ ახალი გეგმა გამოიწეროთ გვერდზე „გამოწერები“.`,
        sub.id,
      );
      return;
    }

    const recentAttempt = await this.attempts.findOne({
      where: { subscriptionId: sub.id, status: 'pending' },
      order: { createdAt: 'DESC' },
    });
    if (recentAttempt && now.getTime() - recentAttempt.createdAt.getTime() < STUCK_ATTEMPT_MS) {
      return; // a recharge for this period is still plausibly in flight — don't double-dispatch
    }

    const transactionId = randomUUID();
    const callbackUrl = `${process.env.BACKEND_PUBLIC_URL || 'http://localhost:4000'}/subscriptions/bog-callback`;
    try {
      const charge = await this.bogPayments.chargeSavedCard(parentOrderId, transactionId, callbackUrl);
      await this.attempts.save(
        this.attempts.create({
          id: transactionId,
          kind: 'recharge',
          userId: sub.userId,
          subscriptionId: sub.id,
          amountGel: sub.plan.priceGel,
          status: 'pending',
          bogOrderId: charge.orderId,
        }),
      );
    } catch (err) {
      this.logger.error(`Failed to dispatch recharge for subscription ${sub.id}`, err as Error);
      await this.attempts.save(
        this.attempts.create({
          id: transactionId,
          kind: 'recharge',
          userId: sub.userId,
          subscriptionId: sub.id,
          amountGel: sub.plan.priceGel,
          status: 'failed',
          bogOrderId: null,
        }),
      );
      await this.markPastDue(sub, sub.plan.name);
    }
  }

  private async getPlanOrThrow(id: string): Promise<SubscriptionPlan> {
    const plan = await this.plans.findOne({ where: { id } });
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }
    return plan;
  }

  private async getOwnedOrThrow(userId: string, subscriptionId: string): Promise<UserSubscription> {
    const sub = await this.userSubscriptions.findOne({ where: { id: subscriptionId } });
    if (!sub) {
      throw new NotFoundException('Subscription not found');
    }
    if (sub.userId !== userId) {
      throw new ForbiddenException("This subscription doesn't belong to you");
    }
    return sub;
  }

  private toPublicPlan(plan: SubscriptionPlan): PublicSubscriptionPlan {
    return {
      id: plan.id,
      audience: plan.audience,
      tier: plan.tier,
      name: plan.name,
      description: plan.description,
      priceGel: plan.priceGel,
      billingPeriodDays: plan.billingPeriodDays,
      perks: plan.perks,
      sortOrder: plan.sortOrder,
    };
  }

  private toAdminPlan(plan: SubscriptionPlan): AdminSubscriptionPlanSummary {
    return { ...this.toPublicPlan(plan), isActive: plan.isActive };
  }

  private toPublic(sub: UserSubscription): PublicUserSubscription {
    return {
      id: sub.id,
      plan: this.toPublicPlan(sub.plan),
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      isGranted: sub.bogParentOrderId === null,
      createdAt: sub.createdAt.toISOString(),
    };
  }
}
