import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { NotificationType, SubscriptionAudience, SubscriptionStatus } from '@wavehub/shared-types';
import { SubscriptionsService } from './subscriptions.service';

const DAY = 86_400_000;
const userId = 'user-1';

function makePlan(over: Record<string, unknown> = {}) {
  return {
    id: 'plan-1', audience: SubscriptionAudience.SellerCoach, tier: 'pro', name: 'Pro', description: '',
    priceGel: 20, billingPeriodDays: 30, perks: { platformFeeDiscountPercent: 3 }, sortOrder: 0, isActive: true,
    ...over,
  };
}
function makeSub(over: Record<string, unknown> = {}) {
  return {
    id: 'sub-1', userId, planId: 'plan-1', audience: SubscriptionAudience.SellerCoach,
    status: SubscriptionStatus.Active, currentPeriodEnd: new Date(Date.now() - 1000), cancelAtPeriodEnd: false,
    bogParentOrderId: 'parent-1', grantedByAdminId: null, expiryNoticeSentAt: null, plan: makePlan(), createdAt: new Date(), ...over,
  };
}

function build(opts: { plan?: any; subs?: any[]; attempts?: any[]; orderStatus?: string; chargeFails?: boolean; saveCardFails?: boolean; notifyFails?: boolean } = {}) {
  const plan = opts.plan === undefined ? makePlan() : opts.plan;
  const subs = opts.subs ?? [];
  const attempts = opts.attempts ?? [];
  const plans = { findOne: jest.fn(async () => plan), create: jest.fn((x: any) => x), save: jest.fn(async (x: any) => x), find: jest.fn(async () => []) };
  const userSubs = {
    findOne: jest.fn(async ({ where }: any) => subs.find((s) => (where.id ? s.id === where.id : s.userId === where.userId && s.audience === where.audience)) ?? null),
    find: jest.fn(async () => subs),
    create: jest.fn((x: any) => x),
    save: jest.fn(async (x: any) => x),
    update: jest.fn(async () => undefined),
  };
  const attemptRepo = {
    findOne: jest.fn(async ({ where }: any) => attempts.find((a) => (where.id ? a.id === where.id : a.status === where.status && a.subscriptionId === where.subscriptionId)) ?? null),
    create: jest.fn((x: any) => x),
    save: jest.fn(async (x: any) => x),
    update: jest.fn(async () => undefined),
  };
  const bog = {
    createSubscriptionOrder: jest.fn(async () => ({ orderId: 'bog-1', redirectUrl: 'https://pay' })),
    getOrderDetails: jest.fn(async () => ({ externalOrderId: attempts[0]?.id, orderStatus: opts.orderStatus ?? 'completed' })),
    saveCard: jest.fn(async () => { if (opts.saveCardFails) throw new Error('nope'); }),
    chargeSavedCard: jest.fn(async () => { if (opts.chargeFails) throw new Error('declined'); return { orderId: 'bog-2' }; }),
  };
  const users = { findById: jest.fn(async (id: string) => (id === 'missing' ? null : { id, username: 'bob', email: 'bob@example.com' })) };
  const notifications = { emit: jest.fn(async () => { if (opts.notifyFails) throw new Error('notify down'); }) };
  const service = new SubscriptionsService(plans as any, userSubs as any, attemptRepo as any, bog as any, users as any, notifications as any);
  return { service, plans, userSubs, attemptRepo, bog, notifications, users };
}

describe('SubscriptionsService', () => {
  describe('getActivePerks / effectiveFeePercent', () => {
    it('returns the plan perks for an active subscription and null otherwise', async () => {
      const { service } = build({ subs: [makeSub()] });
      expect(await service.getActivePerks(userId, SubscriptionAudience.SellerCoach)).toEqual({ platformFeeDiscountPercent: 3 });
      expect(await service.getActivePerks('other', SubscriptionAudience.SellerCoach)).toBeNull();
    });

    it('subtracts the discount in percentage points and leaves non-subscribers at the base rate', async () => {
      const { service } = build({ subs: [makeSub()] });
      expect(await service.effectiveFeePercent(userId, 10)).toBe(7);
      expect(await service.effectiveFeePercent('other', 10)).toBe(10);
    });

    it('floors the effective fee at zero', async () => {
      const { service } = build({ subs: [makeSub({ plan: makePlan({ perks: { platformFeeDiscountPercent: 25 } }) })] });
      expect(await service.effectiveFeePercent(userId, 10)).toBe(0);
    });
  });

  describe('startCheckout', () => {
    const dto = { planId: 'plan-1', successUrl: 'http://x/ok', failUrl: 'http://x/fail' } as any;

    it('rejects an unknown/inactive plan', async () => {
      const { service } = build({ plan: null });
      await expect(service.startCheckout(userId, dto)).rejects.toThrow(NotFoundException);
    });

    it('rejects when a live subscription already exists for the audience', async () => {
      const { service, bog } = build({ subs: [makeSub({ status: SubscriptionStatus.PastDue })] });
      await expect(service.startCheckout(userId, dto)).rejects.toThrow(ForbiddenException);
      expect(bog.createSubscriptionOrder).not.toHaveBeenCalled();
    });

    it('creates a BOG order and records a pending checkout attempt', async () => {
      const { service, attemptRepo, bog } = build();
      const res = await service.startCheckout(userId, dto);
      expect(res.orderId).toBe('bog-1');
      expect(bog.createSubscriptionOrder).toHaveBeenCalledWith(expect.objectContaining({ amountGel: 20 }));
      expect(attemptRepo.save).toHaveBeenCalledWith(expect.objectContaining({ kind: 'checkout', status: 'pending', bogOrderId: 'bog-1' }));
    });
  });

  describe('handleBogCallback', () => {
    const checkout = { id: 't1', kind: 'checkout', userId, planId: 'plan-1', status: 'pending', bogOrderId: 'bog-1', createdAt: new Date() };

    it('activates a subscription once a checkout completes and the card is saved', async () => {
      const { service, userSubs, bog, attemptRepo } = build({ attempts: [{ ...checkout }] });
      await service.handleBogCallback('bog-1');
      expect(bog.saveCard).toHaveBeenCalledWith('bog-1');
      expect(userSubs.save).toHaveBeenCalledWith(expect.objectContaining({ status: SubscriptionStatus.Active, bogParentOrderId: 'bog-1', audience: SubscriptionAudience.SellerCoach }));
      expect(attemptRepo.update).toHaveBeenCalledWith('t1', { status: 'completed' });
    });

    it('does NOT activate (and leaves the attempt pending for retry) if saving the card fails', async () => {
      const { service, userSubs, attemptRepo } = build({ attempts: [{ ...checkout }], saveCardFails: true });
      await service.handleBogCallback('bog-1');
      expect(userSubs.save).not.toHaveBeenCalled();
      expect(attemptRepo.update).not.toHaveBeenCalled(); // stays pending so a callback retry can recover
    });

    it('is idempotent for an already-completed attempt', async () => {
      const { service, userSubs, bog } = build({ attempts: [{ ...checkout, status: 'completed' }] });
      await service.handleBogCallback('bog-1');
      expect(bog.saveCard).not.toHaveBeenCalled();
      expect(userSubs.save).not.toHaveBeenCalled();
    });

    it('marks a rejected recharge failed and the subscription past_due', async () => {
      const recharge = { id: 't2', kind: 'recharge', userId, subscriptionId: 'sub-1', status: 'pending', createdAt: new Date() };
      const { service, userSubs, attemptRepo } = build({ attempts: [recharge], orderStatus: 'rejected' });
      await service.handleBogCallback('bog-2');
      expect(attemptRepo.update).toHaveBeenCalledWith('t2', { status: 'failed' });
      expect(userSubs.update).toHaveBeenCalledWith('sub-1', { status: SubscriptionStatus.PastDue });
    });

    it('a completed recharge extends the period by one billing period and reactivates', async () => {
      const recharge = { id: 't2', kind: 'recharge', userId, subscriptionId: 'sub-1', status: 'pending', createdAt: new Date() };
      const { service, userSubs } = build({ attempts: [recharge], subs: [makeSub({ status: SubscriptionStatus.PastDue })] });
      await service.handleBogCallback('bog-2');
      const [, patch] = (userSubs.update as jest.Mock).mock.calls[0];
      expect(patch.status).toBe(SubscriptionStatus.Active);
      expect(patch.currentPeriodEnd.getTime()).toBeGreaterThan(Date.now() + 29 * DAY);
    });
  });

  describe('cancel', () => {
    it("rejects cancelling someone else's subscription", async () => {
      const { service } = build({ subs: [makeSub({ userId: 'other' })] });
      await expect(service.cancel(userId, 'sub-1')).rejects.toThrow(ForbiddenException);
    });
    it('flags cancelAtPeriodEnd without touching status', async () => {
      const { service, userSubs } = build({ subs: [makeSub()] });
      await service.cancel(userId, 'sub-1');
      expect(userSubs.update).toHaveBeenCalledWith('sub-1', { cancelAtPeriodEnd: true });
    });
  });

  describe('sweepDueSubscriptions', () => {
    it('cancels a due subscription flagged cancelAtPeriodEnd', async () => {
      const { service, userSubs, bog } = build({ subs: [makeSub({ cancelAtPeriodEnd: true })] });
      await service.sweepDueSubscriptions();
      expect(userSubs.update).toHaveBeenCalledWith('sub-1', { status: SubscriptionStatus.Cancelled });
      expect(bog.chargeSavedCard).not.toHaveBeenCalled();
    });

    it('expires a past_due subscription beyond the 7-day grace', async () => {
      const { service, userSubs } = build({ subs: [makeSub({ status: SubscriptionStatus.PastDue, currentPeriodEnd: new Date(Date.now() - 8 * DAY) })] });
      await service.sweepDueSubscriptions();
      expect(userSubs.update).toHaveBeenCalledWith('sub-1', { status: SubscriptionStatus.Expired });
    });

    it('dispatches a recharge and records a pending attempt', async () => {
      const { service, bog, attemptRepo } = build({ subs: [makeSub()] });
      await service.sweepDueSubscriptions();
      expect(bog.chargeSavedCard).toHaveBeenCalledWith('parent-1', expect.any(String), expect.stringContaining('/subscriptions/bog-callback'));
      expect(attemptRepo.save).toHaveBeenCalledWith(expect.objectContaining({ kind: 'recharge', status: 'pending', bogOrderId: 'bog-2' }));
    });

    it('does not double-dispatch while a recent attempt is still pending', async () => {
      const { service, bog } = build({ subs: [makeSub()], attempts: [{ id: 'a', subscriptionId: 'sub-1', status: 'pending', createdAt: new Date() }] });
      await service.sweepDueSubscriptions();
      expect(bog.chargeSavedCard).not.toHaveBeenCalled();
    });

    it('marks past_due and records a failed attempt when dispatch throws', async () => {
      const { service, userSubs, attemptRepo } = build({ subs: [makeSub()], chargeFails: true });
      await service.sweepDueSubscriptions();
      expect(attemptRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
      expect(userSubs.update).toHaveBeenCalledWith('sub-1', { status: SubscriptionStatus.PastDue });
    });
  });

  describe('notifications', () => {
    it('notifies (in-app + email) on a rejected recharge callback moving active -> past_due', async () => {
      const recharge = { id: 't2', kind: 'recharge', userId, subscriptionId: 'sub-1', status: 'pending', createdAt: new Date() };
      const { service, notifications } = build({ attempts: [recharge], subs: [makeSub()], orderStatus: 'rejected' });
      await service.handleBogCallback('bog-2');
      expect(notifications.emit).toHaveBeenCalledWith(userId, NotificationType.SubscriptionPastDue, expect.any(String), expect.any(String), { subscriptionId: 'sub-1' }, { to: 'bob@example.com', subject: expect.any(String) });
    });

    it('does not re-notify when a dispatch fails for an already past_due subscription', async () => {
      const { service, notifications } = build({ subs: [makeSub({ status: SubscriptionStatus.PastDue, currentPeriodEnd: new Date(Date.now() - DAY) })], chargeFails: true });
      await service.sweepDueSubscriptions();
      expect((notifications.emit as jest.Mock).mock.calls.filter((c) => c[1] === NotificationType.SubscriptionPastDue)).toHaveLength(0);
    });

    it('notifies past_due when the first dispatch throws', async () => {
      const { service, notifications } = build({ subs: [makeSub()], chargeFails: true });
      await service.sweepDueSubscriptions();
      expect((notifications.emit as jest.Mock).mock.calls.filter((c) => c[1] === NotificationType.SubscriptionPastDue)).toHaveLength(1);
    });

    it('notifies on cancel-at-period-end and on grace expiry', async () => {
      const a = build({ subs: [makeSub({ cancelAtPeriodEnd: true })] });
      await a.service.sweepDueSubscriptions();
      expect((a.notifications.emit as jest.Mock).mock.calls.some((c) => c[1] === NotificationType.SubscriptionCancelled)).toBe(true);
      const b = build({ subs: [makeSub({ status: SubscriptionStatus.PastDue, currentPeriodEnd: new Date(Date.now() - 8 * DAY) })] });
      await b.service.sweepDueSubscriptions();
      expect((b.notifications.emit as jest.Mock).mock.calls.some((c) => c[1] === NotificationType.SubscriptionExpired)).toBe(true);
    });

    it('never lets a notification failure break the sweep', async () => {
      const { service, userSubs } = build({ subs: [makeSub({ cancelAtPeriodEnd: true })], notifyFails: true });
      await expect(service.sweepDueSubscriptions()).resolves.toBeUndefined();
      expect(userSubs.update).toHaveBeenCalledWith('sub-1', { status: SubscriptionStatus.Cancelled });
    });

    it('sends one expiry notice for non-renewing subscriptions and stamps expiryNoticeSentAt', async () => {
      const { service, userSubs, notifications } = build({ subs: [makeSub({ currentPeriodEnd: new Date(Date.now() + DAY), bogParentOrderId: null })] });
      // first find() (due sweep) returns the same fixture; make it not due by using a future end
      (userSubs.find as jest.Mock).mockResolvedValueOnce([]);
      await service.sweepDueSubscriptions();
      expect(userSubs.update).toHaveBeenCalledWith('sub-1', { expiryNoticeSentAt: expect.any(Date) });
      expect((notifications.emit as jest.Mock).mock.calls.some((c) => c[1] === NotificationType.SubscriptionExpiring)).toBe(true);
    });
  });

  describe('admin grant / revoke', () => {
    const grantDto = { userId, planId: 'plan-1', reason: 'compensation' } as any;

    it('grants a subscription with no BOG parent for the plan period and notifies', async () => {
      const { service, userSubs, notifications } = build();
      const sub = await service.grantSubscription('admin-1', grantDto);
      expect(userSubs.save).toHaveBeenCalledWith(expect.objectContaining({ bogParentOrderId: null, grantedByAdminId: 'admin-1', status: SubscriptionStatus.Active }));
      expect(sub.currentPeriodEnd.getTime()).toBeGreaterThan(Date.now() + 29 * DAY);
      expect((notifications.emit as jest.Mock).mock.calls.some((c) => c[1] === NotificationType.SubscriptionGranted)).toBe(true);
    });

    it('honours periodDays', async () => {
      const { service } = build();
      const sub = await service.grantSubscription('admin-1', { ...grantDto, periodDays: 5 });
      expect(sub.currentPeriodEnd.getTime()).toBeLessThan(Date.now() + 6 * DAY);
    });

    it('rejects an unknown plan, unknown user, and an existing live subscription', async () => {
      await expect(build({ plan: null }).service.grantSubscription('a', grantDto)).rejects.toThrow(NotFoundException);
      await expect(build().service.grantSubscription('a', { ...grantDto, userId: 'missing' })).rejects.toThrow(NotFoundException);
      const { service, userSubs } = build({ subs: [makeSub({ status: SubscriptionStatus.PastDue })] });
      await expect(service.grantSubscription('a', grantDto)).rejects.toThrow(ConflictException);
      expect(userSubs.save).not.toHaveBeenCalled();
    });

    it('the sweep expires a granted subscription at period end without ever charging', async () => {
      const { service, userSubs, bog } = build({ subs: [makeSub({ bogParentOrderId: null })] });
      await service.sweepDueSubscriptions();
      expect(userSubs.update).toHaveBeenCalledWith('sub-1', { status: SubscriptionStatus.Expired });
      expect(bog.chargeSavedCard).not.toHaveBeenCalled();
    });

    it('revokes a live subscription immediately and rejects a non-live or missing one', async () => {
      const { service, userSubs } = build({ subs: [makeSub()] });
      await service.revokeSubscription('sub-1');
      expect(userSubs.update).toHaveBeenCalledWith('sub-1', { status: SubscriptionStatus.Cancelled, cancelAtPeriodEnd: false });
      await expect(build({ subs: [makeSub({ status: SubscriptionStatus.Expired })] }).service.revokeSubscription('sub-1')).rejects.toThrow(ConflictException);
      await expect(build().service.revokeSubscription('nope')).rejects.toThrow(NotFoundException);
    });
  });
});
