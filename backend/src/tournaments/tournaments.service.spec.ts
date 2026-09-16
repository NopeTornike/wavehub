import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TournamentStatus } from '@wavehub/shared-types';
import { TournamentsService } from './tournaments.service';

describe('TournamentsService', () => {
  const tournamentId = 'tournament-1';
  const userId = 'user-1';
  const gameRow = { id: 'game-1', name: 'PUBG Mobile' };

  function fakeTournament(overrides: any = {}) {
    return {
      id: tournamentId,
      gameId: gameRow.id,
      game: gameRow,
      name: 'WaveHub Cup',
      description: 'A'.repeat(20),
      prize: '1,000 GEL',
      status: TournamentStatus.Open,
      startDate: '2026-12-01',
      maxPlayers: 2,
      coverImageUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  function build(opts: { tournament?: any; registrationCount?: number; registeredUserIds?: string[] } = {}) {
    const tournamentRow = opts.tournament === null ? null : opts.tournament ?? fakeTournament();
    const registeredUserIds = new Set(opts.registeredUserIds ?? []);

    const tournaments = {
      findOne: jest.fn(async () => tournamentRow),
      create: jest.fn((data: any) => ({ id: tournamentId, createdAt: new Date(), updatedAt: new Date(), game: gameRow, ...data })),
      save: jest.fn(async (entity: any) => entity),
      update: jest.fn(async () => undefined),
      delete: jest.fn(async () => undefined),
      createQueryBuilder: jest.fn(() => ({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn(async () => [tournamentRow ? [tournamentRow] : [], tournamentRow ? 1 : 0]),
      })),
    } as any;

    const registrations = {
      count: jest.fn(async ({ where }: any) => {
        if (where.userId) return registeredUserIds.has(where.userId) ? 1 : 0;
        return opts.registrationCount ?? 0;
      }),
      create: jest.fn((data: any) => data),
      save: jest.fn(async (entity: any) => {
        if (registeredUserIds.has(entity.userId)) {
          throw Object.assign(new Error('duplicate'), { code: '23505' });
        }
        registeredUserIds.add(entity.userId);
        return entity;
      }),
      find: jest.fn(async () => [...registeredUserIds].map((id) => ({ tournamentId, userId: id }))),
    } as any;

    const storage = { save: jest.fn(async () => ({ url: 'http://x/uploads/file.png' })) } as any;

    const service = new TournamentsService(tournaments, registrations, storage);
    return { service, tournaments, registrations, storage };
  }

  describe('register', () => {
    it('rejects a tournament that does not exist', async () => {
      const { service } = build({ tournament: null });
      await expect(service.register(tournamentId, userId)).rejects.toThrow(NotFoundException);
    });

    it('rejects registration when the tournament is not Open', async () => {
      const { service } = build({ tournament: fakeTournament({ status: TournamentStatus.Upcoming }) });
      await expect(service.register(tournamentId, userId)).rejects.toThrow(ForbiddenException);
    });

    it('rejects registration once the tournament is full', async () => {
      const { service } = build({ tournament: fakeTournament({ maxPlayers: 2 }), registrationCount: 2 });
      await expect(service.register(tournamentId, userId)).rejects.toThrow(ForbiddenException);
    });

    it('registers a user and increments the visible count', async () => {
      const { service } = build({ tournament: fakeTournament({ maxPlayers: 2 }), registrationCount: 0 });
      const result = await service.register(tournamentId, userId);
      expect(result.id).toBe(tournamentId);
    });

    it('rejects a duplicate registration from the same user', async () => {
      const { service } = build({ tournament: fakeTournament(), registeredUserIds: [userId] });
      await expect(service.register(tournamentId, userId)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findPublicById', () => {
    it('throws NotFoundException for an unknown tournament', async () => {
      const { service } = build({ tournament: null });
      await expect(service.findPublicById('missing')).rejects.toThrow(NotFoundException);
    });

    it('returns the game name joined from the Game relation', async () => {
      const { service } = build();
      const result = await service.findPublicById(tournamentId);
      expect(result.gameName).toBe('PUBG Mobile');
    });
  });

  describe('listMyRegisteredIds', () => {
    it('returns only the tournament ids the caller registered for', async () => {
      const { service } = build({ registeredUserIds: [userId] });
      const ids = await service.listMyRegisteredIds(userId);
      expect(ids).toEqual([tournamentId]);
    });
  });

  describe('create', () => {
    it('defaults status to Upcoming when not provided', async () => {
      const { service } = build();
      const tournament = await service.create({
        gameId: gameRow.id,
        name: 'New Cup',
        description: 'B'.repeat(20),
        prize: '500 GEL',
        startDate: '2026-12-01',
        maxPlayers: 32,
      });
      expect(tournament.status).toBe(TournamentStatus.Upcoming);
    });
  });
});
