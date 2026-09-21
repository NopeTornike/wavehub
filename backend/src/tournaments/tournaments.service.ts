import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TournamentStatus } from '@wavehub/shared-types';
import type { PublicTournamentSummary } from '@wavehub/shared-types';
import { Tournament } from './tournament.entity';
import { TournamentRegistration } from './tournament-registration.entity';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { BrowseTournamentsDto } from './dto/browse-tournaments.dto';
import { StorageService } from '../storage/storage.service';

const ALLOWED_COVER_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_COVER_BYTES = 5 * 1024 * 1024;

@Injectable()
export class TournamentsService {
  constructor(
    @InjectRepository(Tournament) private readonly tournaments: Repository<Tournament>,
    @InjectRepository(TournamentRegistration) private readonly registrations: Repository<TournamentRegistration>,
    private readonly storage: StorageService,
  ) {}

  // Public responses are deliberately not personalized (no "am I registered" field) — this app
  // keeps public endpoints fully public and has the frontend cross-reference a separate
  // authenticated call for "my own" state instead of an optional-auth pattern, which doesn't
  // exist anywhere else in this codebase (AuthGuard always requires a valid session — see
  // auth.guard.ts). See `listMyRegisteredIds` below.
  private async toPublic(tournament: Tournament): Promise<PublicTournamentSummary> {
    const registeredCount = await this.registrations.count({ where: { tournamentId: tournament.id } });
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
      registeredCount,
      coverImageUrl: tournament.coverImageUrl,
      createdAt: tournament.createdAt.toISOString(),
    };
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
    });
    return this.tournaments.save(tournament);
  }

  async update(id: string, dto: UpdateTournamentDto): Promise<Tournament> {
    await this.getOrThrow(id);
    await this.tournaments.update(id, dto);
    return this.getOrThrow(id);
  }

  async setCoverImage(id: string, file: { buffer: Buffer; originalname: string; mimetype: string; size: number }): Promise<Tournament> {
    await this.getOrThrow(id);
    if (!ALLOWED_COVER_MIME_TYPES.includes(file.mimetype)) {
      throw new ForbiddenException('Only JPG, PNG, or WEBP images are allowed');
    }
    if (file.size > MAX_COVER_BYTES) {
      throw new ForbiddenException('Cover image exceeds the 5MB size limit');
    }
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

  async browse(filters: BrowseTournamentsDto): Promise<{ items: PublicTournamentSummary[]; total: number }> {
    const qb = this.tournaments.createQueryBuilder('t').leftJoinAndSelect('t.game', 'game');
    if (filters.gameId) {
      qb.andWhere('t.gameId = :gameId', { gameId: filters.gameId });
    }
    if (filters.status) {
      qb.andWhere('t.status = :status', { status: filters.status });
    }
    qb.orderBy('t.startDate', 'DESC').take(filters.limit ?? 20).skip(filters.offset ?? 0);

    const [rows, total] = await qb.getManyAndCount();
    const items = await Promise.all(rows.map((row) => this.toPublic(row)));
    return { items, total };
  }

  async findPublicById(id: string): Promise<PublicTournamentSummary> {
    const tournament = await this.getOrThrow(id);
    return this.toPublic(tournament);
  }

  // Authenticated-only — the tournament IDs the caller has registered for. The frontend
  // cross-references this against the public browse/detail response to render "Registered" state,
  // rather than the public endpoints being personalized (see toPublic's own comment).
  async listMyRegisteredIds(userId: string): Promise<string[]> {
    const rows = await this.registrations.find({ where: { userId }, select: { tournamentId: true } });
    return rows.map((row) => row.tournamentId);
  }

  // Free entry — no wallet involvement. Enforces the maxPlayers cap and one-registration-per-user
  // (the latter also DB-enforced by TournamentRegistration's UNIQUE(tournamentId, userId), so a
  // race between two requests from the same user can't double-register — the second one hits the
  // unique-violation catch below, same pattern as ReviewsService's duplicate-review guard).
  async register(tournamentId: string, userId: string): Promise<PublicTournamentSummary> {
    const tournament = await this.getOrThrow(tournamentId);
    if (tournament.status !== TournamentStatus.Open) {
      throw new ForbiddenException('Registration is not open for this tournament');
    }
    const registeredCount = await this.registrations.count({ where: { tournamentId } });
    if (registeredCount >= tournament.maxPlayers) {
      throw new ForbiddenException('This tournament is full');
    }

    try {
      const registration = this.registrations.create({ tournamentId, userId });
      await this.registrations.save(registration);
    } catch (err) {
      if ((err as { code?: string }).code === '23505') {
        throw new ForbiddenException('You are already registered for this tournament');
      }
      throw err;
    }

    return this.toPublic(tournament);
  }
}
