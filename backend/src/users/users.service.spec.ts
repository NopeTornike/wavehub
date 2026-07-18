import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UserStatus } from '@wavehub/shared-types';
import { UsersService } from './users.service';

// Same fake-repository approach as listings.service.spec.ts/reviews.service.spec.ts. Focuses on
// the suspend/restore/ban/unban guard clauses — the one place this service has real business
// logic (listAdmin's search/filter is thin query-builder plumbing, better covered once there's a
// real Postgres to test against, same philosophy as the build plan's testing section).
describe('UsersService', () => {
  function build(user: any) {
    const row = { moderationReason: null, createdAt: new Date('2026-01-01T00:00:00Z'), ...user };
    const repo = {
      findOne: jest.fn(async () => row),
      update: jest.fn(async (_id: string, patch: any) => Object.assign(row, patch)),
    } as any;
    const service = new UsersService(repo);
    return { service, repo, row };
  }

  describe('suspend', () => {
    it('suspends an active user and records the reason', async () => {
      const { service, repo } = build({ id: 'u1', status: UserStatus.Active });
      const result = await service.suspend('u1', 'spamming listings');
      expect(result.status).toBe(UserStatus.Suspended);
      expect(result.moderationReason).toBe('spamming listings');
      expect(repo.update).toHaveBeenCalledWith('u1', {
        status: UserStatus.Suspended,
        moderationReason: 'spamming listings',
      });
    });

    it('refuses to suspend an already-banned user', async () => {
      const { service } = build({ id: 'u1', status: UserStatus.Banned });
      await expect(service.suspend('u1', 'reason')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for a missing user', async () => {
      const repo = { findOne: jest.fn(async () => null) } as any;
      const service = new UsersService(repo);
      await expect(service.suspend('missing', 'reason')).rejects.toThrow(NotFoundException);
    });
  });

  describe('restore', () => {
    it('restores a suspended user to active and clears the reason', async () => {
      const { service, row } = build({ id: 'u1', status: UserStatus.Suspended, moderationReason: 'old reason' });
      const result = await service.restore('u1');
      expect(result.status).toBe(UserStatus.Active);
      expect(result.moderationReason).toBeNull();
      expect(row.status).toBe(UserStatus.Active);
    });

    it('refuses to restore a user who is not suspended', async () => {
      const { service } = build({ id: 'u1', status: UserStatus.Active });
      await expect(service.restore('u1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('ban', () => {
    it('bans a user regardless of current status', async () => {
      const { service } = build({ id: 'u1', status: UserStatus.Suspended });
      const result = await service.ban('u1', 'fraud');
      expect(result.status).toBe(UserStatus.Banned);
      expect(result.moderationReason).toBe('fraud');
    });
  });

  describe('unban', () => {
    it('unbans a banned user back to active', async () => {
      const { service } = build({ id: 'u1', status: UserStatus.Banned, moderationReason: 'fraud' });
      const result = await service.unban('u1');
      expect(result.status).toBe(UserStatus.Active);
      expect(result.moderationReason).toBeNull();
    });

    it('refuses to unban a user who is not banned', async () => {
      const { service } = build({ id: 'u1', status: UserStatus.Active });
      await expect(service.unban('u1')).rejects.toThrow(BadRequestException);
    });
  });
});
