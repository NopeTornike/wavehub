import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TournamentMatchStage, TournamentStatus, TournamentTeamStatus } from '@wavehub/shared-types';
import { TournamentsService } from './tournaments.service';
import { Tournament } from './tournament.entity';
import { TournamentRegistration } from './tournament-registration.entity';
import { User } from '../users/user.entity';

// Registration concurrency and the real SQL are covered by the Postgres e2e suite
// (test/social.e2e-spec.ts, test/tournaments.e2e-spec.ts); this spec pins the rules.
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
      maxPlayers: 8,
      teamSize: 1,
      prizes: { places: [], specialRewards: [], note: null },
      coverImageUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  function build(opts: { tournament?: any; players?: number; teams?: number; registeredUserIds?: string[]; teamRows?: any[] } = {}) {
    const tournamentRow = opts.tournament === null ? null : opts.tournament ?? fakeTournament();
    const registered = new Set(opts.registeredUserIds ?? []);
    const saved: any[] = [];
    const countsRow = { teams: opts.teams ?? 0, players: opts.players ?? 0 };

    const manager: any = {
      query: jest.fn(async () => [countsRow]),
      findOne: jest.fn(async (entity: any, { where }: any) => {
        if (entity === Tournament) return tournamentRow;
        if (entity === TournamentRegistration) return registered.has(where.userId) ? { id: 'r' } : null;
        return null;
      }),
      findOneOrFail: jest.fn(async (entity: any) => (entity === User ? { id: userId, username: 'player_one' } : {})),
      create: jest.fn((_entity: any, data: any) => ({ id: `row-${saved.length + 1}`, createdAt: new Date(), ...data })),
      save: jest.fn(async (row: any) => {
        saved.push(row);
        return row;
      }),
    };
    const dataSource: any = { manager, transaction: jest.fn(async (cb: any) => cb(manager)) };

    const tournaments = {
      findOne: jest.fn(async () => tournamentRow),
      create: jest.fn((data: any) => ({ id: tournamentId, createdAt: new Date(), updatedAt: new Date(), game: gameRow, ...data })),
      save: jest.fn(async (entity: any) => entity),
      update: jest.fn(async () => undefined),
      delete: jest.fn(async () => undefined),
    } as any;
    const registrations = {
      find: jest.fn(async () => [...registered].map((id) => ({ tournamentId, userId: id }))),
    } as any;
    const teamRows = opts.teamRows ?? [];
    const teams = {
      findOneOrFail: jest.fn(async () => ({ ...saved.find((r) => r.members), captain: { username: 'player_one' } })),
      findOne: jest.fn(async () => teamRows[0] ?? null),
      count: jest.fn(async ({ where }: any) => teamRows.filter((t) => where.id.value.includes(t.id)).length),
      delete: jest.fn(async () => ({ affected: 1 })),
    } as any;
    const matches = {
      create: jest.fn((data: any) => ({ ...data })),
      save: jest.fn(async (m: any) => ({ id: 'match-1', ...m })),
      findOne: jest.fn(async () => null),
      createQueryBuilder: jest.fn(),
    } as any;
    const storage = { save: jest.fn(async () => ({ url: 'http://x/uploads/file.png' })) } as any;

    const service = new TournamentsService(tournaments, registrations, teams, matches, dataSource, storage);
    return { service, saved, tournaments, teams, matches };
  }

  describe('register (solo)', () => {
    it('rejects a tournament that does not exist', async () => {
      const { service } = build({ tournament: null });
      await expect(service.register(tournamentId, userId)).rejects.toThrow(NotFoundException);
    });

    it('rejects registration when the tournament is not Open', async () => {
      const { service } = build({ tournament: fakeTournament({ status: TournamentStatus.Upcoming }) });
      await expect(service.register(tournamentId, userId)).rejects.toThrow(ForbiddenException);
    });

    it('rejects registration once the tournament is full', async () => {
      const { service } = build({ tournament: fakeTournament({ maxPlayers: 2 }), players: 2 });
      await expect(service.register(tournamentId, userId)).rejects.toThrow('This tournament is full');
    });

    it('rejects a duplicate registration from the same user', async () => {
      const { service } = build({ registeredUserIds: [userId] });
      await expect(service.register(tournamentId, userId)).rejects.toThrow('You are already registered for this tournament');
    });

    it('sends squad tournaments to team registration', async () => {
      const { service } = build({ tournament: fakeTournament({ teamSize: 4 }) });
      await expect(service.register(tournamentId, userId)).rejects.toThrow(BadRequestException);
    });

    it('creates a verified one-player team named after the user plus a registration pointing at it', async () => {
      const { service, saved } = build();
      await service.register(tournamentId, userId);
      const team = saved.find((row) => row.members);
      expect(team).toMatchObject({ name: 'player_one', members: ['player_one'], status: TournamentTeamStatus.Verified, captainUserId: userId });
      expect(saved.find((row) => row.teamId === team.id)).toMatchObject({ tournamentId, userId });
    });
  });

  describe('registerTeam (squad)', () => {
    const squad = () => fakeTournament({ teamSize: 4, maxPlayers: 16 });
    const dto = (members: string[]) => ({ name: 'Wave Riders', tag: 'wrd', members });

    it('requires exactly teamSize players', async () => {
      const { service } = build({ tournament: squad() });
      await expect(service.registerTeam(tournamentId, userId, dto(['a', 'b', 'c']))).rejects.toThrow('A team needs exactly 4 players');
    });

    it('rejects duplicate player names (case-insensitive)', async () => {
      const { service } = build({ tournament: squad() });
      await expect(service.registerTeam(tournamentId, userId, dto(['Ana', 'ana', 'b', 'c']))).rejects.toThrow('Player names must be different');
    });

    it('rejects a team that would exceed the player capacity', async () => {
      const { service } = build({ tournament: squad(), players: 13 });
      await expect(service.registerTeam(tournamentId, userId, dto(['a', 'b', 'c', 'd']))).rejects.toThrow('This tournament is full');
    });

    it('is refused for a solo tournament', async () => {
      const { service } = build();
      await expect(service.registerTeam(tournamentId, userId, dto(['a']))).rejects.toThrow(BadRequestException);
    });

    it('saves a pending team with an upper-cased tag', async () => {
      const { service, saved } = build({ tournament: squad() });
      const team = await service.registerTeam(tournamentId, userId, dto(['a', 'b', 'c', 'd']));
      expect(saved.find((row) => row.members)).toMatchObject({ status: TournamentTeamStatus.Pending, tag: 'WRD' });
      expect(team.members).toEqual(['a', 'b', 'c', 'd']);
    });
  });

  describe('update', () => {
    it('refuses to change the team size once teams have registered', async () => {
      const { service } = build({ teams: 1 });
      await expect(service.update(tournamentId, { teamSize: 4 })).rejects.toThrow(ConflictException);
    });
  });

  describe('withdraw', () => {
    it('is refused once the tournament is in progress', async () => {
      const { service } = build({ tournament: fakeTournament({ status: TournamentStatus.InProgress }) });
      await expect(service.withdraw(tournamentId, userId)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('matches', () => {
    it('rejects a team playing itself', async () => {
      const { service } = build();
      await expect(service.adminCreateMatch(tournamentId, { teamAId: 'team-1', teamBId: 'team-1' })).rejects.toThrow('A team cannot play itself');
    });

    it('rejects teams from another tournament', async () => {
      const { service } = build({ teamRows: [{ id: 'team-1' }] });
      await expect(service.adminCreateMatch(tournamentId, { teamAId: 'team-1', teamBId: 'team-2', stage: TournamentMatchStage.Final })).rejects.toThrow(
        'Both teams must be registered in this tournament',
      );
    });
  });

  describe('create', () => {
    it('defaults status to Upcoming, team size to solo and an empty prize breakdown', async () => {
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
      expect(tournament.teamSize).toBe(1);
      expect(tournament.prizes).toEqual({ places: [], specialRewards: [], note: null });
    });
  });

  describe('findPublicById', () => {
    it('reports players, teams and max teams', async () => {
      const { service } = build({ tournament: fakeTournament({ teamSize: 4, maxPlayers: 64 }), players: 8, teams: 2 });
      const result = await service.findPublicById(tournamentId);
      expect(result).toMatchObject({ gameName: 'PUBG Mobile', registeredCount: 8, teamCount: 2, maxTeams: 16, teamSize: 4 });
    });
  });
});
