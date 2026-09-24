import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { TournamentMatchStage, TournamentMatchStatus, TournamentStatus, TournamentTeamStatus } from '@wavehub/shared-types';
import type {
  MatchTeamStats,
  MyTournamentEntry,
  PublicTournamentMatch,
  PublicTournamentSummary,
  PublicTournamentTeam,
  TournamentPrizes,
  TournamentTeamRef,
} from '@wavehub/shared-types';
import { Tournament } from './tournament.entity';
import { TournamentRegistration } from './tournament-registration.entity';
import { TournamentTeam } from './tournament-team.entity';
import { TournamentMatch } from './tournament-match.entity';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { BrowseTournamentsDto } from './dto/browse-tournaments.dto';
import { RegisterTeamDto } from './dto/register-team.dto';
import { MatchDto, MatchTeamStatsDto } from './dto/match.dto';
import { StorageService } from '../storage/storage.service';
import { User } from '../users/user.entity';

const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_COVER_BYTES = 5 * 1024 * 1024;
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const EMPTY_PRIZES: TournamentPrizes = { places: [], specialRewards: [], note: null };
// Withdrawing (or registering) is only possible before play starts.
const REGISTRATION_EDITABLE = [TournamentStatus.Open, TournamentStatus.Upcoming];

type UploadedImage = { buffer: Buffer; originalname: string; mimetype: string; size: number };

function normalizeStats(stats: MatchTeamStatsDto | null | undefined): MatchTeamStats | null {
  if (!stats) return null;
  return {
    coach: stats.coach?.trim() || null,
    players: stats.players.map((p) => ({
      name: p.name.trim(),
      kills: p.kills ?? null,
      kd: p.kd ?? null,
      damage: p.damage ?? null,
      rating: p.rating ?? null,
      assists: p.assists ?? null,
      mvp: !!p.mvp,
    })),
  };
}

@Injectable()
export class TournamentsService {
  constructor(
    @InjectRepository(Tournament) private readonly tournaments: Repository<Tournament>,
    @InjectRepository(TournamentRegistration) private readonly registrations: Repository<TournamentRegistration>,
    @InjectRepository(TournamentTeam) private readonly teams: Repository<TournamentTeam>,
    @InjectRepository(TournamentMatch) private readonly matches: Repository<TournamentMatch>,
    private readonly dataSource: DataSource,
    private readonly storage: StorageService,
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
      createdAt: tournament.createdAt.toISOString(),
    };
  }

  private toPublicTeam(team: TournamentTeam): PublicTournamentTeam {
    return {
      id: team.id,
      tournamentId: team.tournamentId,
      name: team.name,
      tag: team.tag,
      logoUrl: team.logoUrl,
      captainUsername: team.captain?.username ?? '',
      coachName: team.coachName,
      members: team.members ?? [],
      status: team.status,
      createdAt: team.createdAt.toISOString(),
    };
  }

  private teamRef(team: TournamentTeam | null): TournamentTeamRef | null {
    return team ? { id: team.id, name: team.name, tag: team.tag, logoUrl: team.logoUrl } : null;
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
    };
  }

  // --- Admin: tournaments ---

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
    return this.getOrThrow(id);
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

  async browse(filters: BrowseTournamentsDto): Promise<{ items: PublicTournamentSummary[]; total: number }> {
    const qb = this.tournaments.createQueryBuilder('t').leftJoinAndSelect('t.game', 'game');
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

  async findPublicById(id: string): Promise<PublicTournamentSummary> {
    const tournament = await this.getOrThrow(id);
    return this.toPublic(tournament);
  }

  // --- Registration ---

  // The tournament IDs the caller registered a team for (as captain or solo player).
  async listMyRegisteredIds(userId: string): Promise<string[]> {
    const rows = await this.registrations.find({ where: { userId }, select: { tournamentId: true } });
    return rows.map((row) => row.tournamentId);
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
          if (detail.includes('name')) throw new ConflictException('A team with this name is already registered');
          throw new ForbiddenException('You are already registered for this tournament');
        }
        throw err;
      }
    });
  }

  // Solo tournaments (teamSize 1): the player becomes a verified one-player team.
  async register(tournamentId: string, userId: string): Promise<PublicTournamentSummary> {
    const tournament = await this.getOrThrow(tournamentId);
    if ((tournament.teamSize ?? 1) > 1) {
      throw new BadRequestException('This is a team tournament — register a team');
    }
    await this.registerLocked(tournamentId, userId, 1, async (manager) => {
      const user = await manager.findOneOrFail(User, { where: { id: userId } });
      return manager.save(
        manager.create(TournamentTeam, {
          tournamentId,
          captainUserId: userId,
          name: user.username.slice(0, 30),
          members: [user.username],
          status: TournamentTeamStatus.Verified,
        }),
      );
    });
    return this.toPublic(tournament);
  }

  // Squad tournaments: the captain registers the team with exactly `teamSize` in-game names; it
  // waits for staff verification.
  async registerTeam(tournamentId: string, userId: string, dto: RegisterTeamDto): Promise<PublicTournamentTeam> {
    const tournament = await this.getOrThrow(tournamentId);
    const teamSize = tournament.teamSize ?? 1;
    if (teamSize <= 1) throw new BadRequestException('This is a solo tournament — use register');
    const members = dto.members.map((m) => m.trim()).filter(Boolean);
    if (members.length !== teamSize) {
      throw new BadRequestException(`A team needs exactly ${teamSize} players`);
    }
    if (new Set(members.map((m) => m.toLowerCase())).size !== members.length) {
      throw new BadRequestException('Player names must be different');
    }
    let teamId = '';
    await this.registerLocked(tournamentId, userId, teamSize, async (manager) => {
      const team = await manager.save(
        manager.create(TournamentTeam, {
          tournamentId,
          captainUserId: userId,
          name: dto.name.trim(),
          tag: dto.tag?.trim().toUpperCase() || null,
          coachName: dto.coachName?.trim() || null,
          members,
          status: TournamentTeamStatus.Pending,
        }),
      );
      teamId = team.id;
      return team;
    });
    return this.toPublicTeam(await this.teams.findOneOrFail({ where: { id: teamId }, relations: { captain: true } }));
  }

  private async myTeamOrThrow(tournamentId: string, userId: string): Promise<TournamentTeam> {
    const team = await this.teams.findOne({ where: { tournamentId, captainUserId: userId }, relations: { captain: true } });
    if (!team) throw new NotFoundException('You have no team in this tournament');
    return team;
  }

  async setMyTeamLogo(tournamentId: string, userId: string, file: UploadedImage): Promise<PublicTournamentTeam> {
    const team = await this.myTeamOrThrow(tournamentId, userId);
    this.validateImage(file, MAX_LOGO_BYTES, 'Team logo');
    const stored = await this.storage.save(file.buffer, file.originalname, 'image');
    team.logoUrl = stored.url;
    await this.teams.update(team.id, { logoUrl: stored.url });
    return this.toPublicTeam(team);
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
    await this.getOrThrow(tournamentId);
    const rows = await this.teams.find({
      where: { tournamentId, status: In([TournamentTeamStatus.Verified, TournamentTeamStatus.Pending]) },
      relations: { captain: true },
      order: { createdAt: 'ASC' },
    });
    return rows.map((row) => this.toPublicTeam(row));
  }

  async adminListTeams(tournamentId: string): Promise<PublicTournamentTeam[]> {
    await this.getOrThrow(tournamentId);
    const rows = await this.teams.find({ where: { tournamentId }, relations: { captain: true }, order: { createdAt: 'ASC' } });
    return rows.map((row) => this.toPublicTeam(row));
  }

  async adminSetTeamStatus(tournamentId: string, teamId: string, status: TournamentTeamStatus): Promise<PublicTournamentTeam> {
    const team = await this.teams.findOne({ where: { id: teamId, tournamentId }, relations: { captain: true } });
    if (!team) throw new NotFoundException('Team not found');
    await this.teams.update(team.id, { status });
    team.status = status;
    return this.toPublicTeam(team);
  }

  // --- Matches ---

  private matchQuery() {
    return this.matches
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.teamA', 'teamA')
      .leftJoinAndSelect('m.teamB', 'teamB')
      .leftJoinAndSelect('m.tournament', 'tournament');
  }

  async listMatches(tournamentId: string): Promise<PublicTournamentMatch[]> {
    await this.getOrThrow(tournamentId);
    const rows = await this.matchQuery()
      .where('m.tournamentId = :tournamentId', { tournamentId })
      .orderBy('m.scheduledAt', 'DESC', 'NULLS LAST')
      .addOrderBy('m.createdAt', 'DESC')
      .getMany();
    return rows.map((row) => this.toPublicMatch(row));
  }

  async getMatch(tournamentId: string, matchId: string): Promise<PublicTournamentMatch> {
    const row = await this.matchQuery().where('m.id = :matchId AND m.tournamentId = :tournamentId', { matchId, tournamentId }).getOne();
    if (!row) throw new NotFoundException('Match not found');
    return this.toPublicMatch(row);
  }

  private async assertTeamsBelong(tournamentId: string, teamAId: string | null | undefined, teamBId: string | null | undefined) {
    const ids = [teamAId, teamBId].filter((id): id is string => !!id);
    if (teamAId && teamBId && teamAId === teamBId) throw new BadRequestException('A team cannot play itself');
    if (ids.length === 0) return;
    const found = await this.teams.count({ where: { tournamentId, id: In(ids) } });
    if (found !== ids.length) throw new BadRequestException('Both teams must be registered in this tournament');
  }

  private applyMatchDto(match: TournamentMatch, dto: MatchDto) {
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
    if (dto.stats !== undefined) {
      match.stats = {
        a: dto.stats.a !== undefined ? normalizeStats(dto.stats.a) : (match.stats?.a ?? null),
        b: dto.stats.b !== undefined ? normalizeStats(dto.stats.b) : (match.stats?.b ?? null),
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
    this.applyMatchDto(match, dto);
    const saved = await this.matches.save(match);
    return this.getMatch(tournamentId, saved.id);
  }

  async adminUpdateMatch(tournamentId: string, matchId: string, dto: MatchDto): Promise<PublicTournamentMatch> {
    const match = await this.matches.findOne({ where: { id: matchId, tournamentId } });
    if (!match) throw new NotFoundException('Match not found');
    this.applyMatchDto(match, dto);
    await this.assertTeamsBelong(tournamentId, match.teamAId, match.teamBId);
    await this.matches.save(match);
    return this.getMatch(tournamentId, matchId);
  }

  async adminDeleteMatch(tournamentId: string, matchId: string): Promise<{ ok: true }> {
    const result = await this.matches.delete({ id: matchId, tournamentId });
    if (!result.affected) throw new NotFoundException('Match not found');
    return { ok: true };
  }

  // --- The caller's own tournaments (My Tournaments, Tournament Hub) ---

  async myTournaments(userId: string): Promise<MyTournamentEntry[]> {
    const rows = await this.registrations.find({
      where: { userId },
      relations: { tournament: { game: true }, team: { captain: true } },
      order: { registeredAt: 'DESC' },
    });
    const entries: MyTournamentEntry[] = [];
    for (const row of rows) {
      if (!row.team) continue;
      entries.push({ tournament: await this.toPublic(row.tournament), team: this.toPublicTeam(row.team), registeredAt: row.registeredAt.toISOString() });
    }
    return entries;
  }

  // Every match any of the caller's teams plays or played (newest first).
  async myMatches(userId: string): Promise<PublicTournamentMatch[]> {
    const teamIds = (await this.teams.find({ where: { captainUserId: userId }, select: { id: true } })).map((t) => t.id);
    if (teamIds.length === 0) return [];
    const rows = await this.matchQuery()
      .where('m.teamAId IN (:...teamIds) OR m.teamBId IN (:...teamIds)', { teamIds })
      .orderBy('m.scheduledAt', 'DESC', 'NULLS LAST')
      .addOrderBy('m.createdAt', 'DESC')
      .getMany();
    return rows.map((row) => this.toPublicMatch(row));
  }
}
