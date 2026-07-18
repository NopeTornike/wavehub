import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrderStatus, ReviewStatus } from '@wavehub/shared-types';
import { ReviewsService } from './reviews.service';

// Same fake-repository/fake-manager approach as wallet.service.spec.ts and
// listings.service.spec.ts. The transactional rating-recompute path uses raw `manager.query()`
// (AVG/COUNT SQL) rather than repository methods, so the fake manager here stubs `.query()` to
// return a fixed aggregate rather than actually computing one — this test file is about the
// business-rule guard clauses (ownership, order status, duplicate reviews, reply-once), not about
// proving Postgres can average numbers.
describe('ReviewsService', () => {
  const buyerId = 'buyer-1';
  const sellerId = 'seller-1';
  const orderId = 'order-1';

  function fakeManager() {
    const saved: any[] = [];
    return {
      create: jest.fn((_e: any, data: any) => ({ ...data })),
      save: jest.fn(async (entity: any) => {
        const row = { id: entity.id ?? `review-${saved.length + 1}`, ...entity };
        saved.push(row);
        return row;
      }),
      update: jest.fn(async () => undefined),
      query: jest.fn(async () => [{ avg: '4.60', count: 5 }]),
      _saved: saved,
    };
  }

  function build(order: any, existingReview: any = null) {
    const manager = fakeManager();
    const dataSource = { transaction: jest.fn(async (cb: any) => cb(manager)) } as any;
    const orders = { findOne: jest.fn(async () => order) } as any;
    const reviews = { findOne: jest.fn(async () => existingReview), save: jest.fn(async (r: any) => r), update: jest.fn() } as any;
    const reports = { create: jest.fn((d: any) => d), save: jest.fn(async (r: any) => r) } as any;
    const notifications = { emit: jest.fn() } as any;

    const service = new ReviewsService(reviews, reports, orders, dataSource, notifications);
    return { service, manager, reviews, reports, notifications };
  }

  describe('create', () => {
    it('rejects when the order does not exist', async () => {
      const { service } = build(null);
      await expect(
        service.create(buyerId, { orderId, rating: 5 } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it("rejects when the order isn't the caller's", async () => {
      const { service } = build({ id: orderId, buyerId: 'someone-else', status: OrderStatus.Completed });
      await expect(
        service.create(buyerId, { orderId, rating: 5 } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects when the order is not Completed', async () => {
      const { service } = build({ id: orderId, buyerId, status: OrderStatus.InProgress });
      await expect(
        service.create(buyerId, { orderId, rating: 5 } as any),
      ).rejects.toThrow('You can only review a completed order');
    });

    it('creates a review and recomputes both listing and seller ratings', async () => {
      const { service, manager } = build({
        id: orderId,
        buyerId,
        sellerId,
        listingId: 'listing-1',
        status: OrderStatus.Completed,
      });

      const review = await service.create(buyerId, { orderId, rating: 5, body: 'Great work!' } as any);

      expect(review.rating).toBe(5);
      expect(review.sellerId).toBe(sellerId);
      // one query() call to recompute the listing rating, one for the seller rating
      expect(manager.query).toHaveBeenCalledTimes(2);
    });

    it('translates a DB unique-constraint violation into a clean "already reviewed" error', async () => {
      const order = { id: orderId, buyerId, sellerId, listingId: 'listing-1', status: OrderStatus.Completed };
      const manager = fakeManager();
      manager.save.mockRejectedValueOnce({ code: '23505' });
      const dataSource = { transaction: jest.fn(async (cb: any) => cb(manager)) } as any;
      const orders = { findOne: jest.fn(async () => order) } as any;
      const service = new ReviewsService({} as any, {} as any, orders, dataSource, { emit: jest.fn() } as any);

      await expect(
        service.create(buyerId, { orderId, rating: 5 } as any),
      ).rejects.toThrow('You already reviewed this order');
    });
  });

  describe('reply', () => {
    it("rejects a reply from someone who isn't the review's seller", async () => {
      const { service } = build(null, { id: 'review-1', sellerId, sellerReply: null });
      await expect(service.reply('not-the-seller', 'review-1', 'Thanks!')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rejects a second reply to the same review', async () => {
      const { service } = build(null, { id: 'review-1', sellerId, sellerReply: 'Already replied once' });
      await expect(service.reply(sellerId, 'review-1', 'Again?')).rejects.toThrow(
        'You already replied to this review',
      );
    });

    it('accepts the seller\'s first reply', async () => {
      const { service, reviews } = build(null, { id: 'review-1', sellerId, sellerReply: null });
      const result = await service.reply(sellerId, 'review-1', 'Thanks for the order!');
      expect(result.sellerReply).toBe('Thanks for the order!');
      expect(result.sellerRepliedAt).toBeInstanceOf(Date);
      expect(reviews.save).toHaveBeenCalled();
    });
  });

  describe('report', () => {
    it('creates a report and moves the review to Reported status', async () => {
      const { service, reviews, reports } = build(null, { id: 'review-1', sellerId });
      await service.report('reporter-1', 'review-1', 'spam');
      expect(reports.save).toHaveBeenCalled();
      expect(reviews.update).toHaveBeenCalledWith('review-1', { status: ReviewStatus.Reported });
    });
  });
});
