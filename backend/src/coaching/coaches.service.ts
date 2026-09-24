import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { CoachStatus, SubscriptionAudience, VerificationStatus } from '@wavehub/shared-types';
import type { AdminCoachSummary, MyCoachProfile, PublicCoachDetail, PublicCoachReview, PublicCoachSummary } from '@wavehub/shared-types';
import { Coach } from './coach.entity';
import { ApplyCoachDto } from './dto/apply-coach.dto';
import { BrowseCoachesDto } from './dto/browse-coaches.dto';
import { assertValidVerificationTransition } from './coach-lifecycle';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { CommunityService, ONLINE_WINDOW_MINUTES } from '../community/community.service';
import { Game } from '../listings/game.entity';
import { CoachFavorite } from './coach-favorite.entity';
import { CoachingSessionReview } from './coaching-session-review.entity';
import { UpdateCoachProfileDto } from './dto/update-coach-profile.dto';

type CoachStats = { completed: number; cancelled: number; students: number };
// A response time needs at least this many answered messages before it's shown.
const MIN_RESPONSE_SAMPLES = 3;

@Injectable()
export class CoachesService {
  constructor(
    @InjectRepository(Coach) private readonly coaches: Repository<Coach>,
    @InjectRepository(Game) private readonly games: Repository<Game>,
    @InjectRepository(CoachFavorite) private readonly favorites: Repository<CoachFavorite>,
    @InjectRepository(CoachingSessionReview) private readonly reviews: Repository<CoachingSessionReview>,
    private readonly subscriptions: SubscriptionsService,
    private readonly community: CommunityService,
    private readonly dataSource: DataSource,
  ) {}

  // --- Computed profile facts (docs/design-mockups 06/14) ---

  private async sessionStats(coachIds: string[]): Promise<Map<string, CoachStats>> {
    if (coachIds.length === 0) return new Map();
    const rows: Array<{ coachId: string } & CoachStats> = await this.dataSource.query(
      `SELECT "coachId",
              count(*) FILTER (WHERE "status" = 'completed')::int AS completed,
              count(*) FILTER (WHERE "status" = 'cancelled')::int AS cancelled,
              count(DISTINCT "buyerId") FILTER (WHERE "status" = 'completed')::int AS students
       FROM "coaching_sessions" WHERE "coachId" = ANY($1::uuid[]) GROUP BY "coachId"`,
      [coachIds],
    );
    return new Map(rows.map((r) => [r.coachId, { completed: r.completed, cancelled: r.cancelled, students: r.students }]));
  }

  // Median minutes each user took to answer a new message from the other party (order and direct
  // chats, last 90 days): a "turn" is the other party's first message after the user last spoke;
  // its answer is the user's next message in that conversation. Real data only — null below
  // MIN_RESPONSE_SAMPLES answered turns.
  private async responseMinutes(userIds: string[]): Promise<Map<string, number>> {
    if (userIds.length === 0) return new Map();
    const rows: Array<{ uid: string; median: number; n: number }> = await this.dataSource.query(
      `WITH u AS (SELECT unnest($1::uuid[]) AS uid),
       m AS (
         SELECT u.uid, msg."conversationId", msg."senderId", msg."createdAt",
                lag(msg."senderId") OVER (PARTITION BY u.uid, msg."conversationId" ORDER BY msg."createdAt") AS prev
         FROM u
         JOIN "conversations" c ON c."buyerId" = u.uid OR c."sellerId" = u.uid
         JOIN "messages" msg ON msg."conversationId" = c."id" AND msg."senderId" IS NOT NULL
         WHERE msg."createdAt" > now() - interval '90 days'
       ),
       turns AS (SELECT uid, "conversationId", "createdAt" FROM m WHERE "senderId" <> uid AND (prev IS NULL OR prev = uid)),
       answered AS (
         SELECT t.uid, extract(epoch FROM (r.at - t."createdAt")) / 60 AS mins
         FROM turns t
         CROSS JOIN LATERAL (
           SELECT min(x."createdAt") AS at FROM "messages" x
           WHERE x."conversationId" = t."conversationId" AND x."senderId" = t.uid AND x."createdAt" > t."createdAt"
         ) r
         WHERE r.at IS NOT NULL
       )
       SELECT uid, percentile_cont(0.5) WITHIN GROUP (ORDER BY mins) AS median, count(*)::int AS n FROM answered GROUP BY uid`,
      [userIds],
    );
    return new Map(rows.filter((r) => r.n >= MIN_RESPONSE_SAMPLES).map((r) => [r.uid, Math.max(1, Math.ceil(Number(r.median)))]));
  }

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
    if (filters.gameIds?.length) {
      qb.andWhere('coach.gameId IN (:...gameIds)', { gameIds: filters.gameIds });
    }
    if (filters.maxRate) {
      qb.andWhere('coach.hourlyRateWaveCoin <= :maxRate', { maxRate: filters.maxRate });
    }
    if (filters.language) {
      qb.andWhere(':language = ANY(coach.languages)', { language: filters.language });
    }

    qb.orderBy('featured_boost', 'DESC');
    switch (filters.sort) {
      case 'price_asc':
        qb.addOrderBy('coach.hourlyRateWaveCoin', 'ASC');
        break;
      case 'price_desc':
        qb.addOrderBy('coach.hourlyRateWaveCoin', 'DESC');
        break;
      case 'reviews':
        qb.addOrderBy('coach.ratingCount', 'DESC');
        break;
      default:
        qb.addOrderBy('coach.ratingAvg', 'DESC', 'NULLS LAST').addOrderBy('coach.ratingCount', 'DESC');
    }

    const [rows, total] = await qb
      .addOrderBy('coach.id', 'ASC')
      .take(filters.limit ?? 20)
      .skip(filters.offset ?? 0)
      .getManyAndCount();

    const [perks, stats, response] = await Promise.all([
      this.subscriptions.getActivePerksForUsers(
        rows.map((r) => r.userId),
        SubscriptionAudience.SellerCoach,
      ),
      this.sessionStats(rows.map((r) => r.id)),
      this.responseMinutes(rows.map((r) => r.userId)),
    ]);
    return {
      items: rows.map((row) =>
        this.toSummary(row, perks.get(row.userId)?.profileBadge ?? null, stats.get(row.id)?.completed ?? 0, response.get(row.userId) ?? null),
      ),
      total,
    };
  }

  async findPublicById(id: string): Promise<PublicCoachDetail> {
    const coach = await this.coaches.findOne({
      where: { id, verificationStatus: VerificationStatus.Verified, status: CoachStatus.Active },
      relations: ['user', 'game'],
    });
    if (!coach) throw new NotFoundException('Coach not found');
    const [perks, stats, response, rank, extraGames] = await Promise.all([
      this.subscriptions.getActivePerks(coach.userId, SubscriptionAudience.SellerCoach),
      this.sessionStats([coach.id]),
      this.responseMinutes([coach.userId]),
      this.community.waveRank(coach.userId),
      coach.extraGameIds?.length ? this.games.find({ where: { id: In(coach.extraGameIds) } }) : Promise.resolve([] as Game[]),
    ]);
    const s = stats.get(coach.id) ?? { completed: 0, cancelled: 0, students: 0 };
    const finished = s.completed + s.cancelled;
    const games = [
      ...(coach.game ? [{ id: coach.game.id, name: coach.game.name, slug: coach.game.slug, main: true }] : []),
      ...extraGames.filter((g) => g.id !== coach.gameId).map((g) => ({ id: g.id, name: g.name, slug: g.slug, main: false })),
    ];
    return {
      ...this.toSummary(coach, perks?.profileBadge ?? null, s.completed, response.get(coach.userId) ?? null),
      bio: coach.bio,
      videoUrl: coach.videoUrl,
      quote: coach.quote,
      coachingStyle: coach.coachingStyle ?? [],
      games,
      stats: { students: s.students, sessions: s.completed, successRate: finished ? Math.round((s.completed / finished) * 100) : null },
      waveScore: { score: Math.round(rank.score / 10), tier: rank.name },
    };
  }

  async listReviews(coachId: string): Promise<PublicCoachReview[]> {
    await this.findPublicById(coachId);
    const rows = await this.reviews.find({ where: { coachId }, relations: { buyer: true }, order: { createdAt: 'DESC' }, take: 50 });
    return rows.map((r) => ({ id: r.id, rating: r.rating, body: r.body, buyerUsername: r.buyer.username, createdAt: r.createdAt.toISOString() }));
  }

  // --- The coach's own profile ---

  private toMyProfile(coach: Coach): MyCoachProfile {
    return {
      id: coach.id,
      gameId: coach.gameId,
      specialty: coach.specialty,
      bio: coach.bio,
      languages: coach.languages ?? [],
      hourlyRateWaveCoin: coach.hourlyRateWaveCoin,
      rank: coach.rank,
      videoUrl: coach.videoUrl,
      quote: coach.quote,
      coachingStyle: coach.coachingStyle ?? [],
      extraGameIds: coach.extraGameIds ?? [],
      verificationStatus: coach.verificationStatus,
    };
  }

  async getMyProfile(userId: string): Promise<MyCoachProfile> {
    const coach = await this.coaches.findOne({ where: { userId } });
    if (!coach) throw new NotFoundException('You are not a coach');
    return this.toMyProfile(coach);
  }

  async updateMyProfile(userId: string, dto: UpdateCoachProfileDto): Promise<MyCoachProfile> {
    const coach = await this.coaches.findOne({ where: { userId } });
    if (!coach) throw new NotFoundException('You are not a coach');
    const gameIds = [dto.gameId, ...(dto.extraGameIds ?? [])].filter((g): g is string => !!g);
    if (gameIds.length) {
      const known = await this.games.count({ where: { id: In([...new Set(gameIds)]) } });
      if (known !== new Set(gameIds).size) throw new BadRequestException('Unknown game');
    }
    const patch: Partial<Coach> = {};
    if (dto.gameId !== undefined) patch.gameId = dto.gameId;
    if (dto.specialty !== undefined) patch.specialty = dto.specialty.trim();
    if (dto.bio !== undefined) patch.bio = dto.bio.trim();
    if (dto.languages !== undefined) patch.languages = [...new Set(dto.languages)];
    if (dto.hourlyRateWaveCoin !== undefined) patch.hourlyRateWaveCoin = dto.hourlyRateWaveCoin;
    if (dto.rank !== undefined) patch.rank = dto.rank?.trim() || null;
    if (dto.videoUrl !== undefined) patch.videoUrl = dto.videoUrl?.trim() || null;
    if (dto.quote !== undefined) patch.quote = dto.quote?.trim() || null;
    if (dto.coachingStyle !== undefined) patch.coachingStyle = dto.coachingStyle.map((c) => c.trim()).filter(Boolean);
    if (dto.extraGameIds !== undefined) patch.extraGameIds = [...new Set(dto.extraGameIds)].filter((g) => g !== (dto.gameId ?? coach.gameId));
    await this.coaches.update(coach.id, patch);
    return this.toMyProfile(await this.coaches.findOneOrFail({ where: { id: coach.id } }));
  }

  // --- Saved coaches ("Add to Wishlist") ---

  async favoriteIds(userId: string): Promise<string[]> {
    return (await this.favorites.find({ where: { userId }, select: { coachId: true } })).map((f) => f.coachId);
  }

  async addFavorite(userId: string, coachId: string): Promise<{ ok: true }> {
    await this.findPublicById(coachId);
    await this.favorites.createQueryBuilder().insert().values({ userId, coachId }).orIgnore().execute();
    return { ok: true };
  }

  async removeFavorite(userId: string, coachId: string): Promise<{ ok: true }> {
    await this.favorites.delete({ userId, coachId });
    return { ok: true };
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

  private toSummary(coach: Coach, profileBadge: string | null = null, completedSessions = 0, responseMinutes: number | null = null): PublicCoachSummary {
    return {
      id: coach.id,
      userId: coach.userId,
      username: coach.user.username,
      firstName: coach.user.firstName,
      lastName: coach.user.lastName,
      specialty: coach.specialty,
      gameName: coach.game?.name ?? null,
      gameSlug: coach.game?.slug ?? null,
      hourlyRateWaveCoin: coach.hourlyRateWaveCoin,
      ratingAvg: coach.ratingAvg,
      ratingCount: coach.ratingCount,
      profileBadge,
      languages: coach.languages ?? [],
      avatarUrl: coach.user.avatarUrl ?? null,
      // Same "online" definition as the community online counter (last authenticated request within
      // ONLINE_WINDOW_MINUTES) — the only real presence signal there is.
      online: isRecentlySeen(coach.user.lastSeenAt),
      rank: coach.rank ?? null,
      responseMinutes,
      completedSessions,
    };
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

function isRecentlySeen(lastSeenAt: Date | null | undefined): boolean {
  return !!lastSeenAt && Date.now() - lastSeenAt.getTime() < ONLINE_WINDOW_MINUTES * 60_000;
}
