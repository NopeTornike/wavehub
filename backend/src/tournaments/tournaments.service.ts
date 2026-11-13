import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { assertGameInScope, type StaffScope } from '../admin/staff-scope';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { AdminRole, brBracket, brMatchPoints, brMatchTeams, NotificationType, TournamentMatchStage, TournamentMatchStatus, TournamentStatus, TournamentTeamStatus, UserStatus } from '@wavehub/shared-types';
import type {
  AdminTournamentMatch,
  MatchRoomSide,
  MatchRoomView,
  MatchTeamStats,
  MyTournamentEntry,
  PublicTournamentMatch,
  PublicTournamentSummary,
  PublicTournamentTeam,
  TournamentPlayerLookup,
  TournamentPrizes,
  TournamentTeamPlayer,
  TournamentFormat,
  TournamentTeamRef,
} from '@wavehub/shared-types';
import { Tournament } from './tournament.entity';
import { TournamentRegistration } from './tournament-registration.entity';
import { TournamentTeam } from './tournament-team.entity';
import { TournamentTeamMember } from './tournament-team-member.entity';
import { TournamentMatch } from './tournament-match.entity';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { BrowseTournamentsDto } from './dto/browse-tournaments.dto';
import { RegisterSoloDto, RegisterTeamDto } from './dto/register-team.dto';
import { AutoGroupsDto, BrMatchesDto, MatchDto, MatchResultsDto, MatchRoomDto, MatchRoomSideDto, MatchTeamStatsDto, RoundRobinDto, TeamGroupDto } from './dto/match.dto';
import { TournamentMatchResult } from './tournament-match-result.entity';
import { Game } from '../listings/game.entity';
import { TournamentNotifier } from './tournament-notifier.service';
import { StorageService } from '../storage/storage.service';
import { User } from '../users/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { personName } from '../common/person-name';

const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_COVER_BYTES = 5 * 1024 * 1024;
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const EMPTY_PRIZES: TournamentPrizes = { places: [], specialRewards: [], note: null };
const BR_GAME_SLUGS = ['pubg-mobile', 'free-fire', 'fortnite'];
// Withdrawing (or registering) is only possible before play starts.
const REGISTRATION_EDITABLE = [TournamentStatus.Open, TournamentStatus.Upcoming];

type UploadedImage = { buffer: Buffer; originalname: string; mimetype: string; size: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Relations every team read needs: the captain (username) and the linked roster with accounts.
const TEAM_RELATIONS = { captain: true, roster: { user: true } } as const;

function normalizeStats(stats: MatchTeamStatsDto | null | undefined, accounts: Map<string, string>): MatchTeamStats | null {
  if (!stats) return null;
  return {
    coach: stats.coach?.trim() || null,
    players: stats.players.map((p) => ({
      name: p.name.trim(),
      userId: p.username ? (accounts.get(p.username.trim().replace(/^@/, '').toLowerCase()) ?? null) : null,
      kills: p.kills ?? null,
      kd: p.kd ?? null,
      damage: p.damage ?? null,
      rating: p.rating ?? null,
      assists: p.assists ?? null,
      mvp: !!p.mvp,
    })),
  };
}

// Staff who manage tournaments (SPECIFICATION.md §5.13); the controller guards its admin routes
// with the same list.
export const TOURNAMENT_MANAGEMENT_ROLES = [AdminRole.OperationLead, AdminRole.MainAdministrator, AdminRole.MarketplaceCoachingOpsManager, AdminRole.GameManager];
// A Game Manager reaches these routes but only for its tournament games (owner 2026-11-06):
// the controller checks every tournament's game with assertTournamentInScope.

@Injectable()
export class TournamentsService {
  private readonly logger = new Logger(TournamentsService.name);

  constructor(
    @InjectRepository(Tournament) private readonly tournaments: Repository<Tournament>,
    @InjectRepository(TournamentRegistration) private readonly registrations: Repository<TournamentRegistration>,
    @InjectRepository(TournamentTeam) private readonly teams: Repository<TournamentTeam>,
    @InjectRepository(TournamentMatch) private readonly matches: Repository<TournamentMatch>,
    @InjectRepository(TournamentTeamMember) private readonly members: Repository<TournamentTeamMember>,
    private readonly dataSource: DataSource,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
    // Optional so unit specs that build the service by hand keep working; Nest always injects it.
    private readonly notifier?: TournamentNotifier,
  ) {}

  // --- Mapping ---

  // Public responses are deliberately not personalized (no "am I registered" field): the frontend
  // cross-references the authenticated GET tournaments/mine / me/tournaments instead.
  private async counts(tournamentId: string, manager: EntityManager = this.dataSource.manager): Promise<{ teams: number; players: number }> {
    const [row] = await manager.query(
      `SELECT count(*)::int AS teams, coalesce(sum(jsonb_array_length("members")), 0)::int AS players
       FROM "tournament_teams" WHERE "tournamentId" = $1 AND "status" <> 'rejected'`,
      [tournamentId],
    );
    return { teams: row?.teams ?? 0, players: row?.players ?? 0 };
  }

  private async toPublic(tournament: Tournament): Promise<PublicTournamentSummary> {
    const { teams, players } = await this.counts(tournament.id);
    const teamSize = tournament.teamSize ?? 1;
    return {
      id: tournament.id,
      gameId: tournament.gameId,
      gameName: tournament.game.name,
      name: tournament.name,
      description: tournament.description,
      prize: tournament.prize,
      status: tournament.status,
      startDate: tournament.startDate,
      maxPlayers: tournament.maxPlayers,
      registeredCount: players,
      coverImageUrl: tournament.coverImageUrl,
      details: tournament.details ?? {},
      rules: tournament.rules ?? null,
      teamSize,
      teamCount: teams,
      maxTeams: Math.floor(tournament.maxPlayers / teamSize),
      prizes: { ...EMPTY_PRIZES, ...(tournament.prizes ?? {}) },
      pointsPerWin: tournament.pointsPerWin ?? 3,
      pointsPerLoss: tournament.pointsPerLoss ?? 0,
      qualifyPoints: tournament.qualifyPoints ?? null,
      format: tournament.format ?? 'versus',
      groupAdvance: tournament.groupAdvance ?? 2,
      semifinalAdvance: tournament.semifinalAdvance ?? 4,
      createdAt: tournament.createdAt.toISOString(),
    };
  }

  // `withInGameIds` only for staff views and the caller's own team.
  private toPublicTeam(team: TournamentTeam, withInGameIds = false): PublicTournamentTeam {
    const players: TournamentTeamPlayer[] = [...(team.roster ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((m) => ({
        username: m.user?.username ?? '',
        avatarUrl: m.user?.avatarUrl ?? null,
        inGameName: m.inGameName,
        isCaptain: m.userId === team.captainUserId,
        ...(withInGameIds ? { inGameId: m.inGameId } : {}),
      }));
    return {
      id: team.id,
      tournamentId: team.tournamentId,
      name: team.name,
      tag: team.tag,
      logoUrl: team.logoUrl,
      captainUsername: team.captain?.username ?? '',
      coachName: team.coachName,
      members: team.members ?? [],
      players,
      ...(withInGameIds ? { discord: team.discord } : {}),
      status: team.status,
      groupName: team.groupName ?? null,
      createdAt: team.createdAt.toISOString(),
    };
  }

  private teamRef(team: TournamentTeam | null): TournamentTeamRef | null {
    return team ? { id: team.id, name: team.name, tag: team.tag, logoUrl: team.logoUrl } : null;
  }

  // Fresh username + photo for stat lines linked to an account (stored as userId only, so a renamed
  // user or new photo shows up). Inactive accounts show as plain names.
  private async withPlayerAccounts(rows: TournamentMatch[]): Promise<PublicTournamentMatch[]> {
    const ids = new Set<string>();
    for (const row of rows) for (const side of [row.stats?.a, row.stats?.b]) for (const p of side?.players ?? []) if (p.userId) ids.add(p.userId);
    const users = ids.size
      ? await this.dataSource.getRepository(User).find({ where: { id: In([...ids]), status: UserStatus.Active }, select: { id: true, username: true, avatarUrl: true } })
      : [];
    const byId = new Map(users.map((u) => [u.id, u]));
    const link = (side: MatchTeamStats | null | undefined): MatchTeamStats | null =>
      side
        ? {
            ...side,
            players: side.players.map(({ userId, ...p }) => {
              const u = userId ? byId.get(userId) : undefined;
              return u ? { ...p, userId: u.id, username: u.username, avatarUrl: u.avatarUrl ?? null } : { ...p, userId: null, username: null, avatarUrl: null };
            }),
          }
        : null;
    return rows.map((row) => {
      const pub = this.toPublicMatch(row);
      return { ...pub, stats: { a: link(row.stats?.a), b: link(row.stats?.b) } };
    });
  }

  // `@username` entries on a stat sheet → account ids; an unknown one is refused.
  private async resolveStatAccounts(stats: MatchDto['stats']): Promise<Map<string, string>> {
    const wanted = new Set<string>();
    for (const side of [stats?.a, stats?.b]) for (const p of side?.players ?? []) if (p.username?.trim()) wanted.add(p.username.trim().replace(/^@/, '').toLowerCase());
    const map = new Map<string, string>();
    for (const key of wanted) {
      const user = await this.findPlayer(this.dataSource.manager, key);
      if (!user) throw new BadRequestException(`No active WaveHub account "${key.slice(0, 40)}"`);
      map.set(key, user.id);
    }
    return map;
  }

  private toPublicMatch(match: TournamentMatch): PublicTournamentMatch {
    return {
      id: match.id,
      tournamentId: match.tournamentId,
      tournamentName: match.tournament?.name ?? '',
      stage: match.stage,
      groupName: match.groupName,
      roundLabel: match.roundLabel,
      teamA: this.teamRef(match.teamA),
      teamB: this.teamRef(match.teamB),
      map: match.map,
      bestOf: match.bestOf,
      scheduledAt: match.scheduledAt?.toISOString() ?? null,
      status: match.status,
      scoreA: match.scoreA,
      scoreB: match.scoreB,
      stats: { a: match.stats?.a ?? null, b: match.stats?.b ?? null },
      results: (match.results ?? [])
        .filter((r) => r.team)
        .map((r) => ({ team: this.teamRef(r.team)!, placement: r.placement, kills: r.kills, points: r.points }))
        .sort((a, b) => b.points - a.points || (a.placement ?? 999) - (b.placement ?? 999) || a.team.name.localeCompare(b.team.name)),
    };
  }

  // --- Admin: tournaments ---

  // Battle-royale games (PUBG Mobile, Free Fire, Fortnite) default to that format.
  private async defaultFormat(gameId: string): Promise<TournamentFormat> {
    const game = await this.dataSource.getRepository(Game).findOne({ where: { id: gameId }, select: { slug: true } });
    return game && BR_GAME_SLUGS.includes(game.slug) ? 'battle_royale' : 'versus';
  }

  async create(dto: CreateTournamentDto): Promise<Tournament> {
    const tournament = this.tournaments.create({
      gameId: dto.gameId,
      name: dto.name,
      description: dto.description,
      prize: dto.prize,
      status: dto.status ?? TournamentStatus.Upcoming,
      startDate: dto.startDate,
      maxPlayers: dto.maxPlayers,
      details: dto.details ?? {},
      rules: dto.rules?.trim() || null,
      teamSize: dto.teamSize ?? 1,
      pointsPerWin: dto.pointsPerWin ?? 3,
      pointsPerLoss: dto.pointsPerLoss ?? 0,
      qualifyPoints: dto.qualifyPoints ?? null,
      format: dto.format ?? (await this.defaultFormat(dto.gameId)),
      groupAdvance: dto.groupAdvance ?? 2,
      semifinalAdvance: dto.semifinalAdvance ?? 4,
      prizes: dto.prizes ? { places: dto.prizes.places, specialRewards: dto.prizes.specialRewards, note: dto.prizes.note ?? null } : EMPTY_PRIZES,
    });
    return this.tournaments.save(tournament);
  }

  async update(id: string, dto: UpdateTournamentDto): Promise<Tournament> {
    const current = await this.getOrThrow(id);
    // Changing the team size once teams exist would leave rosters of the wrong size.
    if (dto.teamSize !== undefined && dto.teamSize !== current.teamSize) {
      const { teams } = await this.counts(id);
      if (teams > 0) throw new ConflictException('Team size cannot change after teams have registered');
    }
    const patch: Partial<Tournament> = { ...dto, prizes: undefined } as Partial<Tournament>;
    delete patch.prizes;
    if (dto.prizes) patch.prizes = { places: dto.prizes.places, specialRewards: dto.prizes.specialRewards, note: dto.prizes.note ?? null };
    if (dto.rules !== undefined) patch.rules = dto.rules.trim() || null;
    await this.tournaments.update(id, patch);
    const saved = await this.getOrThrow(id);
    // Players hear when play starts (once per move into "in progress").
    if (dto.status === TournamentStatus.InProgress && current.status !== TournamentStatus.InProgress) {
      void this.notifier?.tournamentStarted(saved);
    }
    return saved;
  }

  private validateImage(file: UploadedImage | undefined, maxBytes: number, label: string) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype)) {
      throw new ForbiddenException('Only JPG, PNG, or WEBP images are allowed');
    }
    if (file.size > maxBytes) {
      throw new ForbiddenException(`${label} exceeds the ${Math.round(maxBytes / 1024 / 1024)}MB size limit`);
    }
  }

  async setCoverImage(id: string, file: UploadedImage): Promise<Tournament> {
    await this.getOrThrow(id);
    this.validateImage(file, MAX_COVER_BYTES, 'Cover image');
    const stored = await this.storage.save(file.buffer, file.originalname, 'image');
    await this.tournaments.update(id, { coverImageUrl: stored.url });
    return this.getOrThrow(id);
  }

  async delete(id: string): Promise<void> {
    await this.getOrThrow(id);
    await this.tournaments.delete(id);
  }

  private async getOrThrow(id: string): Promise<Tournament> {
    const tournament = await this.tournaments.findOne({ where: { id }, relations: { game: true } });
    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }
    return tournament;
  }

  // --- Public: tournaments ---

  // Public list never includes drafts; the admin list (`includeDrafts`) shows everything.
  async browse(filters: BrowseTournamentsDto, includeDrafts = false, gameIds: string[] | null = null): Promise<{ items: PublicTournamentSummary[]; total: number }> {
    if (gameIds && !gameIds.length) return { items: [], total: 0 };
    const qb = this.tournaments.createQueryBuilder('t').leftJoinAndSelect('t.game', 'game');
    if (gameIds) qb.andWhere('t.gameId IN (:...gameIds)', { gameIds });
    if (!includeDrafts) {
      qb.andWhere('t.status <> :draft', { draft: TournamentStatus.Draft });
    }
    if (filters.gameId) {
      qb.andWhere('t.gameId = :gameId', { gameId: filters.gameId });
    }
    if (filters.status) {
      qb.andWhere('t.status = :status', { status: filters.status });
    }
    qb.orderBy('t.startDate', 'DESC').addOrderBy('t.id', 'ASC').take(filters.limit ?? 20).skip(filters.offset ?? 0);

    const [rows, total] = await qb.getManyAndCount();
    const items = await Promise.all(rows.map((row) => this.toPublic(row)));
    return { items, total };
  }

  // Game Manager: the tournament's game must be one of its tournament games.
  async assertTournamentInScope(id: string, scope: StaffScope): Promise<void> {
    if (scope.tournamentGameIds === null) return;
    const tournament = await this.getOrThrow(id);
    assertGameInScope(scope, 'tournaments', tournament.gameId);
  }

  async findPublicById(id: string): Promise<PublicTournamentSummary> {
    const tournament = await this.getPublishedOrThrow(id);
    return this.toPublic(tournament);
  }

  // A draft tournament doesn't exist as far as the public is concerned (same 404 as a missing one).
  private async getPublishedOrThrow(id: string): Promise<Tournament> {
    const tournament = await this.getOrThrow(id);
    if (tournament.status === TournamentStatus.Draft) throw new NotFoundException('Tournament not found');
    return tournament;
  }

  // --- Registration ---

  // The tournament IDs the caller registered a team for (as captain or solo player).
  async listMyRegisteredIds(userId: string): Promise<string[]> {
    const rows = await this.registrations.find({ where: { userId }, select: { tournamentId: true } });
    const memberRows = await this.members.find({ where: { userId }, select: { tournamentId: true } });
    return [...new Set([...rows, ...memberRows].map((row) => row.tournamentId))];
  }

  // Runs `create` under a row lock on the tournament so two registrations can't both pass the
  // capacity check (the old count-then-insert could overfill a tournament under concurrency).
  private async registerLocked(
    tournamentId: string,
    userId: string,
    playersNeeded: number,
    create: (manager: EntityManager, tournament: Tournament) => Promise<TournamentTeam>,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const tournament = await manager.findOne(Tournament, { where: { id: tournamentId }, lock: { mode: 'pessimistic_write' } });
      if (!tournament) throw new NotFoundException('Tournament not found');
      if (tournament.status !== TournamentStatus.Open) {
        throw new ForbiddenException('Registration is not open for this tournament');
      }
      const existing = await manager.findOne(TournamentRegistration, { where: { tournamentId, userId } });
      if (existing) throw new ForbiddenException('You are already registered for this tournament');
      const onTeam = await manager.findOne(TournamentTeamMember, { where: { tournamentId, userId } });
      if (onTeam) throw new ForbiddenException('You are already on a team in this tournament');
      const { players } = await this.counts(tournamentId, manager);
      if (players + playersNeeded > tournament.maxPlayers) {
        throw new ForbiddenException('This tournament is full');
      }
      try {
        const team = await create(manager, tournament);
        await manager.save(manager.create(TournamentRegistration, { tournamentId, userId, teamId: team.id }));
      } catch (err) {
        if ((err as { code?: string }).code === '23505') {
          const detail = String((err as { constraint?: string }).constraint ?? '');
          if (detail === 'UQ_tournament_team_members_user') throw new ConflictException('A player is already on a team in this tournament');
          if (detail.includes('name')) throw new ConflictException('A team with this name is already registered');
          throw new ForbiddenException('You are already registered for this tournament');
        }
        throw err;
      }
    });
  }

  // Solo tournaments (teamSize 1): the player becomes a verified one-player team.
  // A WaveHub account a captain can add to a team: username (case-insensitive) or account id, active
  // accounts only. Returns the public bits a profile already shows.
  async lookupPlayer(query: string): Promise<TournamentPlayerLookup> {
    const user = await this.findPlayer(this.dataSource.manager, query);
    if (!user) throw new NotFoundException('No active WaveHub account with this username or ID');
    return { id: user.id, username: user.username, avatarUrl: user.avatarUrl ?? null };
  }

  private async findPlayer(manager: EntityManager, query: string): Promise<User | null> {
    const q = query.trim().replace(/^@/, '');
    if (!q) return null;
    const qb = manager.getRepository(User).createQueryBuilder('u').where('u.status = :active', { active: UserStatus.Active });
    if (UUID.test(q)) qb.andWhere('u.id = :id', { id: q });
    else qb.andWhere('lower(u.username) = lower(:username)', { username: q });
    return qb.getOne();
  }

  // Solo tournaments: the player registers with their in-game name and id (auto-verified).
  async register(tournamentId: string, userId: string, dto: RegisterSoloDto): Promise<PublicTournamentSummary> {
    const tournament = await this.getOrThrow(tournamentId);
    if ((tournament.teamSize ?? 1) > 1) {
      throw new BadRequestException('This is a team tournament — register a team');
    }
    const inGameName = dto.inGameName.trim();
    const inGameId = dto.inGameId.trim();
    if (!inGameName || !inGameId) throw new BadRequestException('Enter your in-game name and ID');
    await this.registerLocked(tournamentId, userId, 1, async (manager) => {
      const user = await manager.findOneOrFail(User, { where: { id: userId } });
      const team = await manager.save(
        manager.create(TournamentTeam, {
          tournamentId,
          captainUserId: userId,
          name: user.username.slice(0, 30),
          discord: dto.discord.trim(),
          members: [inGameName],
          status: TournamentTeamStatus.Verified,
        }),
      );
      await manager.save(manager.create(TournamentTeamMember, { teamId: team.id, tournamentId, userId, inGameName, inGameId, position: 0 }));
      return team;
    });
    return this.toPublic(tournament);
  }

  // Squad tournaments: the captain registers exactly `teamSize` players — themselves plus teammates
  // added by WaveHub username or account id, each with an in-game name and id. Every teammate must
  // be an active account not already on a team in this tournament. The team waits for staff
  // verification; added teammates get a notification.
  async registerTeam(tournamentId: string, userId: string, dto: RegisterTeamDto): Promise<PublicTournamentTeam> {
    const tournament = await this.getOrThrow(tournamentId);
    const teamSize = tournament.teamSize ?? 1;
    if (teamSize <= 1) throw new BadRequestException('This is a solo tournament — use register');
    if (dto.players.length !== teamSize) {
      throw new BadRequestException(`A team needs exactly ${teamSize} players`);
    }
    const entries = dto.players.map((p) => ({ player: p.player.trim(), inGameName: p.inGameName.trim(), inGameId: p.inGameId.trim() }));
    if (entries.some((e) => !e.inGameName || !e.inGameId)) throw new BadRequestException('Every player needs an in-game name and ID');
    if (new Set(entries.map((e) => e.inGameName.toLowerCase())).size !== entries.length) {
      throw new BadRequestException('Player names must be different');
    }
    let teamId = '';
    let teammates: User[] = [];
    await this.registerLocked(tournamentId, userId, teamSize, async (manager) => {
      const users: User[] = [];
      for (const entry of entries) {
        const user = await this.findPlayer(manager, entry.player);
        if (!user) throw new BadRequestException(`No active WaveHub account "${entry.player.slice(0, 60)}"`);
        users.push(user);
      }
      if (new Set(users.map((u) => u.id)).size !== users.length) {
        throw new BadRequestException('Each player can only be added once');
      }
      const captainIndex = users.findIndex((u) => u.id === userId);
      if (captainIndex < 0) throw new BadRequestException('Add yourself to the team — the captain plays too');
      const taken = await manager.find(TournamentTeamMember, {
        where: { tournamentId, userId: In(users.map((u) => u.id)) },
        relations: { user: true },
      });
      if (taken.length > 0) {
        throw new ConflictException(`@${taken[0].user.username} is already on a team in this tournament`);
      }
      // Captain first, then teammates in the order entered.
      const order = [captainIndex, ...users.map((_, i) => i).filter((i) => i !== captainIndex)];
      const team = await manager.save(
        manager.create(TournamentTeam, {
          tournamentId,
          captainUserId: userId,
          name: dto.name.trim(),
          tag: dto.tag?.trim().toUpperCase() || null,
          coachName: dto.coachName?.trim() || null,
          discord: dto.discord.trim(),
          members: order.map((i) => entries[i].inGameName),
          status: TournamentTeamStatus.Pending,
        }),
      );
      await manager.save(
        order.map((i, position) =>
          manager.create(TournamentTeamMember, {
            teamId: team.id,
            tournamentId,
            userId: users[i].id,
            inGameName: entries[i].inGameName,
            inGameId: entries[i].inGameId,
            position,
          }),
        ),
      );
      teamId = team.id;
      teammates = users.filter((u) => u.id !== userId);
      return team;
    });
    const team = await this.teams.findOneOrFail({ where: { id: teamId }, relations: TEAM_RELATIONS });
    await this.notifyTeammates(tournament, team, teammates);
    // The team waits for staff verification — tell the tournament staff (notifications/CLAUDE.md).
    await this.notifications.notifyStaff(
      TOURNAMENT_MANAGEMENT_ROLES,
      'ახალი გუნდი დასადასტურებლად',
      `გუნდი „${team.name}“ დარეგისტრირდა ტურნირზე „${tournament.name}“.`,
      '/admin/tournaments',
      `team:${team.id}`,
      { game: { area: 'tournaments', gameId: tournament.gameId } },
    );
    return this.toPublicTeam(team, true);
  }

  // Best-effort: a failed notification never undoes the registration.
  private async notifyTeammates(tournament: Tournament, team: TournamentTeam, teammates: User[]) {
    for (const mate of teammates) {
      try {
        await this.notifications.emit(
          mate.id,
          NotificationType.TournamentTeamAdded,
          'გუნდში დაგამატეს',
          `${personName(team.captain)}-მა დაგამატა გუნდში „${team.name}“ ტურნირზე „${tournament.name}“.`,
          { tournamentId: tournament.id, teamId: team.id },
        );
      } catch (err) {
        this.logger.warn(`team-added notification failed: ${(err as Error).message}`);
      }
    }
  }

  private async myTeamOrThrow(tournamentId: string, userId: string): Promise<TournamentTeam> {
    const team = await this.teams.findOne({ where: { tournamentId, captainUserId: userId }, relations: TEAM_RELATIONS });
    if (!team) throw new NotFoundException('You have no team in this tournament');
    return team;
  }

  async setMyTeamLogo(tournamentId: string, userId: string, file: UploadedImage): Promise<PublicTournamentTeam> {
    const team = await this.myTeamOrThrow(tournamentId, userId);
    this.validateImage(file, MAX_LOGO_BYTES, 'Team logo');
    const stored = await this.storage.save(file.buffer, file.originalname, 'image');
    team.logoUrl = stored.url;
    await this.teams.update(team.id, { logoUrl: stored.url });
    return this.toPublicTeam(team, true);
  }

  async withdraw(tournamentId: string, userId: string): Promise<{ ok: true }> {
    const tournament = await this.getOrThrow(tournamentId);
    if (!REGISTRATION_EDITABLE.includes(tournament.status)) {
      throw new ForbiddenException('The tournament has started — contact support to withdraw');
    }
    const team = await this.myTeamOrThrow(tournamentId, userId);
    await this.teams.delete(team.id); // cascades to the registration row
    return { ok: true };
  }

  // --- Teams ---

  async listTeams(tournamentId: string): Promise<PublicTournamentTeam[]> {
    await this.getPublishedOrThrow(tournamentId);
    const rows = await this.teams.find({
      where: { tournamentId, status: In([TournamentTeamStatus.Verified, TournamentTeamStatus.Pending]) },
      relations: TEAM_RELATIONS,
      order: { createdAt: 'ASC' },
    });
    return rows.map((row) => this.toPublicTeam(row));
  }

  async adminListTeams(tournamentId: string): Promise<PublicTournamentTeam[]> {
    await this.getOrThrow(tournamentId);
    const rows = await this.teams.find({ where: { tournamentId }, relations: TEAM_RELATIONS, order: { createdAt: 'ASC' } });
    return rows.map((row) => this.toPublicTeam(row, true));
  }

  async adminSetTeamStatus(tournamentId: string, teamId: string, status: TournamentTeamStatus): Promise<PublicTournamentTeam> {
    const team = await this.teams.findOne({ where: { id: teamId, tournamentId }, relations: TEAM_RELATIONS });
    if (!team) throw new NotFoundException('Team not found');
    const before = team.status;
    await this.teams.update(team.id, { status });
    team.status = status;
    if (before !== status) {
      const tournament = await this.getOrThrow(tournamentId);
      await this.notifier?.teamStatus(tournament, team.id, team.name, status);
    }
    return this.toPublicTeam(team, true);
  }

  // --- Matches ---

  private matchQuery() {
    return this.matches
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.teamA', 'teamA')
      .leftJoinAndSelect('m.teamB', 'teamB')
      .leftJoinAndSelect('m.tournament', 'tournament')
      .leftJoinAndSelect('m.results', 'results')
      .leftJoinAndSelect('results.team', 'resultTeam');
  }

  async listMatches(tournamentId: string, includeDraft = false): Promise<PublicTournamentMatch[]> {
    if (includeDraft) await this.getOrThrow(tournamentId);
    else await this.getPublishedOrThrow(tournamentId);
    const rows = await this.matchQuery()
      .where('m.tournamentId = :tournamentId', { tournamentId })
      .orderBy('m.scheduledAt', 'DESC', 'NULLS LAST')
      .addOrderBy('m.createdAt', 'DESC')
      .getMany();
    return this.withPlayerAccounts(rows);
  }

  async getMatch(tournamentId: string, matchId: string): Promise<PublicTournamentMatch> {
    await this.getPublishedOrThrow(tournamentId);
    const row = await this.matchQuery().where('m.id = :matchId AND m.tournamentId = :tournamentId', { matchId, tournamentId }).getOne();
    if (!row) throw new NotFoundException('Match not found');
    return (await this.withPlayerAccounts([row]))[0];
  }

  private async assertTeamsBelong(tournamentId: string, teamAId: string | null | undefined, teamBId: string | null | undefined) {
    const ids = [teamAId, teamBId].filter((id): id is string => !!id);
    if (teamAId && teamBId && teamAId === teamBId) throw new BadRequestException('A team cannot play itself');
    if (ids.length === 0) return;
    const found = await this.teams.count({ where: { tournamentId, id: In(ids) } });
    if (found !== ids.length) throw new BadRequestException('Both teams must be registered in this tournament');
  }

  private applyMatchDto(match: TournamentMatch, dto: MatchDto, accounts: Map<string, string>) {
    if (dto.stage !== undefined) match.stage = dto.stage;
    if (dto.groupName !== undefined) match.groupName = dto.groupName?.trim() || null;
    if (dto.roundLabel !== undefined) match.roundLabel = dto.roundLabel?.trim() || null;
    if (dto.teamAId !== undefined) match.teamAId = dto.teamAId;
    if (dto.teamBId !== undefined) match.teamBId = dto.teamBId;
    if (dto.map !== undefined) match.map = dto.map?.trim() || null;
    if (dto.bestOf !== undefined) match.bestOf = dto.bestOf;
    if (dto.scheduledAt !== undefined) match.scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    if (dto.status !== undefined) match.status = dto.status;
    if (dto.scoreA !== undefined) match.scoreA = dto.scoreA;
    if (dto.scoreB !== undefined) match.scoreB = dto.scoreB;
    // A score typed without a status finishes a scheduled match (round-7/39: a card showed "1 - 0"
    // under "scheduled" because the quick score entry left the status alone).
    if (dto.status === undefined && (dto.scoreA !== undefined || dto.scoreB !== undefined) && match.scoreA !== null && match.scoreB !== null && match.status === TournamentMatchStatus.Scheduled) {
      match.status = TournamentMatchStatus.Completed;
    }
    if (dto.stats !== undefined) {
      match.stats = {
        a: dto.stats.a !== undefined ? normalizeStats(dto.stats.a, accounts) : (match.stats?.a ?? null),
        b: dto.stats.b !== undefined ? normalizeStats(dto.stats.b, accounts) : (match.stats?.b ?? null),
      };
    }
  }

  async adminCreateMatch(tournamentId: string, dto: MatchDto): Promise<PublicTournamentMatch> {
    await this.getOrThrow(tournamentId);
    await this.assertTeamsBelong(tournamentId, dto.teamAId, dto.teamBId);
    const match = this.matches.create({
      tournamentId,
      stage: TournamentMatchStage.Group,
      bestOf: 1,
      status: TournamentMatchStatus.Scheduled,
      stats: {},
    });
    this.applyMatchDto(match, dto, await this.resolveStatAccounts(dto.stats));
    const saved = await this.matches.save(match);
    if (saved.status !== TournamentMatchStatus.Completed) await this.notifier?.matchScheduled(saved.id);
    await this.notifier?.result(saved);
    return this.getMatch(tournamentId, saved.id);
  }

  // Every pairing of the chosen teams as group matches, spaced from `startAt` (owner 2026-11-10).
  // Pairings already in that group (either order) are skipped, so a second click adds nothing twice.
  async adminRoundRobin(tournamentId: string, dto: RoundRobinDto): Promise<{ created: number }> {
    await this.getOrThrow(tournamentId);
    const teamIds = [...new Set(dto.teamIds)];
    if (teamIds.length < 2) throw new BadRequestException('Pick at least two teams');
    const found = await this.teams.count({ where: { tournamentId, id: In(teamIds) } });
    if (found !== teamIds.length) throw new BadRequestException('Both teams must be registered in this tournament');
    const groupName = dto.groupName.trim() || 'A';
    const existing = await this.matches.find({ where: { tournamentId, stage: TournamentMatchStage.Group }, select: { teamAId: true, teamBId: true, groupName: true } });
    const taken = new Set(existing.filter((m) => (m.groupName || 'A') === groupName).map((m) => [m.teamAId, m.teamBId].sort().join(':')));
    // Circle method: rounds where each team plays once, so nobody plays twice in a row early on.
    const ring: Array<string | null> = teamIds.length % 2 ? [...teamIds, null] : [...teamIds];
    const pairs: Array<[string, string, number]> = [];
    for (let round = 0; round < ring.length - 1; round++) {
      for (let i = 0; i < ring.length / 2; i++) {
        const a = ring[i];
        const b = ring[ring.length - 1 - i];
        if (a && b) pairs.push([a, b, round + 1]);
      }
      ring.splice(1, 0, ring.pop()!);
    }
    const start = new Date(dto.startAt).getTime();
    const rows: TournamentMatch[] = [];
    for (const [a, b, round] of pairs) {
      if (taken.has([a, b].sort().join(':'))) continue;
      rows.push(
        this.matches.create({
          tournamentId,
          stage: TournamentMatchStage.Group,
          groupName,
          roundLabel: `Round ${round}`,
          teamAId: a,
          teamBId: b,
          map: dto.map?.trim() || null,
          bestOf: dto.bestOf ?? 1,
          scheduledAt: new Date(start + rows.length * dto.intervalMinutes * 60_000),
          status: TournamentMatchStatus.Scheduled,
          stats: {},
        }),
      );
    }
    const saved = rows.length ? await this.matches.save(rows) : [];
    for (const m of saved) await this.notifier?.matchScheduled(m.id);
    return { created: saved.length };
  }

  async adminUpdateMatch(tournamentId: string, matchId: string, dto: MatchDto): Promise<PublicTournamentMatch> {
    const match = await this.matches.findOne({ where: { id: matchId, tournamentId } });
    if (!match) throw new NotFoundException('Match not found');
    const before = { a: match.teamAId, b: match.teamBId, at: match.scheduledAt?.getTime() ?? null };
    this.applyMatchDto(match, dto, await this.resolveStatAccounts(dto.stats));
    await this.assertTeamsBelong(tournamentId, match.teamAId, match.teamBId);
    const moved = (match.scheduledAt?.getTime() ?? null) !== before.at;
    // A new time means new reminders.
    if (moved) {
      match.remindedDayAt = null;
      match.remindedHourAt = null;
    }
    await this.matches.save(match);
    if (match.status !== TournamentMatchStatus.Completed && (moved || match.teamAId !== before.a || match.teamBId !== before.b)) {
      await this.notifier?.matchScheduled(match.id);
    }
    await this.notifier?.result(match);
    return this.getMatch(tournamentId, matchId);
  }

  // --- Battle royale (owner 2026-11-14, docs/design-mockups/round-7) ---

  // Public matches + team refs (with groups) + the computed standings for a BR tournament.
  private async brState(tournament: Tournament) {
    const rows = await this.matchQuery().where('m.tournamentId = :id', { id: tournament.id }).getMany();
    const matches = rows.map((r) => this.toPublicMatch(r));
    const teamRows = await this.teams.find({ where: { tournamentId: tournament.id }, select: { id: true, name: true, tag: true, logoUrl: true, groupName: true, status: true } });
    const teams = teamRows
      .filter((t) => t.status !== TournamentTeamStatus.Rejected)
      .map((t) => ({ id: t.id, name: t.name, tag: t.tag, logoUrl: t.logoUrl, groupName: t.groupName }));
    const bracket = brBracket(matches, teams, {
      groupAdvance: tournament.groupAdvance ?? 2,
      semifinalAdvance: tournament.semifinalAdvance ?? 4,
      completed: tournament.status === TournamentStatus.Completed,
    });
    return { rows, matches, teams, bracket };
  }

  // Replaces a BR match's results; points come from placement + kills (brMatchPoints).
  async adminSetResults(tournamentId: string, matchId: string, dto: MatchResultsDto): Promise<PublicTournamentMatch> {
    const match = await this.matches.findOne({ where: { id: matchId, tournamentId } });
    if (!match) throw new NotFoundException('Match not found');
    const teamIds = dto.results.map((r) => r.teamId);
    if (new Set(teamIds).size !== teamIds.length) throw new BadRequestException('A team is listed twice');
    const placements = dto.results.map((r) => r.placement).filter((p): p is number => typeof p === 'number');
    if (new Set(placements).size !== placements.length) throw new BadRequestException('Two teams have the same place');
    if (teamIds.length) {
      const found = await this.teams.count({ where: { tournamentId, id: In(teamIds) } });
      if (found !== teamIds.length) throw new BadRequestException('Every team must be registered in this tournament');
    }
    await this.dataSource.transaction(async (m) => {
      await m.delete(TournamentMatchResult, { matchId });
      if (dto.results.length) {
        await m.insert(
          TournamentMatchResult,
          dto.results.map((r) => ({ matchId, teamId: r.teamId, placement: r.placement ?? null, kills: r.kills, points: brMatchPoints(r.placement ?? null, r.kills) })),
        );
      }
      if (dto.complete) await m.update(TournamentMatch, { id: matchId }, { status: TournamentMatchStatus.Completed });
    });
    return this.getMatch(tournamentId, matchId).catch(async () => {
      const row = await this.matchQuery().where('m.id = :matchId', { matchId }).getOneOrFail();
      return this.toPublicMatch(row);
    });
  }

  async adminSetTeamGroup(tournamentId: string, teamId: string, dto: TeamGroupDto): Promise<PublicTournamentTeam> {
    const team = await this.teams.findOne({ where: { id: teamId, tournamentId } });
    if (!team) throw new NotFoundException('Team not found');
    team.groupName = dto.groupName?.trim().toUpperCase() || null;
    await this.teams.save(team);
    return this.toPublicTeam(await this.teams.findOneOrFail({ where: { id: teamId }, relations: TEAM_RELATIONS }), true);
  }

  // Verified teams spread over N groups (A, B, …) in registration order.
  async adminAutoGroups(tournamentId: string, dto: AutoGroupsDto): Promise<{ assigned: number }> {
    await this.getOrThrow(tournamentId);
    const teams = await this.teams.find({ where: { tournamentId, status: TournamentTeamStatus.Verified }, order: { createdAt: 'ASC' } });
    const names = Array.from({ length: dto.groups }, (_, i) => String.fromCharCode(65 + i));
    const sizes = new Map(names.map((n) => [n, 0]));
    if (!dto.reset) for (const t of teams) if (t.groupName && sizes.has(t.groupName)) sizes.set(t.groupName, sizes.get(t.groupName)! + 1);
    let assigned = 0;
    for (const t of teams) {
      if (!dto.reset && t.groupName) continue;
      // The smallest group (first by name on a tie) gets the next team.
      const target = [...sizes.entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))[0][0];
      t.groupName = target;
      sizes.set(target, sizes.get(target)! + 1);
      assigned += 1;
    }
    await this.teams.save(teams);
    return { assigned };
  }

  // `count` BR matches for a group / semifinal / final, "Match k/N", spaced from `startAt`.
  async adminBrMatches(tournamentId: string, dto: BrMatchesDto): Promise<{ created: number }> {
    await this.getOrThrow(tournamentId);
    const groupName = dto.stage === TournamentMatchStage.Group ? dto.groupName?.trim().toUpperCase() || 'A' : null;
    const start = new Date(dto.startAt).getTime();
    const rows = Array.from({ length: dto.count }, (_, i) =>
      this.matches.create({
        tournamentId,
        stage: dto.stage,
        groupName,
        roundLabel: `Match ${i + 1}/${dto.count}`,
        teamAId: null,
        teamBId: null,
        map: dto.map?.trim() || null,
        bestOf: 1,
        scheduledAt: new Date(start + i * dto.intervalMinutes * 60_000),
        status: TournamentMatchStatus.Scheduled,
        stats: {},
      }),
    );
    await this.matches.save(rows);
    return { created: rows.length };
  }

  // The caller's non-rejected team in a tournament (captain or roster member), or null.
  private async myTeamIn(tournamentId: string, userId: string): Promise<TournamentTeam | null> {
    const captain = await this.teams.findOne({ where: { tournamentId, captainUserId: userId } });
    if (captain && captain.status !== TournamentTeamStatus.Rejected) return captain;
    const member = await this.members.findOne({ where: { userId, tournamentId }, relations: { team: true } });
    return member?.team && member.team.status !== TournamentTeamStatus.Rejected ? member.team : null;
  }

  async adminDeleteMatch(tournamentId: string, matchId: string): Promise<{ ok: true }> {
    const result = await this.matches.delete({ id: matchId, tournamentId });
    if (!result.affected) throw new NotFoundException('Match not found');
    return { ok: true };
  }

  // --- The caller's own tournaments (My Tournaments, Tournament Hub) ---

  // Teams the caller captains or plays on (newest first), drafts excluded.
  async myTournaments(userId: string): Promise<MyTournamentEntry[]> {
    const rows = await this.registrations.find({
      where: { userId },
      relations: { tournament: { game: true }, team: TEAM_RELATIONS },
    });
    const memberRows = await this.members.find({
      where: { userId },
      relations: { tournament: { game: true }, team: TEAM_RELATIONS },
    });
    const seen = new Set<string>();
    const candidates: Array<{ tournament: Tournament; team: TournamentTeam; at: Date }> = [];
    for (const row of rows) if (row.team) candidates.push({ tournament: row.tournament, team: row.team, at: row.registeredAt });
    for (const row of memberRows) candidates.push({ tournament: row.tournament, team: row.team, at: row.createdAt });
    candidates.sort((a, b) => b.at.getTime() - a.at.getTime());
    const entries: MyTournamentEntry[] = [];
    for (const c of candidates) {
      if (seen.has(c.team.id) || c.tournament.status === TournamentStatus.Draft) continue;
      seen.add(c.team.id);
      entries.push({ tournament: await this.toPublic(c.tournament), team: this.toPublicTeam(c.team, true), registeredAt: c.at.toISOString() });
    }
    return entries;
  }

  // Every match any of the caller's teams plays or played (newest first).
  // --- Game room (owner 2026-10-28) ---

  private static roomSide(dto: MatchRoomSideDto): MatchRoomSide {
    const clean = (v: string | null | undefined) => (v ?? '').trim() || null;
    return { open: dto.open, roomId: clean(dto.roomId), password: clean(dto.password), slot: clean(dto.slot), serverUrl: clean(dto.serverUrl) };
  }

  // Staff list: the public matches plus each side's room details.
  async adminListMatches(tournamentId: string): Promise<AdminTournamentMatch[]> {
    await this.getOrThrow(tournamentId);
    const rows = await this.matchQuery()
      .where('m.tournamentId = :tournamentId', { tournamentId })
      .orderBy('m.scheduledAt', 'DESC', 'NULLS LAST')
      .addOrderBy('m.createdAt', 'DESC')
      .getMany();
    const pub = await this.withPlayerAccounts(rows);
    return pub.map((m, i) => ({ ...m, room: { a: rows[i].room?.a ?? null, b: rows[i].room?.b ?? null } }));
  }

  async adminSetRoom(tournamentId: string, matchId: string, dto: MatchRoomDto): Promise<AdminTournamentMatch> {
    const match = await this.matches.findOne({ where: { id: matchId, tournamentId } });
    if (!match) throw new NotFoundException('Match not found');
    const wasOpen = (side?: MatchRoomSide | null) => !!side?.open && !!(side.roomId || side.password || side.slot || side.serverUrl);
    const openBefore = { a: wasOpen(match.room?.a), b: wasOpen(match.room?.b) };
    match.room = {
      a: dto.a !== undefined ? TournamentsService.roomSide(dto.a) : (match.room?.a ?? null),
      b: dto.b !== undefined ? TournamentsService.roomSide(dto.b) : (match.room?.b ?? null),
    };
    await this.matches.save(match);
    const opened = (['a', 'b'] as const).filter((side) => !openBefore[side] && wasOpen(match.room[side]));
    await this.notifier?.roomOpened(match.id, opened);
    const all = await this.adminListMatches(tournamentId);
    return all.find((m) => m.id === matchId)!;
  }

  // A player's own room card. Only a member (or the captain) of one of the match's teams gets an
  // answer, and only while the tournament is published. A rejected team gets 403. A team still
  // pending verification sees the card locked with `teamPending` — never any details (owner
  // 2026-11-01: the card used to vanish for pending teams, which looked like a bug). Details only
  // once the team is verified and staff opened that side.
  async myMatchRoom(userId: string, matchId: string): Promise<MatchRoomView> {
    const match = await this.matches.findOne({ where: { id: matchId }, relations: { tournament: { game: true }, teamA: true, teamB: true } });
    if (!match || match.tournament.status === TournamentStatus.Draft) throw new NotFoundException('Match not found');
    // Battle royale: one shared lobby (stored as side "a") for every team playing this match.
    if (match.tournament.format === 'battle_royale') {
      const team = await this.myTeamIn(match.tournamentId, userId);
      const { matches, teams, bracket } = await this.brState(match.tournament);
      const pub = matches.find((m) => m.id === match.id);
      if (!team || !pub || !brMatchTeams(pub, bracket, teams).includes(team.id)) throw new ForbiddenException('You are not a player in this match');
      const teamPending = team.status !== TournamentTeamStatus.Verified;
      const info = teamPending ? null : (match.room?.a ?? null);
      const open = !!info?.open && !!(info.roomId || info.password || info.slot || info.serverUrl);
      return {
        matchId: match.id,
        status: open ? 'available' : 'locked',
        side: 'a',
        teamPending,
        room: open && info ? { roomId: info.roomId, password: info.password, slot: info.slot, serverUrl: info.serverUrl } : null,
        gameName: match.tournament.game?.name ?? '',
        launchUrl: match.tournament.game?.launchUrl ?? null,
      };
    }
    const teamIds = [match.teamAId, match.teamBId].filter((x): x is string => !!x);
    const membership = teamIds.length
      ? await this.members.findOne({ where: { userId, teamId: In(teamIds) } })
      : null;
    let side: 'a' | 'b' | null = membership ? (membership.teamId === match.teamAId ? 'a' : 'b') : null;
    // Older squads only linked the captain through tournament_teams.captainUserId.
    if (!side) side = match.teamA?.captainUserId === userId ? 'a' : match.teamB?.captainUserId === userId ? 'b' : null;
    const team = side === 'a' ? match.teamA : side === 'b' ? match.teamB : null;
    if (!side || !team || team.status === TournamentTeamStatus.Rejected) throw new ForbiddenException('You are not a player in this match');
    const teamPending = team.status !== TournamentTeamStatus.Verified;
    const info = teamPending ? null : (match.room?.[side] ?? null);
    const hasDetails = !!info && !!(info.roomId || info.password || info.slot || info.serverUrl);
    const open = !!info?.open && hasDetails;
    return {
      matchId: match.id,
      status: open ? 'available' : 'locked',
      side,
      teamPending,
      room: open && info ? { roomId: info.roomId, password: info.password, slot: info.slot, serverUrl: info.serverUrl } : null,
      gameName: match.tournament.game?.name ?? '',
      launchUrl: match.tournament.game?.launchUrl ?? null,
    };
  }

  async myMatches(userId: string): Promise<PublicTournamentMatch[]> {
    const captained = await this.teams.find({ where: { captainUserId: userId }, select: { id: true } });
    const playing = await this.members.find({ where: { userId }, select: { teamId: true } });
    const teamIds = [...new Set([...captained.map((t) => t.id), ...playing.map((m) => m.teamId)])];
    if (teamIds.length === 0) return [];
    const rows = await this.matchQuery()
      .where('(m.teamAId IN (:...teamIds) OR m.teamBId IN (:...teamIds))', { teamIds })
      .andWhere('tournament.status <> :draft', { draft: TournamentStatus.Draft })
      .andWhere(`tournament.format <> 'battle_royale'`)
      .orderBy('m.scheduledAt', 'DESC', 'NULLS LAST')
      .addOrderBy('m.createdAt', 'DESC')
      .getMany();
    const versus = await this.withPlayerAccounts(rows);
    // Battle royale: the matches the caller's team takes part in (its group's, then the stages it reached).
    const myTeams = await this.teams.find({ where: { id: In(teamIds) }, relations: { tournament: true } });
    const br: PublicTournamentMatch[] = [];
    for (const team of myTeams) {
      const t = team.tournament;
      if (!t || t.format !== 'battle_royale' || t.status === TournamentStatus.Draft || team.status === TournamentTeamStatus.Rejected) continue;
      const { matches, teams, bracket } = await this.brState(t);
      br.push(...matches.filter((m) => brMatchTeams(m, bracket, teams).includes(team.id)));
    }
    return [...versus, ...br].sort((a, b) => (b.scheduledAt ?? '').localeCompare(a.scheduledAt ?? ''));
  }
}
