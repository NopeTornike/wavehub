import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { BadRequestException } from '@nestjs/common';
import { ListingStatus, ListingType } from '@wavehub/shared-types';
import { OrdersService } from './orders.service';

// Fake repositories following the same pattern as listings.service.spec.ts — enough surface for
// the constructor plus the pre-transaction validation guard clauses in `purchase()`, which is
// where most of the real business-rule bugs would hide (wrong listing type accepted, missing price
// slipping through, buyer able to purchase their own listing). The transactional happy path (order
// creation + wallet debit actually succeeding together) is better covered once there's a real
// Postgres in CI to test against — see orders/CLAUDE.md.
function fakeRepo(rows: Record<string, any> = {}) {
  return {
    findOne: jest.fn(async ({ where }: any) => {
      const row = where.id ? rows[where.id] : undefined;
      if (!row) return null;
      if (where.status && row.status !== where.status) return null;
      if (where.listingId && row.listingId !== where.listingId) return null;
      return row;
    }),
  };
}

describe('OrdersService.purchase (validation guard clauses)', () => {
  const buyerId = 'buyer-1';
  const sellerId = 'seller-1';

  function build(listings: Record<string, any>, packages: Record<string, any> = {}, serviceDetails: Record<string, any> = {}, itemDetails: Record<string, any> = {}) {
    const dataSource = { transaction: jest.fn() } as any;
    const wallet = { debitForOrder: jest.fn() } as any;
    const storage = { save: jest.fn() } as any;
    // Chat and notifications are both best-effort side channels purchase() calls after its
    // transaction resolves (see orders.service.ts) — these need to be real jest.fn()s so that path
    // doesn't throw "not a function" in tests that reach it, but no test here asserts on either
    // directly.
    const chat = { ensureConversation: jest.fn(), postSystemMessage: jest.fn() } as any;
    const notifications = { emit: jest.fn() } as any;
    const platformSettings = { getPlatformFeePercent: jest.fn(async () => 10) } as any;

    const service = new OrdersService(
      {} as any, // orders repo — not reached before the guard clauses under test
      {} as any, // deliveryFiles repo
      fakeRepo(listings) as any,
      fakeRepo(packages) as any,
      { findOne: jest.fn(async ({ where }: any) => serviceDetails[where.listingId] ?? null) } as any,
      { findOne: jest.fn(async ({ where }: any) => itemDetails[where.listingId] ?? null) } as any,
      dataSource,
      wallet,
      storage,
      chat,
      notifications,
      platformSettings,
    );

    return { service, dataSource, wallet, chat, notifications, platformSettings };
  }

  it('rejects a listing that does not exist or is not Active', async () => {
    const { service } = build({});
    await expect(service.purchase(buyerId, { listingId: 'nope' } as any)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('rejects a seller buying their own listing', async () => {
    const { service } = build({
      'listing-1': { id: 'listing-1', sellerId: buyerId, status: ListingStatus.Active, type: ListingType.Item, priceWaveCoin: 10 },
    });
    await expect(
      service.purchase(buyerId, { listingId: 'listing-1' } as any),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects a service purchase with no packageId', async () => {
    const { service } = build({
      'listing-1': { id: 'listing-1', sellerId, status: ListingStatus.Active, type: ListingType.Service },
    });
    await expect(
      service.purchase(buyerId, { listingId: 'listing-1' } as any),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects a service purchase with a packageId that does not belong to the listing', async () => {
    const { service } = build(
      { 'listing-1': { id: 'listing-1', sellerId, status: ListingStatus.Active, type: ListingType.Service } },
      { 'pkg-1': { id: 'pkg-1', listingId: 'OTHER_LISTING' } },
    );
    await expect(
      service.purchase(buyerId, { listingId: 'listing-1', packageId: 'pkg-1' } as any),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects a service purchase missing a required requirements-form field', async () => {
    const { service } = build(
      { 'listing-1': { id: 'listing-1', sellerId, status: ListingStatus.Active, type: ListingType.Service } },
      { 'pkg-1': { id: 'pkg-1', listingId: 'listing-1', priceWaveCoin: 20, deliveryTimeDays: 3 } },
      { 'listing-1': { listingId: 'listing-1', requirementsSchema: [{ key: 'rank', label: 'Rank', type: 'text', required: true }] } },
    );
    await expect(
      service.purchase(buyerId, { listingId: 'listing-1', packageId: 'pkg-1', requirementsAnswers: {} } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects an item purchase with no price set', async () => {
    const { service } = build({
      'listing-1': { id: 'listing-1', sellerId, status: ListingStatus.Active, type: ListingType.Item, priceWaveCoin: null },
    });
    await expect(
      service.purchase(buyerId, { listingId: 'listing-1' } as any),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects an out-of-stock item purchase', async () => {
    const { service } = build({
      'listing-1': { id: 'listing-1', sellerId, status: ListingStatus.Active, type: ListingType.Item, priceWaveCoin: 15, stockQuantity: 0 },
    });
    await expect(
      service.purchase(buyerId, { listingId: 'listing-1' } as any),
    ).rejects.toThrow(ForbiddenException);
  });

  it('proceeds to the transaction for a valid item purchase', async () => {
    const { service, dataSource } = build({
      'listing-1': { id: 'listing-1', sellerId, status: ListingStatus.Active, type: ListingType.Item, priceWaveCoin: 15, stockQuantity: 3 },
    });
    dataSource.transaction.mockResolvedValue({ id: 'order-1' });

    const result = await service.purchase(buyerId, { listingId: 'listing-1' } as any);

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ id: 'order-1' });
  });

  it('translates WalletService.debitForOrder INSUFFICIENT_BALANCE into a clean ForbiddenException', async () => {
    const { service, dataSource, wallet } = build({
      'listing-1': { id: 'listing-1', sellerId, status: ListingStatus.Active, type: ListingType.Item, priceWaveCoin: 15, stockQuantity: 3 },
    });
    const manager = {
      query: jest.fn().mockResolvedValue([{ n: '123' }]),
      create: jest.fn((_entity: any, data: any) => data),
      save: jest.fn(async (row: any) => ({ ...row, id: 'order-1' })),
    };
    dataSource.transaction.mockImplementation((fn: any) => fn(manager));
    wallet.debitForOrder.mockRejectedValue(new Error('INSUFFICIENT_BALANCE'));

    await expect(
      service.purchase(buyerId, { listingId: 'listing-1' } as any),
    ).rejects.toThrow(ForbiddenException);
  });
});
