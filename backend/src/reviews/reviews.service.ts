import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { NotificationType, OrderStatus, ReviewStatus } from '@wavehub/shared-types';
import type { AdminReviewSummary } from '@wavehub/shared-types';
import { Review } from './review.entity';
import { ReviewReport } from './review-report.entity';
import { Order } from '../orders/order.entity';
import { Listing } from '../listings/listing.entity';
import { User } from '../users/user.entity';
import { CreateReviewDto } from './dto/create-review.dto';
import { NotificationsService } from '../notifications/notifications.service';

const POSTGRES_UNIQUE_VIOLATION = '23505';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    @InjectRepository(Review) private readonly reviews: Repository<Review>,
    @InjectRepository(ReviewReport) private readonly reports: Repository<ReviewReport>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
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
    await this.reviews.update(review.id, { status: ReviewStatus.Reported });
    return saved;
  }

  async findForListing(listingId: string, sort: 'newest' | 'highest' | 'lowest' = 'newest'): Promise<Review[]> {
    const qb = this.reviews
      .createQueryBuilder('review')
      .where('review.listingId = :listingId', { listingId })
      .andWhere('review.status = :status', { status: ReviewStatus.Published });

    if (sort === 'highest') {
      qb.orderBy('review.rating', 'DESC').addOrderBy('review.createdAt', 'DESC');
    } else if (sort === 'lowest') {
      qb.orderBy('review.rating', 'ASC').addOrderBy('review.createdAt', 'DESC');
    } else {
      qb.orderBy('review.createdAt', 'DESC');
    }

    return qb.getMany();
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
