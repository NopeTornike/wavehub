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
    const platformSettings = { getPlatformFeePercent: jest.fn(async () => 10), getCoachingFeePercent: jest.fn(async () => 10), getSessionAutoConfirmHours: jest.fn(async () => 48) } as any;
    const notifications = { emit: jest.fn() } as any;

    const packages = {
      getActive: jest.fn(async (id: string) => {
        if (id !== 'pkg-1') throw new NotFoundException('This package is not available');
        return { id: 'pkg-1', name: 'VOD review', sessionsCount: 1, durationMinutes: 45, priceWaveCoin: 25 };
      }),
    } as any;
    const service = new CoachingSessionsService(sessions, coaches, {} as any, dataSource, wallet, platformSettings, notifications, { getActivePerks: jest.fn(async () => null), getActivePerksForUsers: jest.fn(async () => new Map()), effectiveFeePercent: jest.fn(async (_id: string, base: number) => base) } as any, packages);
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

    // Booking internals (price split, package snapshot, answers, overlap, escrow) run against real
    // Postgres in test/coaching.e2e-spec.ts, test/coach-admin.e2e-spec.ts and
    // test/coaching-lifecycle.e2e-spec.ts.
  });

  // Lifecycle v2 (coaching-session-lifecycle.ts): pay the coach only after the student confirms.
  function manager(locked: any, coach = fakeCoach()) {
    return {
      update: jest.fn(async () => undefined),
      findOne: jest.fn(async () => locked),
      findOneOrFail: jest.fn(async () => coach),
    };
  }

  describe('confirmStart', () => {
    const soon = () => new Date(Date.now() + 5 * 60_000); // inside the 15-minute early window

    it('refuses before the start window and after the deadline', async () => {
      const { service, sessions } = build();
      sessions.findOne.mockResolvedValue(fakeSession({ scheduledAt: new Date(Date.now() + 60 * 60_000) }));
      await expect(service.confirmStart(sessionId, buyerId)).rejects.toThrow('from 15 minutes before');
      sessions.findOne.mockResolvedValue(fakeSession({ scheduledAt: new Date(Date.now() - 61 * 60_000) }));
      await expect(service.confirmStart(sessionId, buyerId)).rejects.toThrow('has passed');
    });

    it('records one side, and starts the session once both confirmed', async () => {
      const { service, sessions, dataSource } = build();
      const row = fakeSession({ scheduledAt: soon(), coachStartConfirmedAt: new Date() });
      sessions.findOne.mockResolvedValue(row);
      const m = manager({ ...row });
      dataSource.transaction.mockImplementation((fn: any) => fn(m));
      await service.confirmStart(sessionId, buyerId);
      expect(m.update).toHaveBeenCalledWith(
        expect.anything(),
        sessionId,
        expect.objectContaining({ status: CoachingSessionStatus.InProgress, buyerStartConfirmedAt: expect.any(Date), startedAt: expect.any(Date) }),
      );
    });

    it('only one side so far: stays Scheduled', async () => {
      const { service, sessions, dataSource } = build();
      const row = fakeSession({ scheduledAt: soon() });
      sessions.findOne.mockResolvedValue(row);
      const m = manager({ ...row });
      dataSource.transaction.mockImplementation((fn: any) => fn(m));
      await service.confirmStart(sessionId, coachUserId);
      const patch = (m.update.mock.calls[0] as any[])[2];
      expect(patch.coachStartConfirmedAt).toBeInstanceOf(Date);
      expect(patch.status).toBeUndefined();
    });
  });

  describe('complete (coach marks done)', () => {
    it('refuses anyone but the coach', async () => {
      const { service, sessions } = build();
      sessions.findOne.mockResolvedValue(fakeSession({ status: CoachingSessionStatus.InProgress }));
      await expect(service.complete(sessionId, buyerId)).rejects.toThrow(ForbiddenException);
    });

    it('refuses a session that never started (the coach can no longer take the money directly)', async () => {
      const { service, sessions, wallet } = build();
      sessions.findOne.mockResolvedValue(fakeSession({ status: CoachingSessionStatus.Scheduled }));
      await expect(service.complete(sessionId, coachUserId)).rejects.toThrow('confirm the session started');
      expect(wallet.releaseCoachEarnings).not.toHaveBeenCalled();
    });

    it('moves InProgress to AwaitingConfirmation without paying anyone', async () => {
      const { service, sessions, dataSource, wallet } = build();
      sessions.findOne.mockResolvedValue(fakeSession({ status: CoachingSessionStatus.InProgress }));
      const m = manager({ status: CoachingSessionStatus.InProgress });
      dataSource.transaction.mockImplementation((fn: any) => fn(m));
      await service.complete(sessionId, coachUserId);
      expect(m.update).toHaveBeenCalledWith(expect.anything(), sessionId, expect.objectContaining({ status: CoachingSessionStatus.AwaitingConfirmation }));
      expect(wallet.releaseCoachEarnings).not.toHaveBeenCalled();
    });
  });

  describe('confirmComplete (student)', () => {
    it('only the student, only while awaiting confirmation', async () => {
      const { service, sessions } = build();
      sessions.findOne.mockResolvedValue(fakeSession({ status: CoachingSessionStatus.AwaitingConfirmation }));
      await expect(service.confirmComplete(sessionId, coachUserId)).rejects.toThrow(ForbiddenException);
      sessions.findOne.mockResolvedValue(fakeSession({ status: CoachingSessionStatus.InProgress }));
      await expect(service.confirmComplete(sessionId, buyerId)).rejects.toThrow(InvalidCoachingSessionTransitionError);
    });

    it('releases the coach payout and asks the student for a review', async () => {
      const { service, sessions, dataSource, wallet, notifications } = build();
      const row = fakeSession({ status: CoachingSessionStatus.AwaitingConfirmation });
      sessions.findOne.mockResolvedValue(row);
      const m = manager({ ...row });
      dataSource.transaction.mockImplementation((fn: any) => fn(m));
      await service.confirmComplete(sessionId, buyerId);
      expect(wallet.releaseCoachEarnings).toHaveBeenCalledWith(coachUserId, sessionId, row.coachPayoutWaveCoin, 7, m);
      expect(notifications.emit.mock.calls.map((c: any[]) => c[1])).toEqual(expect.arrayContaining(['session_completed', 'session_review_request']));
    });
  });

  describe('cancel', () => {
    it('refuses a non-participant', async () => {
      const { service, sessions } = build();
      sessions.findOne.mockResolvedValue(fakeSession());
      await expect(service.cancel(sessionId, 'stranger')).rejects.toThrow(ForbiddenException);
    });

    it('the student cannot cancel once it started; the coach can (full refund)', async () => {
      const { service, sessions, dataSource, wallet } = build();
      const row = fakeSession({ status: CoachingSessionStatus.InProgress });
      sessions.findOne.mockResolvedValue(row);
      await expect(service.cancel(sessionId, buyerId)).rejects.toThrow('contact support');
      const m = manager({ ...row });
      dataSource.transaction.mockImplementation((fn: any) => fn(m));
      await service.cancel(sessionId, coachUserId);
      expect(wallet.refundBuyerForSession).toHaveBeenCalledWith(buyerId, sessionId, row.priceWaveCoin, m);
    });

    it('re-checks under the row lock and refunds nothing if a completion already won', async () => {
      const { service, sessions, dataSource, wallet } = build();
      sessions.findOne.mockResolvedValue(fakeSession({ status: CoachingSessionStatus.Scheduled }));
      const m = manager({ status: CoachingSessionStatus.Completed });
      dataSource.transaction.mockImplementation((fn: any) => fn(m));
      await expect(service.cancel(sessionId, buyerId)).rejects.toThrow();
      expect(wallet.refundBuyerForSession).not.toHaveBeenCalled();
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
