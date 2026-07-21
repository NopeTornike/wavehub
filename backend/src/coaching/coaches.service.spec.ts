import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CoachStatus, VerificationStatus } from '@wavehub/shared-types';
import { CoachesService } from './coaches.service';
import { InvalidCoachVerificationTransitionError } from './coach-lifecycle';

// Same fake-repository approach as listings.service.spec.ts / users.service.spec.ts.
describe('CoachesService', () => {
  const userId = 'user-1';
  const coachId = 'coach-1';

  function fakeUser() {
    return { id: userId, username: 'coach-user', firstName: 'A', lastName: 'B' };
  }

  function build(existing: any = null) {
    const rows = new Map<string, any>();
    if (existing) rows.set(existing.id, { createdAt: new Date(), updatedAt: new Date(), ...existing });

    const repo = {
      findOne: jest.fn(async ({ where }: any) => {
        if (where.id) return rows.get(where.id) ?? null;
        if (where.userId) return [...rows.values()].find((r) => r.userId === where.userId) ?? null;
        return null;
      }),
      create: jest.fn((data: any) => ({ id: coachId, createdAt: new Date(), updatedAt: new Date(), user: fakeUser(), game: null, ...data })),
      save: jest.fn(async (entity: any) => {
        rows.set(entity.id, entity);
        return entity;
      }),
      update: jest.fn(async (id: string, patch: any) => {
        const row = rows.get(id);
        Object.assign(row, patch);
      }),
    } as any;

    const service = new CoachesService(repo);
    return { service, repo, rows };
  }

  describe('apply', () => {
    it('creates a new Pending application for a first-time applicant', async () => {
      const { service } = build();
      const coach = await service.apply(userId, {
        specialty: 'PUBG Coach',
        bio: 'A'.repeat(30),
        hourlyRateWaveCoin: 10,
      });
      expect(coach.verificationStatus).toBe(VerificationStatus.Pending);
      expect(coach.status).toBe(CoachStatus.Active);
    });

    it('reopens a rejected application back to Pending instead of creating a second row', async () => {
      const { service, rows } = build({
        id: coachId,
        userId,
        verificationStatus: VerificationStatus.Rejected,
        rejectionReason: 'not enough experience',
        status: CoachStatus.Active,
        user: fakeUser(),
        game: null,
        languages: [],
      });
      const coach = await service.apply(userId, {
        specialty: 'PUBG Coach v2',
        bio: 'B'.repeat(30),
        hourlyRateWaveCoin: 12,
      });
      expect(coach.verificationStatus).toBe(VerificationStatus.Pending);
      expect(coach.rejectionReason).toBeNull();
      expect(rows.size).toBe(1);
    });

    it('rejects a second application while one is already Pending', async () => {
      const { service } = build({
        id: coachId,
        userId,
        verificationStatus: VerificationStatus.Pending,
        status: CoachStatus.Active,
        user: fakeUser(),
        game: null,
        languages: [],
      });
      await expect(
        service.apply(userId, { specialty: 'x', bio: 'y'.repeat(30), hourlyRateWaveCoin: 5 }),
      ).rejects.toThrow(InvalidCoachVerificationTransitionError);
    });
  });

  describe('approve/reject', () => {
    it('approves a pending coach', async () => {
      const { service } = build({
        id: coachId,
        userId,
        verificationStatus: VerificationStatus.Pending,
        status: CoachStatus.Active,
        user: fakeUser(),
        game: null,
        languages: [],
      });
      const result = await service.approve(coachId);
      expect(result.verificationStatus).toBe(VerificationStatus.Verified);
    });

    it('refuses to approve an already-verified coach', async () => {
      const { service } = build({
        id: coachId,
        userId,
        verificationStatus: VerificationStatus.Verified,
        status: CoachStatus.Active,
        user: fakeUser(),
        game: null,
        languages: [],
      });
      await expect(service.approve(coachId)).rejects.toThrow(InvalidCoachVerificationTransitionError);
    });

    it('rejects a pending coach with a reason', async () => {
      const { service } = build({
        id: coachId,
        userId,
        verificationStatus: VerificationStatus.Pending,
        status: CoachStatus.Active,
        user: fakeUser(),
        game: null,
        languages: [],
      });
      const result = await service.reject(coachId, 'insufficient rank proof');
      expect(result.verificationStatus).toBe(VerificationStatus.Rejected);
      expect(result.rejectionReason).toBe('insufficient rank proof');
    });
  });

  describe('suspend/restore', () => {
    it('suspends an active coach', async () => {
      const { service } = build({
        id: coachId,
        userId,
        verificationStatus: VerificationStatus.Verified,
        status: CoachStatus.Active,
        user: fakeUser(),
        game: null,
        languages: [],
      });
      const result = await service.suspend(coachId);
      expect(result.status).toBe(CoachStatus.Suspended);
    });

    it('refuses to suspend an already-suspended coach', async () => {
      const { service } = build({
        id: coachId,
        userId,
        verificationStatus: VerificationStatus.Verified,
        status: CoachStatus.Suspended,
        user: fakeUser(),
        game: null,
        languages: [],
      });
      await expect(service.suspend(coachId)).rejects.toThrow(ForbiddenException);
    });

    it('refuses to restore a coach that is not suspended', async () => {
      const { service } = build({
        id: coachId,
        userId,
        verificationStatus: VerificationStatus.Verified,
        status: CoachStatus.Active,
        user: fakeUser(),
        game: null,
        languages: [],
      });
      await expect(service.restore(coachId)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findPublicById', () => {
    it('throws NotFoundException for a coach that is not verified+active', async () => {
      const { service, repo } = build();
      repo.findOne.mockResolvedValueOnce(null);
      await expect(service.findPublicById('missing')).rejects.toThrow(NotFoundException);
    });
  });
});
