import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserStatus } from '@wavehub/shared-types';
import type { TournamentLeaderboard, TournamentLeaderboardEntry as EntryView } from '@wavehub/shared-types';
import { TournamentLeaderboardEntry } from './tournament-leaderboard-entry.entity';
import { LeaderboardEntryDto } from './dto/leaderboard.dto';
import { User } from '../users/user.entity';
import { StorageService } from '../storage/storage.service';
import { PlatformSettingsService } from '../settings/platform-settings.service';
import { scopeGameIds, type StaffScope } from '../admin/staff-scope';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOGO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const TOP_PLAYERS = 3;
const TOP_TEAMS = 5;
const PUBLIC_CACHE_MS = 30_000;

type UploadedImage = { buffer: Buffer; originalname: string; mimetype: string; size: number };

// The hand-entered tournament leaderboard (owner 2026-11-10: "manually entered data, players as
// @username, show/hide from the admin panel"). Public read is cached briefly per game filter.
@Injectable()
export class TournamentLeaderboardService {
  private cache = new Map<string, { value: TournamentLeaderboard; expiresAt: number }>();

  constructor(
    @InjectRepository(TournamentLeaderboardEntry) private readonly entries: Repository<TournamentLeaderboardEntry>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly storage: StorageService,
    private readonly settings: PlatformSettingsService,
  ) {}

  private view(row: TournamentLeaderboardEntry): EntryView {
    const player = row.kind === 'player' && row.user && row.user.status === UserStatus.Active ? row.user : null;
    return {
      id: row.id,
      kind: row.kind,
      gameId: row.gameId,
      gameName: row.game?.name ?? null,
      username: player?.username ?? null,
      name: player?.username ?? row.name,
      imageUrl: row.kind === 'player' ? (player?.avatarUrl ?? null) : row.logoUrl,
      wins: row.wins,
      kills: row.kills,
      points: row.points,
    };
  }

  private query() {
    return this.entries
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.game', 'game')
      .leftJoinAndSelect('e.user', 'user')
      .orderBy('e.points', 'DESC')
      .addOrderBy('e.wins', 'DESC')
      .addOrderBy('e.kills', 'DESC')
      .addOrderBy('e.createdAt', 'ASC');
  }

  async publicBoard(gameId?: string): Promise<TournamentLeaderboard> {
    const { tournamentLeaderboard } = await this.settings.getFeatures();
    if (!tournamentLeaderboard) return { visible: false, players: [], teams: [] };
    const key = gameId ?? '*';
    const hit = this.cache.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.value;
    const top = async (kind: 'player' | 'team', take: number) => {
      const q = this.query().where('e.kind = :kind', { kind });
      if (kind === 'player') q.andWhere('user.status = :active', { active: UserStatus.Active });
      if (gameId) q.andWhere('e.gameId = :gameId', { gameId });
      return (await q.take(take).getMany()).map((r) => this.view(r));
    };
    const value: TournamentLeaderboard = { visible: true, players: await top('player', TOP_PLAYERS), teams: await top('team', TOP_TEAMS) };
    this.cache.set(key, { value, expiresAt: Date.now() + PUBLIC_CACHE_MS });
    return value;
  }

  async adminList(scope: StaffScope): Promise<{ visible: boolean; entries: EntryView[] }> {
    const ids = scopeGameIds(scope, 'tournaments');
    const q = this.query();
    if (ids) {
      if (ids.length === 0) return { visible: (await this.settings.getFeatures()).tournamentLeaderboard, entries: [] };
      q.where('e.gameId IN (:...ids)', { ids });
    }
    return { visible: (await this.settings.getFeatures()).tournamentLeaderboard, entries: (await q.getMany()).map((r) => this.view(r)) };
  }

  private assertScope(scope: StaffScope, gameId: string | null) {
    const ids = scopeGameIds(scope, 'tournaments');
    if (ids && (!gameId || !ids.includes(gameId))) throw new ForbiddenException('This game is outside your staff access');
  }

  private async resolvePlayer(name: string): Promise<User> {
    const q = name.trim().replace(/^@/, '');
    const user = await this.users
      .createQueryBuilder('u')
      .where(UUID.test(q) ? 'u.id = :q' : 'lower(u.username) = lower(:q)', { q })
      .getOne();
    if (!user || user.status !== UserStatus.Active) throw new BadRequestException(`No active WaveHub account "@${q}"`);
    return user;
  }

  private async getOrThrow(id: string): Promise<TournamentLeaderboardEntry> {
    const row = await this.entries.findOne({ where: { id }, relations: { game: true, user: true } });
    if (!row) throw new NotFoundException('Leaderboard entry not found');
    return row;
  }

  async save(scope: StaffScope, dto: LeaderboardEntryDto, id?: string): Promise<EntryView> {
    const gameId = dto.gameId ?? null;
    this.assertScope(scope, gameId);
    const row = id ? await this.getOrThrow(id) : this.entries.create({ logoUrl: null });
    if (id) this.assertScope(scope, row.gameId);
    row.kind = dto.kind;
    row.gameId = gameId;
    row.wins = dto.wins;
    row.kills = dto.kills;
    row.points = dto.points;
    if (dto.kind === 'player') {
      const user = await this.resolvePlayer(dto.name);
      row.userId = user.id;
      row.name = user.username.slice(0, 40);
    } else {
      row.userId = null;
      row.name = dto.name.trim();
    }
    const saved = await this.entries.save(row);
    this.cache.clear();
    return this.view(await this.getOrThrow(saved.id));
  }

  async setLogo(scope: StaffScope, id: string, file: UploadedImage | undefined): Promise<EntryView> {
    const row = await this.getOrThrow(id);
    this.assertScope(scope, row.gameId);
    if (!file) throw new BadRequestException('No file uploaded');
    if (!LOGO_TYPES.includes(file.mimetype)) throw new ForbiddenException('Only JPG, PNG, or WEBP images are allowed');
    if (file.size > 2 * 1024 * 1024) throw new ForbiddenException('Logo must be 2MB or smaller');
    const stored = await this.storage.save(file.buffer, file.originalname, 'image');
    await this.entries.update(id, { logoUrl: stored.url });
    this.cache.clear();
    return this.view(await this.getOrThrow(id));
  }

  async remove(scope: StaffScope, id: string): Promise<{ ok: true }> {
    const row = await this.getOrThrow(id);
    this.assertScope(scope, row.gameId);
    await this.entries.delete(id);
    this.cache.clear();
    return { ok: true };
  }

  async setVisible(visible: boolean): Promise<{ visible: boolean }> {
    await this.settings.setFeatures({ tournamentLeaderboard: visible });
    this.cache.clear();
    return { visible };
  }
}
