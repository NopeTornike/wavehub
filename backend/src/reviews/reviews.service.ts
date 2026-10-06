import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { NotificationType, OrderStatus, ReviewStatus } from '@wavehub/shared-types';
import type { AdminReviewRow, AdminReviewSummary, OrderReviewState, PendingReview, PublicReview, MyReviewLikes } from '@wavehub/shared-types';
import { Review } from './review.entity';
import { ReviewReport } from './review-report.entity';
import { Order } from '../orders/order.entity';
import { Listing } from '../listings/listing.entity';
import { User } from '../users/user.entity';
import { CreateReviewDto } from './dto/create-review.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { CommunityService, ONLINE_WINDOW_MINUTES } from '../community/community.service';
import { CoachingSessionReview } from '../coaching/coaching-session-review.entity';
import { Coach } from '../coaching/coach.entity';
import { AdminEditReviewDto, ListAdminReviewsDto } from './dto/admin-reviews.dto';
import { ReviewLike } from './review-like.entity';

const POSTGRES_UNIQUE_VIOLATION = '23505';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    @InjectRepository(Review) private readonly reviews: Repository<Review>,
    @InjectRepository(ReviewReport) private readonly reports: Repository<ReviewReport>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(CoachingSessionReview) private readonly coachReviews: Repository<CoachingSessionReview>,
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
    private readonly community: CommunityService,
  ) {}

  // Gated on: the caller is the order's buyer, the order is Completed, and one review per order —
  // the last rule is enforced by a DB UNIQUE constraint on reviews.orderId (see the migration), not
  // just this check, so a race between two concurrent requests for the same order can't slip
  // through — the second insert fails at the DB and is translated into a clean error below.
  async create(buyerId: string, dto: CreateReviewDto): Promise<Review> {
    const order = await this.orders.findOne({ where: { id: dto.orderId } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.buyerId !== buyerId) {
      throw new ForbiddenException("This order doesn't belong to you");
    }
    if (order.status !== OrderStatus.Completed) {
      throw new ForbiddenException('You can only review a completed order');
    }

    return this.dataSource.transaction(async (manager) => {
      const review = manager.create(Review, {
        orderId: order.id,
        listingId: order.listingId,
        buyerId,
        sellerId: order.sellerId,
        rating: dto.rating,
        body: dto.body ?? null,
        tags: dto.tags ?? [],
      });

      let saved: Review;
      try {
        saved = await manager.save(review);
      } catch (err: any) {
        if (err?.code === POSTGRES_UNIQUE_VIOLATION) {
          throw new ForbiddenException('You already reviewed this order');
        }
        throw err;
      }

      await this.recomputeListingRating(manager, order.listingId);
      await this.recomputeSellerRating(manager, order.sellerId);

      return saved;
    }).then(async (saved) => {
      // Best-effort, outside the transaction — a notification failure must never undo a
      // successful review, same principle as every other hook module's `notify` helper.
      try {
        await this.notifications.emit(
          order.sellerId,
          NotificationType.ReviewPosted,
          'ახალი შეფასება',
          `თქვენ მიიღეთ ახალი შეფასება: ${dto.rating} ★`,
          { reviewId: saved.id, orderId: order.id },
        );
      } catch (err) {
        this.logger.error(`Failed to notify seller ${order.sellerId} of new review`, err as Error);
      }
      return saved;
    });
  }

  async reply(sellerId: string, reviewId: string, body: string): Promise<Review> {
    const review = await this.getReviewOrThrow(reviewId);
    if (review.sellerId !== sellerId) {
      throw new ForbiddenException("This review isn't on one of your orders");
    }
    if (review.sellerReply) {
      throw new ForbiddenException('You already replied to this review');
    }
    review.sellerReply = body;
    review.sellerRepliedAt = new Date();
    return this.reviews.save(review);
  }

  async report(reporterId: string, reviewId: string, reason: ReviewReport['reason']): Promise<ReviewReport> {
    const review = await this.getReviewOrThrow(reviewId);
    const report = this.reports.create({ reviewId: review.id, reportedBy: reporterId, reason });
    const saved = await this.reports.save(report);
    // Only a Published review flips to Reported. Reporting a Hidden/Deleted review (which any user
    // can do) must not resurrect it into the moderation queue as if it were live content.
    await this.reviews.update({ id: review.id, status: ReviewStatus.Published }, { status: ReviewStatus.Reported });
    return saved;
  }

  // Public listing reviews: only the reviewer's id/username/rank are exposed, never the user row.
  async findForListing(listingId: string, sort: 'newest' | 'highest' | 'lowest' = 'newest'): Promise<PublicReview[]> {
    const qb = this.reviews
      .createQueryBuilder('review')
      .leftJoin('review.buyer', 'buyer')
      .addSelect(['buyer.id', 'buyer.username', 'buyer.firstName', 'buyer.lastName', 'buyer.avatarUrl', 'buyer.lastSeenAt'])
      .leftJoin('review.seller', 'seller')
      .addSelect(['seller.id', 'seller.username', 'seller.firstName', 'seller.lastName', 'seller.avatarUrl'])
      .where('review.listingId = :listingId', { listingId })
      .andWhere('review.status = :status', { status: ReviewStatus.Published });

    if (sort === 'highest') {
      qb.orderBy('review.rating', 'DESC').addOrderBy('review.createdAt', 'DESC');
    } else if (sort === 'lowest') {
      qb.orderBy('review.rating', 'ASC').addOrderBy('review.createdAt', 'DESC');
    } else {
      qb.orderBy('review.createdAt', 'DESC');
    }

    const rows = await qb.getMany();
    const ranks = new Map<string, string>();
    await Promise.all(
      [...new Set(rows.flatMap((r) => [r.buyerId, r.sellerId]))].map(async (id) => ranks.set(id, (await this.community.waveRank(id)).name)),
    );
    const likes = new Map<string, number>();
    if (rows.length) {
      const counts: Array<{ reviewId: string; target: string; n: number }> = await this.dataSource.query(
        `SELECT "reviewId", "target", count(*)::int AS n FROM "review_likes" WHERE "reviewId" = ANY($1) GROUP BY 1, 2`,
        [rows.map((r) => r.id)],
      );
      for (const c of counts) likes.set(`${c.reviewId}:${c.target}`, c.n);
    }
    return rows.map((r) => this.toPublic(r, ranks.get(r.buyerId) ?? '', ranks.get(r.sellerId) ?? '', likes));
  }

  // 👍 on a review (any signed-in, verified user) or on the seller's reply to it. Idempotent.
  async like(userId: string, reviewId: string, target: 'review' | 'reply', liked: boolean): Promise<{ liked: boolean; count: number }> {
    const review = await this.reviews.findOne({ where: { id: reviewId, status: ReviewStatus.Published } });
    if (!review) throw new NotFoundException('Review not found');
    if (target === 'reply' && !review.sellerReply) throw new NotFoundException('This review has no reply');
    const repo = this.dataSource.getRepository(ReviewLike);
    if (liked) await repo.createQueryBuilder().insert().values({ reviewId, userId, target }).orIgnore().execute();
    else await repo.delete({ reviewId, userId, target });
    return { liked, count: await repo.count({ where: { reviewId, target } }) };
  }

  async myLikes(userId: string, listingId: string): Promise<MyReviewLikes> {
    const rows: Array<{ reviewId: string; target: 'review' | 'reply' }> = await this.dataSource.query(
      `SELECT l."reviewId", l."target" FROM "review_likes" l JOIN "reviews" r ON r."id" = l."reviewId"
        WHERE l."userId" = $1 AND r."listingId" = $2`,
      [userId, listingId],
    );
    return { review: rows.filter((r) => r.target === 'review').map((r) => r.reviewId), reply: rows.filter((r) => r.target === 'reply').map((r) => r.reviewId) };
  }

  private toPublic(r: Review, rank = '', sellerRank = '', likes = new Map<string, number>()): PublicReview {
    return {
      id: r.id,
      rating: r.rating,
      body: r.body,
      tags: r.tags ?? [],
      sellerReply: r.sellerReply,
      sellerRepliedAt: r.sellerRepliedAt ? r.sellerRepliedAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
      buyer: {
        id: r.buyer.id,
        username: r.buyer.username,
        firstName: r.buyer.firstName ?? '',
        lastName: r.buyer.lastName ?? '',
        avatarUrl: r.buyer.avatarUrl ?? null,
        online: !!r.buyer.lastSeenAt && Date.now() - new Date(r.buyer.lastSeenAt).getTime() < ONLINE_WINDOW_MINUTES * 60_000,
      },
      buyerRank: rank,
      seller: r.seller
        ? { id: r.seller.id, username: r.seller.username, firstName: r.seller.firstName ?? '', lastName: r.seller.lastName ?? '', avatarUrl: r.seller.avatarUrl ?? null, rank: sellerRank }
        : { id: r.sellerId, username: '', firstName: '', lastName: '', avatarUrl: null, rank: sellerRank },
      likeCount: likes.get(`${r.id}:review`) ?? 0,
      replyLikeCount: likes.get(`${r.id}:reply`) ?? 0,
    };
  }

  // The order page: has this order been reviewed (and is the review still live)? Buyer or seller only.
  async getForOrder(userId: string, orderId: string): Promise<OrderReviewState> {
    const order = await this.orders.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.buyerId !== userId && order.sellerId !== userId) throw new ForbiddenException("This order doesn't belong to you");
    const review = await this.reviews.findOne({ where: { orderId }, relations: { buyer: true } });
    if (!review) return { review: null, status: null };
    return { review: this.toPublic(review, (await this.community.waveRank(review.buyerId)).name), status: review.status };
  }

  // The caller's completed orders still waiting for a review (newest first) — the listing page's
  // "write a review" button and the dashboard reminder.
  async pendingForBuyer(buyerId: string): Promise<PendingReview[]> {
    const rows: Array<{ orderId: string; orderNumber: string; listingId: string; listingTitle: string; completedAt: Date | null }> = await this.dataSource.query(
      `SELECT o.id AS "orderId", o."orderNumber", o."listingId", l.title AS "listingTitle", o."completedAt"
         FROM orders o JOIN listings l ON l.id = o."listingId"
        WHERE o."buyerId" = $1 AND o.status = $2
          AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r."orderId" = o.id)
        ORDER BY o."completedAt" DESC NULLS LAST
        LIMIT 50`,
      [buyerId, OrderStatus.Completed],
    );
    return rows.map((r) => ({ ...r, completedAt: r.completedAt ? new Date(r.completedAt).toISOString() : null }));
  }

  // --- Staff: every review, product and coach (admin-reviews.controller.ts) ---

  async listAll(dto: ListAdminReviewsDto): Promise<{ items: AdminReviewRow[]; total: number }> {
    const take = 25;
    const skip = ((dto.page ?? 1) - 1) * take;
    const q = dto.q?.trim().toLowerCase();
    const like = q ? `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
    if (dto.kind === 'coach') {
      const qb = this.coachReviews
        .createQueryBuilder('r')
        .leftJoin('r.buyer', 'buyer')
        .leftJoin('r.coach', 'coach')
        .leftJoin('coach.user', 'coachUser')
        .select(['r.id', 'r.rating', 'r.body', 'r.createdAt', 'r.coachId', 'buyer.username', 'coach.id', 'coachUser.username'])
        .orderBy('r.createdAt', 'DESC')
        .skip(skip)
        .take(take);
      if (dto.status && dto.status !== ReviewStatus.Published) return { items: [], total: 0 };
      if (like) qb.andWhere('(lower(buyer.username) LIKE :like OR lower(coachUser.username) LIKE :like OR lower(coalesce(r.body, \'\')) LIKE :like)', { like });
      const [rows, total] = await qb.getManyAndCount();
      return {
        total,
        items: rows.map((r) => ({
          id: r.id,
          kind: 'coach' as const,
          rating: r.rating,
          body: r.body,
          status: ReviewStatus.Published,
          subjectTitle: `@${r.coach.user.username}`,
          subjectHref: `/coaching/${r.coachId}`,
          buyerUsername: r.buyer.username,
          sellerUsername: r.coach.user.username,
          sellerReply: null,
          createdAt: r.createdAt.toISOString(),
        })),
      };
    }
    const qb = this.reviews
      .createQueryBuilder('r')
      .leftJoin('r.buyer', 'buyer')
      .leftJoin('r.seller', 'seller')
      .leftJoin('r.listing', 'listing')
      .select(['r.id', 'r.rating', 'r.body', 'r.status', 'r.sellerReply', 'r.createdAt', 'r.listingId', 'buyer.username', 'seller.username', 'listing.title'])
      .orderBy('r.createdAt', 'DESC')
      .skip(skip)
      .take(take);
    if (dto.status) qb.andWhere('r.status = :status', { status: dto.status });
    if (like) {
      qb.andWhere(
        '(lower(buyer.username) LIKE :like OR lower(seller.username) LIKE :like OR lower(listing.title) LIKE :like OR lower(coalesce(r.body, \'\')) LIKE :like)',
        { like },
      );
    }
    const [rows, total] = await qb.getManyAndCount();
    return {
      total,
      items: rows.map((r) => ({
        id: r.id,
        kind: 'product' as const,
        rating: r.rating,
        body: r.body,
        status: r.status,
        subjectTitle: r.listing.title,
        subjectHref: `/listings/${r.listingId}`,
        buyerUsername: r.buyer.username,
        sellerUsername: r.seller.username,
        sellerReply: r.sellerReply,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  // Super Admin edit of a product review's rating/text/seller reply; aggregates follow. Returns the
  // before/after values for the audit log.
  async adminEditProduct(id: string, dto: AdminEditReviewDto): Promise<{ before: Record<string, unknown>; after: Record<string, unknown> }> {
    const review = await this.getReviewOrThrow(id);
    const patch = this.editPatch(dto, true);
    const before = Object.fromEntries(Object.keys(patch).map((k) => [k, (review as unknown as Record<string, unknown>)[k]]));
    await this.dataSource.transaction(async (manager) => {
      await manager.update(Review, id, patch);
      await this.recomputeListingRating(manager, review.listingId);
      await this.recomputeSellerRating(manager, review.sellerId);
    });
    return { before, after: patch };
  }

  async adminEditCoach(id: string, dto: AdminEditReviewDto): Promise<{ before: Record<string, unknown>; after: Record<string, unknown> }> {
    const review = await this.coachReviews.findOne({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');
    if (dto.sellerReply !== undefined) throw new BadRequestException('Coach reviews have no reply');
    const patch = this.editPatch(dto, false);
    const before = Object.fromEntries(Object.keys(patch).map((k) => [k, (review as unknown as Record<string, unknown>)[k]]));
    await this.dataSource.transaction(async (manager) => {
      await manager.update(CoachingSessionReview, id, patch);
      await this.recomputeCoachRating(manager, review.coachId);
    });
    return { before, after: patch };
  }

  async adminDeleteCoach(id: string): Promise<{ coachId: string; rating: number; body: string | null }> {
    const review = await this.coachReviews.findOne({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(CoachingSessionReview, id);
      await this.recomputeCoachRating(manager, review.coachId);
    });
    return { coachId: review.coachId, rating: review.rating, body: review.body };
  }

  private editPatch(dto: AdminEditReviewDto, withReply: boolean): Record<string, unknown> {
    const patch: Record<string, unknown> = {};
    if (dto.rating !== undefined) patch.rating = dto.rating;
    if (dto.body !== undefined) patch.body = dto.body?.trim() || null;
    if (withReply && dto.sellerReply !== undefined) {
      patch.sellerReply = dto.sellerReply?.trim() || null;
      patch.sellerRepliedAt = patch.sellerReply ? new Date() : null;
    }
    if (!Object.keys(patch).length) throw new BadRequestException('Nothing to change');
    return patch;
  }

  private async recomputeCoachRating(manager: EntityManager, coachId: string): Promise<void> {
    // Same lock as CoachingSessionsService#review, so concurrent writes can't race the aggregate.
    await manager.findOne(Coach, { where: { id: coachId }, lock: { mode: 'pessimistic_write' } });
    const [row] = await manager.query(
      `SELECT AVG(rating)::numeric(3,2) AS avg, COUNT(*)::int AS count FROM coaching_session_reviews WHERE "coachId" = $1`,
      [coachId],
    );
    await manager.update(Coach, coachId, { ratingAvg: row.avg, ratingCount: row.count });
  }

  // Backs the admin `GET reviews/reported` route — the moderation queue. hide/remove/restore
  // (below) got wired to real HTTP routes in Phase 11a; this is the matching "what needs my
  // attention" list, same gap pattern as ListingsService.listPendingReview. Returns a
  // purpose-built projection, not the raw joined entity — same "don't leak full User rows into an
  // admin table" reasoning as ListingsService.listPendingReview.
  async listReported(): Promise<AdminReviewSummary[]> {
    const rows = await this.reviews.find({
      where: { status: ReviewStatus.Reported },
      relations: ['listing', 'buyer', 'seller'],
      order: { createdAt: 'ASC' },
    });
    return rows.map((row) => ({
      id: row.id,
      listingId: row.listingId,
      listingTitle: row.listing.title,
      buyerUsername: row.buyer.username,
      sellerUsername: row.seller.username,
      rating: row.rating,
      body: row.body,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  // Admin-only actions, wired to real HTTP routes on ReviewsController since Phase 11a. Both
  // recompute ratings since the aggregate only counts `Published` reviews.
  async hide(reviewId: string): Promise<Review> {
    return this.setStatusAndRecompute(reviewId, ReviewStatus.Hidden);
  }

  async remove(reviewId: string): Promise<Review> {
    return this.setStatusAndRecompute(reviewId, ReviewStatus.Deleted);
  }

  async restore(reviewId: string): Promise<Review> {
    return this.setStatusAndRecompute(reviewId, ReviewStatus.Published);
  }

  private async setStatusAndRecompute(reviewId: string, status: ReviewStatus): Promise<Review> {
    const review = await this.getReviewOrThrow(reviewId);
    return this.dataSource.transaction(async (manager) => {
      await manager.update(Review, review.id, { status });
      await this.recomputeListingRating(manager, review.listingId);
      await this.recomputeSellerRating(manager, review.sellerId);
      return { ...review, status };
    });
  }

  private async recomputeListingRating(manager: EntityManager, listingId: string): Promise<void> {
    const [row] = await manager.query(
      `SELECT AVG(rating)::numeric(3,2) AS avg, COUNT(*)::int AS count FROM reviews WHERE "listingId" = $1 AND status = $2`,
      [listingId, ReviewStatus.Published],
    );
    await manager.update(Listing, listingId, { ratingAvg: row.avg, ratingCount: row.count });
  }

  private async recomputeSellerRating(manager: EntityManager, sellerId: string): Promise<void> {
    const [row] = await manager.query(
      `SELECT AVG(rating)::numeric(3,2) AS avg, COUNT(*)::int AS count FROM reviews WHERE "sellerId" = $1 AND status = $2`,
      [sellerId, ReviewStatus.Published],
    );
    await manager.update(User, sellerId, { sellerRatingAvg: row.avg, sellerRatingCount: row.count });
  }

  private async getReviewOrThrow(reviewId: string): Promise<Review> {
    const review = await this.reviews.findOne({ where: { id: reviewId } });
    if (!review) {
      throw new NotFoundException('Review not found');
    }
    return review;
  }
}
