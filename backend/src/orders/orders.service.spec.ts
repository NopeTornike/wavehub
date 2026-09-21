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
    const wallet = { debitForOrder: jest.fn(), lockAccount: jest.fn() } as any;
    const storage = { save: jest.fn() } as any;
    // Chat and notifications are both best-effort side channels purchase() calls after its
    // transaction resolves (see orders.service.ts) — these need to be real jest.fn()s so that path
    // doesn't throw "not a function" in tests that reach it, but no test here asserts on either
    // directly.
    const chat = { ensureConversation: jest.fn(), postSystemMessage: jest.fn() } as any;
    const notifications = { emit: jest.fn() } as any;
    const platformSettings = { getPlatformFeePercent: jest.fn(async () => 10) } as any;
    const keyInventory = { findOne: jest.fn(), count: jest.fn() } as any;

    const service = new OrdersService(
      {} as any, // orders repo — not reached before the guard clauses under test
      {} as any, // deliveryFiles repo
      fakeRepo(listings) as any,
      fakeRepo(packages) as any,
      { findOne: jest.fn(async ({ where }: any) => serviceDetails[where.listingId] ?? null) } as any,
      { findOne: jest.fn(async ({ where }: any) => itemDetails[where.listingId] ?? null) } as any,
      keyInventory,
      dataSource,
      wallet,
      storage,
      chat,
      notifications,
      platformSettings,
      { getActivePerks: jest.fn(async () => null), getActivePerksForUsers: jest.fn(async () => new Map()), effectiveFeePercent: jest.fn(async (_id: string, base: number) => base) } as any,
    );

    return { service, dataSource, wallet, chat, notifications, platformSettings, keyInventory };
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

  it('locks the buyer account before any insert, and retries the whole transaction on a deadlock (40P01)', async () => {
    const { service, dataSource, wallet } = build({
      'listing-1': { id: 'listing-1', sellerId, status: ListingStatus.Active, type: ListingType.Item, priceWaveCoin: 15, stockQuantity: 3 },
    });
    const calls: string[] = [];
    const manager = {
      query: jest.fn().mockResolvedValue([{ n: '123' }]),
      create: jest.fn((_entity: any, data: any) => data),
      save: jest.fn(async (row: any) => {
        calls.push('insert');
        return { ...row, id: 'order-1' };
      }),
      decrement: jest.fn(),
      update: jest.fn(),
    };
    wallet.lockAccount.mockImplementation(async () => {
      calls.push('lock');
    });
    let attempt = 0;
    dataSource.transaction.mockImplementation(async (fn: any) => {
      attempt++;
      const result = await fn(manager);
      if (attempt === 1) {
        throw Object.assign(new Error('deadlock detected'), { driverError: { code: '40P01' } });
      }
      return result;
    });

    const order = await service.purchase(buyerId, { listingId: 'listing-1' } as any);
    expect(order.id).toBe('order-1');
    expect(dataSource.transaction).toHaveBeenCalledTimes(2);
    expect(wallet.debitForOrder).toHaveBeenCalledTimes(2);
    // Every attempt locks the account first, before inserting the order.
    expect(calls).toEqual(['lock', 'insert', 'lock', 'insert']);
  });

  it('does not retry an INSUFFICIENT_BALANCE failure', async () => {
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
    await expect(service.purchase(buyerId, { listingId: 'listing-1' } as any)).rejects.toThrow(ForbiddenException);
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
  });

  it('rejects a digital key purchase with no price set', async () => {
    const { service } = build({
      'listing-1': { id: 'listing-1', sellerId, status: ListingStatus.Active, type: ListingType.DigitalKey, priceWaveCoin: null },
    });
    await expect(service.purchase(buyerId, { listingId: 'listing-1' } as any)).rejects.toThrow(ForbiddenException);
  });

  // `manager.createQueryBuilder()` is mocked directly (not `manager.query()`) — see the comment on
  // the `execute()`-based claim in orders.service.ts for why: a first version of this code parsed
  // `manager.query()`'s raw return value by hand and got the shape wrong (verified for real against
  // a live Postgres instance, not caught by any unit test with a fake repository — see
  // backend/src/orders/CLAUDE.md), so these tests are written against the same stable
  // `UpdateResult.affected` contract the real fix now uses, not a raw-driver-shaped mock.
  function fakeClaimQueryBuilder(affected: number) {
    const qb: any = {
      update: jest.fn(() => qb),
      set: jest.fn(() => qb),
      where: jest.fn(() => qb),
      execute: jest.fn(async () => ({ affected })),
    };
    return qb;
  }

  it('rejects a digital key purchase when the atomic claim affects zero rows (out of stock)', async () => {
    const { service, dataSource, wallet } = build({
      'listing-1': { id: 'listing-1', sellerId, status: ListingStatus.Active, type: ListingType.DigitalKey, priceWaveCoin: 25 },
    });
    const claimQb = fakeClaimQueryBuilder(0);
    const manager = {
      query: jest.fn().mockResolvedValueOnce([{ n: '123' }]), // generateOrderNumber's nextval query
      create: jest.fn((_entity: any, data: any) => data),
      save: jest.fn(async (row: any) => ({ ...row, id: 'order-1' })),
      count: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(() => claimQb),
    };
    dataSource.transaction.mockImplementation((fn: any) => fn(manager));

    await expect(service.purchase(buyerId, { listingId: 'listing-1' } as any)).rejects.toThrow(ForbiddenException);
    // Must fail before ever attempting to debit the buyer's balance.
    expect(wallet.debitForOrder).not.toHaveBeenCalled();
  });

  it('claims a key, debits the buyer, and does not pause the listing when keys remain', async () => {
    const { service, dataSource, wallet } = build({
      'listing-1': { id: 'listing-1', sellerId, status: ListingStatus.Active, type: ListingType.DigitalKey, priceWaveCoin: 25 },
    });
    const claimQb = fakeClaimQueryBuilder(1);
    const manager = {
      query: jest.fn().mockResolvedValueOnce([{ n: '123' }]),
      create: jest.fn((_entity: any, data: any) => data),
      save: jest.fn(async (row: any) => ({ ...row, id: 'order-1' })),
      count: jest.fn().mockResolvedValue(2), // keys still available after this claim
      update: jest.fn(),
      createQueryBuilder: jest.fn(() => claimQb),
    };
    dataSource.transaction.mockImplementation((fn: any) => fn(manager));

    const result = await service.purchase(buyerId, { listingId: 'listing-1' } as any);

    expect(wallet.debitForOrder).toHaveBeenCalledWith(buyerId, 'order-1', 25, manager);
    expect(manager.update).not.toHaveBeenCalled();
    expect(result).toMatchObject({ id: 'order-1', priceWaveCoin: 25 });
  });

  it('pauses the listing once the last available key is claimed', async () => {
    const { service, dataSource } = build({
      'listing-1': { id: 'listing-1', sellerId, status: ListingStatus.Active, type: ListingType.DigitalKey, priceWaveCoin: 25 },
    });
    const claimQb = fakeClaimQueryBuilder(1);
    const manager = {
      query: jest.fn().mockResolvedValueOnce([{ n: '123' }]),
      create: jest.fn((_entity: any, data: any) => data),
      save: jest.fn(async (row: any) => ({ ...row, id: 'order-1' })),
      count: jest.fn().mockResolvedValue(0), // no keys left after this claim
      update: jest.fn(),
      createQueryBuilder: jest.fn(() => claimQb),
    };
    dataSource.transaction.mockImplementation((fn: any) => fn(manager));

    await service.purchase(buyerId, { listingId: 'listing-1' } as any);

    expect(manager.update).toHaveBeenCalledWith(expect.anything(), 'listing-1', { status: ListingStatus.Paused });
  });
});

describe('OrdersService cancellation guards for DigitalKey orders', () => {
  const buyerId = 'buyer-1';
  const sellerId = 'seller-1';

  function build(order: any) {
    const orders = { findOne: jest.fn(async () => order) } as any;
    const dataSource = { transaction: jest.fn() } as any;
    const wallet = { refundBuyer: jest.fn() } as any;
    const service = new OrdersService(
      orders,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      dataSource,
      wallet,
      {} as any,
      { postSystemMessage: jest.fn() } as any,
      { emit: jest.fn() } as any,
      {} as any,
      {} as any,
    );
    return { service };
  }

  it('refuses a buyer cancelling a digital key order', async () => {
    const { service } = build({ id: 'order-1', buyerId, sellerId, status: 'paid', listingType: ListingType.DigitalKey });
    await expect(service.cancelByBuyer(buyerId, 'order-1')).rejects.toThrow(ForbiddenException);
  });

  it('refuses a seller cancelling a digital key order', async () => {
    const { service } = build({ id: 'order-1', buyerId, sellerId, status: 'paid', listingType: ListingType.DigitalKey });
    await expect(service.cancelBySeller(sellerId, 'order-1', 'changed my mind')).rejects.toThrow(ForbiddenException);
  });
});

describe('OrdersService.getRevealedKey', () => {
  const buyerId = 'buyer-1';
  const sellerId = 'seller-1';

  function build(order: any, keyRow: any) {
    const orders = { findOne: jest.fn(async () => order) } as any;
    const keyInventory = { findOne: jest.fn(async () => keyRow) } as any;
    const service = new OrdersService(
      orders,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      keyInventory,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    return { service, keyInventory };
  }

  it('rejects a non-DigitalKey order', async () => {
    const { service } = build({ id: 'order-1', buyerId, sellerId, status: 'paid', listingType: ListingType.Item }, null);
    await expect(service.getRevealedKey(buyerId, 'order-1')).rejects.toThrow(ForbiddenException);
  });

  it('rejects a non-buyer', async () => {
    const { service } = build({ id: 'order-1', buyerId, sellerId, status: 'paid', listingType: ListingType.DigitalKey }, null);
    await expect(service.getRevealedKey('someone-else', 'order-1')).rejects.toThrow(ForbiddenException);
  });

  it('rejects a cancelled/refunded order even if a stray sold row somehow exists', async () => {
    const { service } = build(
      { id: 'order-1', buyerId, sellerId, status: 'cancelled', listingType: ListingType.DigitalKey },
      { keyValueEncrypted: 'irrelevant' },
    );
    await expect(service.getRevealedKey(buyerId, 'order-1')).rejects.toThrow(ForbiddenException);
  });

  it('returns the decrypted key for a paid order', async () => {
    const { encryptKeyValue } = await import('../listings/key-encryption.util');
    const { service } = build(
      { id: 'order-1', buyerId, sellerId, status: 'paid', listingType: ListingType.DigitalKey },
      { keyValueEncrypted: encryptKeyValue('REAL-STEAM-KEY-123') },
    );
    const result = await service.getRevealedKey(buyerId, 'order-1');
    expect(result).toEqual({ key: 'REAL-STEAM-KEY-123' });
  });
});
