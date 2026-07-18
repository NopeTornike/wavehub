import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DisputeResolution, DisputeStatus, ListingStatus, ListingType, OrderStatus } from '@wavehub/shared-types';
import { DisputesService } from './disputes.service';

// Same fake-repository/fake-manager approach as reviews.service.spec.ts and
// orders.service.spec.ts.
describe('DisputesService', () => {
  const buyerId = 'buyer-1';
  const sellerId = 'seller-1';
  const orderId = 'order-1';
  const disputeId = 'dispute-1';

  function fakeManager() {
    const saved: any[] = [];
    const updates: any[] = [];
    return {
      create: jest.fn((_e: any, data: any) => ({ id: `row-${saved.length + 1}`, createdAt: new Date(), ...data })),
      save: jest.fn(async (entity: any) => {
        saved.push(entity);
        return entity;
      }),
      update: jest.fn(async (_entity: any, _id: any, data: any) => {
        updates.push(data);
      }),
      increment: jest.fn(async () => undefined),
      findOne: jest.fn(async () => null),
      _saved: saved,
      _updates: updates,
    };
  }

  function build(order: any, existingDispute: any = null) {
    const manager = fakeManager();
    const dataSource = { transaction: jest.fn(async (cb: any) => cb(manager)) } as any;
    const orders = { findOne: jest.fn(async () => order) } as any;
    const disputes = {
      findOne: jest.fn(async () => existingDispute),
    } as any;
    const messages = { find: jest.fn(async () => []), save: jest.fn(async (m: any) => m), create: jest.fn((d: any) => d) } as any;
    const evidence = { find: jest.fn(async () => []), save: jest.fn(async (e: any) => e), create: jest.fn((d: any) => d) } as any;
    const wallet = { releaseSellerEarnings: jest.fn(), refundBuyer: jest.fn() } as any;
    const storage = { save: jest.fn(async () => ({ url: 'http://x/file.png' })) } as any;
    const chat = { postSystemMessage: jest.fn() } as any;
    const notifications = { emit: jest.fn() } as any;

    const service = new DisputesService(disputes, messages, evidence, orders, dataSource, wallet, storage, chat, notifications);
    return { service, manager, disputes, messages, evidence, wallet, storage, chat, notifications };
  }

  describe('open', () => {
    it('rejects when the order does not exist', async () => {
      const { service } = build(null);
      await expect(service.open(buyerId, orderId, 'Item never arrived')).rejects.toThrow(NotFoundException);
    });

    it("rejects when the caller isn't the order's buyer or seller", async () => {
      const { service } = build({ id: orderId, buyerId, sellerId, status: OrderStatus.Paid });
      await expect(service.open('someone-else', orderId, 'Item never arrived')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rejects when the order is not in an openable status', async () => {
      const { service } = build({ id: orderId, buyerId, sellerId, status: OrderStatus.Completed });
      await expect(service.open(buyerId, orderId, 'Item never arrived')).rejects.toThrow(ForbiddenException);
    });

    it('rejects a Delivered order past the 7-day dispute window', async () => {
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      const { service } = build({
        id: orderId,
        buyerId,
        sellerId,
        status: OrderStatus.Delivered,
        deliveredAt: eightDaysAgo,
      });
      await expect(service.open(buyerId, orderId, 'Not as described')).rejects.toThrow(ForbiddenException);
    });

    it('allows a Delivered order within the 7-day window and moves the order to Disputed', async () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      const { service, manager, chat } = build({
        id: orderId,
        buyerId,
        sellerId,
        status: OrderStatus.Delivered,
        deliveredAt: twoDaysAgo,
      });

      const dispute = await service.open(buyerId, orderId, 'Not as described');

      expect(dispute.status).toBe(DisputeStatus.Open);
      expect(manager._updates).toContainEqual({ status: OrderStatus.Disputed });
      expect(chat.postSystemMessage).toHaveBeenCalled();
    });

    it('translates a DB unique-constraint violation into a clean "already exists" error', async () => {
      const order = { id: orderId, buyerId, sellerId, status: OrderStatus.Paid };
      const manager = fakeManager();
      manager.save.mockRejectedValueOnce({ code: '23505' });
      const dataSource = { transaction: jest.fn(async (cb: any) => cb(manager)) } as any;
      const orders = { findOne: jest.fn(async () => order) } as any;
      const service = new DisputesService(
        {} as any,
        {} as any,
        {} as any,
        orders,
        dataSource,
        {} as any,
        {} as any,
        { postSystemMessage: jest.fn() } as any,
        { emit: jest.fn() } as any,
      );

      await expect(service.open(buyerId, orderId, 'Item never arrived')).rejects.toThrow(
        'A dispute already exists for this order',
      );
    });
  });

  describe('addMessage / addEvidence', () => {
    it('rejects when no dispute exists for the order', async () => {
      const { service } = build(null, null);
      await expect(service.addMessage(buyerId, orderId, 'hello')).rejects.toThrow(NotFoundException);
    });

    it("rejects a message from someone who isn't a dispute participant", async () => {
      const { service } = build(null, { id: disputeId, buyerId, sellerId, createdAt: new Date() });
      await expect(service.addMessage('stranger', orderId, 'hello')).rejects.toThrow(ForbiddenException);
    });

    it('saves a message from the buyer', async () => {
      const { service, messages } = build(null, { id: disputeId, buyerId, sellerId, createdAt: new Date() });
      await service.addMessage(buyerId, orderId, 'When will this be resolved?');
      expect(messages.save).toHaveBeenCalledWith(
        expect.objectContaining({ disputeId, senderId: buyerId, body: 'When will this be resolved?' }),
      );
    });

    it('rejects evidence upload from a non-participant', async () => {
      const { service } = build(null, { id: disputeId, buyerId, sellerId, createdAt: new Date() });
      const file = { buffer: Buffer.from(''), originalname: 'a.png', mimetype: 'image/png', size: 100 };
      await expect(service.addEvidence('stranger', orderId, file)).rejects.toThrow(ForbiddenException);
    });

    it('rejects a disallowed evidence file type', async () => {
      const { service } = build(null, { id: disputeId, buyerId, sellerId, createdAt: new Date() });
      const file = { buffer: Buffer.from(''), originalname: 'a.exe', mimetype: 'application/x-msdownload', size: 100 };
      await expect(service.addEvidence(buyerId, orderId, file)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('resolve', () => {
    function buildForResolve(order: any, dispute: any) {
      const manager = fakeManager();
      const dataSource = { transaction: jest.fn(async (cb: any) => cb(manager)) } as any;
      const orders = { findOne: jest.fn(async () => order) } as any;
      const disputes = { findOne: jest.fn(async () => dispute) } as any;
      const messages = { find: jest.fn(async () => []) } as any;
      const evidence = { find: jest.fn(async () => []) } as any;
      const wallet = { releaseSellerEarnings: jest.fn(), refundBuyer: jest.fn() } as any;
      const chat = { postSystemMessage: jest.fn() } as any;
      const notifications = { emit: jest.fn() } as any;

      const service = new DisputesService(disputes, messages, evidence, orders, dataSource, wallet, {} as any, chat, notifications);
      return { service, manager, wallet, chat, notifications };
    }

    it('rejects resolving a dispute that is not found', async () => {
      const { service } = buildForResolve(null, null);
      await expect(
        service.resolve(disputeId, 'admin-1', DisputeResolution.ReleaseToSeller, 'Seller delivered as agreed'),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects resolving an already-resolved dispute', async () => {
      const { service } = buildForResolve(null, { id: disputeId, status: DisputeStatus.Resolved, orderId });
      await expect(
        service.resolve(disputeId, 'admin-1', DisputeResolution.ReleaseToSeller, 'note'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('ReleaseToSeller releases seller earnings and completes the order', async () => {
      const order = {
        id: orderId,
        buyerId,
        sellerId,
        status: OrderStatus.Disputed,
        sellerPayoutWaveCoin: 90,
        listingId: 'listing-1',
        listingType: ListingType.Service,
      };
      const dispute = { id: disputeId, orderId, status: DisputeStatus.Open, createdAt: new Date() };
      const { service, wallet } = buildForResolve(order, dispute);

      await service.resolve(disputeId, 'admin-1', DisputeResolution.ReleaseToSeller, 'Seller delivered as agreed');

      expect(wallet.releaseSellerEarnings).toHaveBeenCalledWith(sellerId, orderId, 90, undefined, expect.anything());
    });

    it('RefundBuyer refunds the buyer and sets the order to Refunded', async () => {
      const order = {
        id: orderId,
        buyerId,
        sellerId,
        status: OrderStatus.Disputed,
        priceWaveCoin: 100,
        listingId: 'listing-1',
        listingType: ListingType.Service,
      };
      const dispute = { id: disputeId, orderId, status: DisputeStatus.Open, createdAt: new Date() };
      const { service, manager, wallet } = buildForResolve(order, dispute);

      await service.resolve(disputeId, 'admin-1', DisputeResolution.RefundBuyer, 'Item not as described');

      expect(wallet.refundBuyer).toHaveBeenCalledWith(buyerId, orderId, 100, expect.anything());
      expect(manager._updates.some((u: any) => u.status === OrderStatus.Refunded)).toBe(true);
    });

    it('CancelOrder refunds the buyer, cancels the order, and restocks an item listing', async () => {
      const order = {
        id: orderId,
        buyerId,
        sellerId,
        status: OrderStatus.Disputed,
        priceWaveCoin: 50,
        listingId: 'listing-1',
        listingType: ListingType.Item,
      };
      const dispute = { id: disputeId, orderId, status: DisputeStatus.Open, createdAt: new Date() };
      const { service, manager, wallet } = buildForResolve(order, dispute);
      manager.findOne.mockResolvedValue({
        id: 'listing-1',
        stockQuantity: 0,
        status: ListingStatus.Paused,
      });

      await service.resolve(disputeId, 'admin-1', DisputeResolution.CancelOrder, 'Mutual agreement to cancel');

      expect(wallet.refundBuyer).toHaveBeenCalledWith(buyerId, orderId, 50, expect.anything());
      expect(manager._updates.some((u: any) => u.status === OrderStatus.Cancelled)).toBe(true);
      expect(manager._updates.some((u: any) => u.status === ListingStatus.Active)).toBe(true);
    });
  });
});
