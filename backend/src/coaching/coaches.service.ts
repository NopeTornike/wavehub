import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CoachStatus, SubscriptionAudience, VerificationStatus } from '@wavehub/shared-types';
import type { AdminCoachSummary, PublicCoachDetail, PublicCoachSummary } from '@wavehub/shared-types';
import { Coach } from './coach.entity';
import { ApplyCoachDto } from './dto/apply-coach.dto';
import { BrowseCoachesDto } from './dto/browse-coaches.dto';
import { assertValidVerificationTransition } from './coach-lifecycle';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Injectable()
export class CoachesService {
  constructor(
    @InjectRepository(Coach) private readonly coaches: Repository<Coach>,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  // Creates a new application, or — if the user's previous application was rejected — reopens
  // that same row back to Pending (see coach-lifecycle.ts) rather than creating a second row,
  // since `userId` is unique. Rejects outright if the user already has a Pending or Verified
  // application; there's no "edit while pending" flow yet (matches Listings' own lack of an
  // edit-after-submit path for the same reason — see listings/CLAUDE.md).
  async apply(userId: string, dto: ApplyCoachDto): Promise<Coach> {
    const existing = await this.coaches.findOne({ where: { userId } });
    if (existing) {
      assertValidVerificationTransition(existing.verificationStatus, VerificationStatus.Pending);
      await this.coaches.update(existing.id, {
        gameId: dto.gameId ?? null,
        specialty: dto.specialty,
        bio: dto.bio,
        languages: dto.languages ?? [],
        hourlyRateWaveCoin: dto.hourlyRateWaveCoin,
        verificationStatus: VerificationStatus.Pending,
        rejectionReason: null,
      });
      return this.getOrThrow(existing.id);
    }

    const coach = this.coaches.create({
      userId,
      gameId: dto.gameId ?? null,
      specialty: dto.specialty,
      bio: dto.bio,
      languages: dto.languages ?? [],
      hourlyRateWaveCoin: dto.hourlyRateWaveCoin,
      verificationStatus: VerificationStatus.Pending,
      status: CoachStatus.Active,
    });
    return this.coaches.save(coach);
  }

  async findMine(userId: string): Promise<Coach | null> {
    return this.coaches.findOne({ where: { userId }, relations: ['game'] });
  }

  // Public directory — only ever verified + active, same "never leak a non-public state to a
  // public route" discipline as ListingsService.browseActive.
  async browseVerified(filters: BrowseCoachesDto): Promise<{ items: PublicCoachSummary[]; total: number }> {
    const qb = this.coaches
      .createQueryBuilder('coach')
      .leftJoinAndSelect('coach.user', 'user')
      .leftJoinAndSelect('coach.game', 'game')
      .where('coach.verificationStatus = :verified', { verified: VerificationStatus.Verified })
      .andWhere('coach.status = :active', { active: CoachStatus.Active })
      // Seller/Coach `featuredListings` perk boosts a coach ahead of the rating order (aliases are
      // quoted — raw join strings don't get TypeORM's alias escaping; see listings.service.ts).
      .leftJoin(
        'user_subscriptions',
        'coachSub',
        `"coachSub"."userId" = "coach"."userId" AND "coachSub"."status" IN ('active', 'past_due') AND "coachSub"."audience" = 'seller_coach'`,
      )
      .leftJoin(
        'subscription_plans',
        'coachPlan',
        `"coachPlan"."id" = "coachSub"."planId" AND ("coachPlan"."perks"->>'featuredListings')::boolean IS TRUE`,
      )
      .addSelect('CASE WHEN "coachPlan"."id" IS NOT NULL THEN 1 ELSE 0 END', 'featured_boost');

    if (filters.gameId) {
      qb.andWhere('coach.gameId = :gameId', { gameId: filters.gameId });
    }

    const [rows, total] = await qb
      .orderBy('featured_boost', 'DESC')
      .addOrderBy('coach.ratingAvg', 'DESC', 'NULLS LAST')
      .take(filters.limit ?? 20)
      .skip(filters.offset ?? 0)
      .getManyAndCount();

    const perks = await this.subscriptions.getActivePerksForUsers(
      rows.map((r) => r.userId),
      SubscriptionAudience.SellerCoach,
    );
    return {
      items: rows.map((row) => this.toSummary(row, perks.get(row.userId)?.profileBadge ?? null)),
      total,
    };
  }

  async findPublicById(id: string): Promise<PublicCoachDetail> {
    const coach = await this.coaches.findOne({
      where: { id, verificationStatus: VerificationStatus.Verified, status: CoachStatus.Active },
      relations: ['user', 'game'],
    });
    if (!coach) throw new NotFoundException('Coach not found');
    const perks = await this.subscriptions.getActivePerks(coach.userId, SubscriptionAudience.SellerCoach);
    return this.toDetail(coach, perks?.profileBadge ?? null);
  }

  // --- Admin-facing ---

  async listPendingVerification(): Promise<AdminCoachSummary[]> {
    const rows = await this.coaches.find({
      where: { verificationStatus: VerificationStatus.Pending },
      relations: ['user', 'game'],
      order: { createdAt: 'ASC' },
    });
    return rows.map((row) => this.toAdminSummary(row));
  }

  async listAll(): Promise<AdminCoachSummary[]> {
    const rows = await this.coaches.find({ relations: ['user', 'game'], order: { createdAt: 'DESC' } });
    return rows.map((row) => this.toAdminSummary(row));
  }

  async approve(id: string): Promise<AdminCoachSummary> {
    const coach = await this.getOrThrow(id);
    assertValidVerificationTransition(coach.verificationStatus, VerificationStatus.Verified);
    await this.coaches.update(id, { verificationStatus: VerificationStatus.Verified, rejectionReason: null });
    return this.toAdminSummary(await this.getOrThrow(id));
  }

  async reject(id: string, reason: string): Promise<AdminCoachSummary> {
    const coach = await this.getOrThrow(id);
    assertValidVerificationTransition(coach.verificationStatus, VerificationStatus.Rejected);
    await this.coaches.update(id, { verificationStatus: VerificationStatus.Rejected, rejectionReason: reason });
    return this.toAdminSummary(await this.getOrThrow(id));
  }

  async suspend(id: string): Promise<AdminCoachSummary> {
    const coach = await this.getOrThrow(id);
    if (coach.status === CoachStatus.Suspended) {
      throw new ForbiddenException('Coach is already suspended');
    }
    await this.coaches.update(id, { status: CoachStatus.Suspended });
    return this.toAdminSummary(await this.getOrThrow(id));
  }

  async restore(id: string): Promise<AdminCoachSummary> {
    const coach = await this.getOrThrow(id);
    if (coach.status !== CoachStatus.Suspended) {
      throw new ForbiddenException('Coach is not currently suspended');
    }
    await this.coaches.update(id, { status: CoachStatus.Active });
    return this.toAdminSummary(await this.getOrThrow(id));
  }

  private toSummary(coach: Coach, profileBadge: string | null = null): PublicCoachSummary {
    return {
      id: coach.id,
      username: coach.user.username,
      firstName: coach.user.firstName,
      lastName: coach.user.lastName,
      specialty: coach.specialty,
      gameName: coach.game?.name ?? null,
      hourlyRateWaveCoin: coach.hourlyRateWaveCoin,
      ratingAvg: coach.ratingAvg,
      ratingCount: coach.ratingCount,
      profileBadge,
    };
  }

  private toDetail(coach: Coach, profileBadge: string | null): PublicCoachDetail {
    return { ...this.toSummary(coach, profileBadge), bio: coach.bio, languages: coach.languages };
  }

  private toAdminSummary(coach: Coach): AdminCoachSummary {
    return {
      id: coach.id,
      userId: coach.userId,
      username: coach.user.username,
      specialty: coach.specialty,
      gameName: coach.game?.name ?? null,
      hourlyRateWaveCoin: coach.hourlyRateWaveCoin,
      verificationStatus: coach.verificationStatus,
      status: coach.status,
      rejectionReason: coach.rejectionReason,
      createdAt: coach.createdAt.toISOString(),
    };
  }

  private async getOrThrow(id: string): Promise<Coach> {
    const coach = await this.coaches.findOne({ where: { id }, relations: ['user', 'game'] });
    if (!coach) throw new NotFoundException('Coach not found');
    return coach;
  }
}
