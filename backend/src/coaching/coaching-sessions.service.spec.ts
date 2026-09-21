import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CoachStatus, CoachingSessionStatus, VerificationStatus } from '@wavehub/shared-types';
import { CoachingSessionsService } from './coaching-sessions.service';
import { InvalidCoachingSessionTransitionError } from './coaching-session-lifecycle';

// Same fake-repository + mocked-transaction approach as orders.service.spec.ts — enough surface
// for the constructor, the pre-transaction guard clauses, and a driven transaction callback (this
// module is small enough that driving the real callback for the happy paths was worth it, unlike
// orders.service.spec.ts's "left for a real Postgres" note).
describe('CoachingSessionsService', () => {
  const buyerId = 'buyer-1';
  const coachUserId = 'coach-user-1';
  const coachId = 'coach-1';
  const sessionId = 'session-1';

  function fakeCoach(overrides: any = {}) {
    return {
      id: coachId,
      userId: coachUserId,
      hourlyRateWaveCoin: 60,
      verificationStatus: VerificationStatus.Verified,
      status: CoachStatus.Active,
      user: { id: coachUserId, username: 'thecoach', firstName: 'Coach', lastName: 'Person' },
      ...overrides,
    };
  }

  function fakeSession(overrides: any = {}) {
    return {
      id: sessionId,
      coachId,
      coach: fakeCoach(),
      buyerId,
      buyer: { id: buyerId, username: 'thebuyer' },
      scheduledAt: new Date(Date.now() + 86_400_000),
      durationMinutes: 60,
      priceWaveCoin: 60,
      platformFeePercentSnapshot: 10,
      platformFeeWaveCoin: 6,
      coachPayoutWaveCoin: 54,
      buyerMessage: null,
      status: CoachingSessionStatus.Scheduled,
      createdAt: new Date(),
      ...overrides,
    };
  }

  function build(opts: { coach?: any; session?: any } = {}) {
    const coachRow = opts.coach === null ? null : opts.coach ?? fakeCoach();
    const sessionRows = new Map<string, any>();
    if (opts.session) sessionRows.set(opts.session.id, opts.session);

    const sessions = {
      findOne: jest.fn(async ({ where }: any) => sessionRows.get(where.id) ?? null),
      find: jest.fn(async () => [...sessionRows.values()]),
    } as any;
    const coaches = {
      findOne: jest.fn(async () => coachRow),
    } as any;
    const dataSource = { transaction: jest.fn() } as any;
    const wallet = {
      lockAccount: jest.fn(),
      debitForSession: jest.fn(),
      releaseCoachEarnings: jest.fn(),
      refundBuyerForSession: jest.fn(),
    } as any;
    const platformSettings = { getPlatformFeePercent: jest.fn(async () => 10) } as any;
    const notifications = { emit: jest.fn() } as any;

    const service = new CoachingSessionsService(sessions, coaches, dataSource, wallet, platformSettings, notifications, { getActivePerks: jest.fn(async () => null), getActivePerksForUsers: jest.fn(async () => new Map()), effectiveFeePercent: jest.fn(async (_id: string, base: number) => base) } as any);
    return { service, sessions, coaches, dataSource, wallet, platformSettings, notifications, sessionRows };
  }

  describe('request', () => {
    it('rejects a coach that does not exist', async () => {
      const { service } = build({ coach: null });
      await expect(
        service.request(buyerId, coachId, { scheduledAt: new Date(Date.now() + 86_400_000).toISOString(), durationMinutes: 60 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects a coach that is not Verified + Active', async () => {
      const { service } = build({ coach: fakeCoach({ verificationStatus: VerificationStatus.Pending }) });
      await expect(
        service.request(buyerId, coachId, { scheduledAt: new Date(Date.now() + 86_400_000).toISOString(), durationMinutes: 60 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects a suspended coach even if verified', async () => {
      const { service } = build({ coach: fakeCoach({ status: CoachStatus.Suspended }) });
      await expect(
        service.request(buyerId, coachId, { scheduledAt: new Date(Date.now() + 86_400_000).toISOString(), durationMinutes: 60 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("rejects a coach booking a session with themselves", async () => {
      const { service } = build({ coach: fakeCoach({ userId: buyerId }) });
      await expect(
        service.request(buyerId, coachId, { scheduledAt: new Date(Date.now() + 86_400_000).toISOString(), durationMinutes: 60 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects a scheduledAt that is not in the future', async () => {
      const { service } = build();
      await expect(
        service.request(buyerId, coachId, { scheduledAt: new Date(Date.now() - 1000).toISOString(), durationMinutes: 60 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('computes price from hourlyRateWaveCoin x duration and proceeds to the transaction', async () => {
      const { service, dataSource, wallet, sessions } = build({ coach: fakeCoach({ hourlyRateWaveCoin: 60 }) });
      const manager = {
        create: jest.fn((_entity: any, data: any) => data),
        save: jest.fn(async (row: any) => ({ ...row, id: sessionId })),
      };
      dataSource.transaction.mockImplementation((fn: any) => fn(manager));
      sessions.findOne.mockResolvedValue(fakeSession({ priceWaveCoin: 30, durationMinutes: 30 }));

      const result = await service.request(buyerId, coachId, {
        scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
        durationMinutes: 30,
      });

      // 60 WC/hour x 30 minutes = 30 WC
      expect(manager.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ priceWaveCoin: 30, coachPayoutWaveCoin: 27, platformFeeWaveCoin: 3 }),
      );
      expect(wallet.debitForSession).toHaveBeenCalledWith(buyerId, sessionId, 30, manager);
      expect(result.priceWaveCoin).toBe(30);
    });

    it("translates WalletService.debitForSession's INSUFFICIENT_BALANCE into a clean ForbiddenException", async () => {
      const { service, dataSource, wallet, sessions } = build();
      const manager = {
        create: jest.fn((_entity: any, data: any) => data),
        save: jest.fn(async (row: any) => ({ ...row, id: sessionId })),
      };
      dataSource.transaction.mockImplementation((fn: any) => fn(manager));
      wallet.debitForSession.mockRejectedValue(new Error('INSUFFICIENT_BALANCE'));
      sessions.findOne.mockResolvedValue(fakeSession());

      await expect(
        service.request(buyerId, coachId, { scheduledAt: new Date(Date.now() + 86_400_000).toISOString(), durationMinutes: 60 }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('complete', () => {
    it('refuses to let anyone but the coach mark a session completed', async () => {
      const { service, sessions } = build();
      sessions.findOne.mockResolvedValue(fakeSession());
      await expect(service.complete(sessionId, buyerId)).rejects.toThrow(ForbiddenException);
    });

    it('refuses to complete a session that is not Scheduled', async () => {
      const { service, sessions } = build();
      sessions.findOne.mockResolvedValue(fakeSession({ status: CoachingSessionStatus.Cancelled }));
      await expect(service.complete(sessionId, coachUserId)).rejects.toThrow(
        InvalidCoachingSessionTransitionError,
      );
    });

    it('releases escrow to the coach and flips status to Completed', async () => {
      const { service, sessions, dataSource, wallet } = build();
      const row = fakeSession();
      sessions.findOne.mockResolvedValue(row);
      const manager = { update: jest.fn(async () => undefined) };
      dataSource.transaction.mockImplementation(async (fn: any) => {
        await fn(manager);
      });

      await service.complete(sessionId, coachUserId);

      expect(wallet.releaseCoachEarnings).toHaveBeenCalledWith(coachUserId, sessionId, row.coachPayoutWaveCoin, 7, manager);
      expect(manager.update).toHaveBeenCalledWith(expect.anything(), sessionId, { status: CoachingSessionStatus.Completed });
    });
  });

  describe('cancel', () => {
    it('refuses a non-participant', async () => {
      const { service, sessions } = build();
      sessions.findOne.mockResolvedValue(fakeSession());
      await expect(service.cancel(sessionId, 'stranger')).rejects.toThrow(ForbiddenException);
    });

    it('refuses to cancel a session that is not Scheduled', async () => {
      const { service, sessions } = build();
      sessions.findOne.mockResolvedValue(fakeSession({ status: CoachingSessionStatus.Completed }));
      await expect(service.cancel(sessionId, buyerId)).rejects.toThrow(InvalidCoachingSessionTransitionError);
    });

    it('lets the buyer cancel and refunds them in full', async () => {
      const { service, sessions, dataSource, wallet } = build();
      const row = fakeSession();
      sessions.findOne.mockResolvedValue(row);
      const manager = { update: jest.fn(async () => undefined) };
      dataSource.transaction.mockImplementation(async (fn: any) => {
        await fn(manager);
      });

      await service.cancel(sessionId, buyerId);

      expect(wallet.refundBuyerForSession).toHaveBeenCalledWith(buyerId, sessionId, row.priceWaveCoin, manager);
      expect(manager.update).toHaveBeenCalledWith(expect.anything(), sessionId, { status: CoachingSessionStatus.Cancelled });
    });

    it('lets the coach cancel too, still refunding the buyer', async () => {
      const { service, sessions, dataSource, wallet } = build();
      const row = fakeSession();
      sessions.findOne.mockResolvedValue(row);
      const manager = { update: jest.fn(async () => undefined) };
      dataSource.transaction.mockImplementation(async (fn: any) => {
        await fn(manager);
      });

      await service.cancel(sessionId, coachUserId);

      expect(wallet.refundBuyerForSession).toHaveBeenCalledWith(buyerId, sessionId, row.priceWaveCoin, manager);
    });
  });

  describe('getForParticipant', () => {
    it('throws NotFoundException for an unknown session', async () => {
      const { service } = build();
      await expect(service.getForParticipant('missing', buyerId)).rejects.toThrow(NotFoundException);
    });

    it('refuses a caller who is neither the buyer nor the coach', async () => {
      const { service, sessions } = build();
      sessions.findOne.mockResolvedValue(fakeSession());
      await expect(service.getForParticipant(sessionId, 'stranger')).rejects.toThrow(ForbiddenException);
    });
  });
});
