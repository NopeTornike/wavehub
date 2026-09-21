import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { SubscriptionAudience, SubscriptionStatus } from '@wavehub/shared-types';
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
    bogParentOrderId: 'parent-1', plan: makePlan(), createdAt: new Date(), ...over,
  };
}

function build(opts: { plan?: any; subs?: any[]; attempts?: any[]; orderStatus?: string; chargeFails?: boolean; saveCardFails?: boolean } = {}) {
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
  const users = { findById: jest.fn(async () => ({ id: userId, username: 'bob' })) };
  const service = new SubscriptionsService(plans as any, userSubs as any, attemptRepo as any, bog as any, users as any);
  return { service, plans, userSubs, attemptRepo, bog };
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
});
