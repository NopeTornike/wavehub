import { ForbiddenException } from '@nestjs/common';
import { ListingStatus, ListingType } from '@wavehub/shared-types';
import { ListingsService } from './listings.service';

// Minimal fake repositories — enough surface for ListingsService's constructor and the methods
// under test, following the same pattern as wallet.service.spec.ts. Full CRUD/query-builder
// behavior (browseActive, ownership checks) is better covered once there's a real Postgres to test
// against in CI; this file focuses on the one thing that's pure business logic and easy to get
// wrong silently: which fields are required for which listing type.
function createFakeRepo() {
  const rows = new Map<string, any>();
  let counter = 0;
  return {
    rows,
    create: jest.fn((data: any) => ({ ...data })),
    save: jest.fn(async (entity: any) => {
      const id = entity.id ?? entity.listingId ?? `row-${++counter}`;
      const saved = { ...entity, id: entity.id ?? id };
      rows.set(id, saved);
      return saved;
    }),
    findOne: jest.fn(async ({ where }: any) => rows.get(where.id) ?? null),
    find: jest.fn(async () => Array.from(rows.values())),
    count: jest.fn(async () => rows.size),
    delete: jest.fn(async () => ({ affected: 0 })),
    increment: jest.fn(async () => undefined),
    update: jest.fn(async () => ({ affected: 0 })),
    createQueryBuilder: jest.fn(),
  };
}

describe('ListingsService.createDraft', () => {
  function build() {
    const listings = createFakeRepo();
    const images = createFakeRepo();
    const serviceDetails = createFakeRepo();
    const itemDetails = createFakeRepo();
    const keyInventory = createFakeRepo();
    const packages = createFakeRepo();
    const categories = createFakeRepo();
    const games = createFakeRepo();
    const storage = { save: jest.fn() };

    const service = new ListingsService(
      listings as any,
      images as any,
      serviceDetails as any,
      itemDetails as any,
      keyInventory as any,
      packages as any,
      categories as any,
      games as any,
      storage as any,
    );

    return { service, listings, serviceDetails, itemDetails, keyInventory };
  }

  const sellerId = 'seller-1';

  it('rejects an item listing with no priceWaveCoin', async () => {
    const { service } = build();

    await expect(
      service.createDraft(sellerId, {
        type: ListingType.Item,
        categoryId: 'cat-1',
        title: 'A valid title here',
        description: 'A'.repeat(60),
      } as any),
    ).rejects.toThrow(ForbiddenException);
  });

  it('creates an item listing + ItemDetails row when priceWaveCoin is present', async () => {
    const { service, listings, itemDetails, serviceDetails } = build();

    const listing = await service.createDraft(sellerId, {
      type: ListingType.Item,
      categoryId: 'cat-1',
      title: 'A valid title here',
      description: 'A'.repeat(60),
      priceWaveCoin: 50,
      stockQuantity: 3,
    } as any);

    expect(listing.status).toBe(ListingStatus.Draft);
    expect(listing.priceWaveCoin).toBe(50);
    expect(listing.stockQuantity).toBe(3);
    expect(itemDetails.save).toHaveBeenCalledTimes(1);
    expect(serviceDetails.save).not.toHaveBeenCalled();
    expect(listings.save).toHaveBeenCalledTimes(1);
  });

  it('creates a service listing + ServiceDetails row without requiring a price', async () => {
    const { service, itemDetails, serviceDetails } = build();

    const listing = await service.createDraft(sellerId, {
      type: ListingType.Service,
      categoryId: 'cat-1',
      title: 'A valid title here',
      description: 'A'.repeat(60),
      requirementsSchema: [{ key: 'rank', label: 'Current Rank', type: 'text', required: true }],
    } as any);

    expect(listing.status).toBe(ListingStatus.Draft);
    expect(listing.priceWaveCoin).toBeNull();
    expect(serviceDetails.save).toHaveBeenCalledTimes(1);
    expect(itemDetails.save).not.toHaveBeenCalled();
  });

  it('rejects a digital key listing with no priceWaveCoin', async () => {
    const { service } = build();

    await expect(
      service.createDraft(sellerId, {
        type: ListingType.DigitalKey,
        categoryId: 'cat-1',
        title: 'A valid title here',
        description: 'A'.repeat(60),
        resaleRightsAttested: true,
      } as any),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects a digital key listing without the resale-rights attestation', async () => {
    const { service } = build();

    await expect(
      service.createDraft(sellerId, {
        type: ListingType.DigitalKey,
        categoryId: 'cat-1',
        title: 'A valid title here',
        description: 'A'.repeat(60),
        priceWaveCoin: 100,
      } as any),
    ).rejects.toThrow(ForbiddenException);
  });

  it('creates a digital key listing with no ItemDetails/ServiceDetails row when both requirements are met', async () => {
    const { service, listings, itemDetails, serviceDetails } = build();

    const listing = await service.createDraft(sellerId, {
      type: ListingType.DigitalKey,
      categoryId: 'cat-1',
      title: 'A valid title here',
      description: 'A'.repeat(60),
      priceWaveCoin: 100,
      resaleRightsAttested: true,
    } as any);

    expect(listing.status).toBe(ListingStatus.Draft);
    expect(listing.priceWaveCoin).toBe(100);
    expect(listing.stockQuantity).toBeNull();
    expect(listing.resaleRightsAttestedAt).toBeInstanceOf(Date);
    expect(itemDetails.save).not.toHaveBeenCalled();
    expect(serviceDetails.save).not.toHaveBeenCalled();
    expect(listings.save).toHaveBeenCalledTimes(1);
  });
});

describe('ListingsService key inventory', () => {
  function build(listingOverrides: any = {}) {
    const listings = createFakeRepo();
    listings.rows.set('listing-1', {
      id: 'listing-1',
      sellerId: 'seller-1',
      type: ListingType.DigitalKey,
      ...listingOverrides,
    });
    const images = createFakeRepo();
    const serviceDetails = createFakeRepo();
    const itemDetails = createFakeRepo();
    const keyInventory = createFakeRepo();
    const packages = createFakeRepo();
    const categories = createFakeRepo();
    const games = createFakeRepo();
    const storage = { save: jest.fn() };

    const service = new ListingsService(
      listings as any,
      images as any,
      serviceDetails as any,
      itemDetails as any,
      keyInventory as any,
      packages as any,
      categories as any,
      games as any,
      storage as any,
    );

    return { service, listings, keyInventory };
  }

  const sellerId = 'seller-1';

  it('encrypts every key before saving (never stores the raw value)', async () => {
    const { service, keyInventory } = build();

    const result = await service.addKeys(sellerId, 'listing-1', ['RAW-KEY-ONE', 'RAW-KEY-TWO']);

    expect(result.added).toBe(2);
    expect(keyInventory.save).toHaveBeenCalledTimes(1);
    const savedRows = keyInventory.save.mock.calls[0][0];
    for (const row of savedRows) {
      expect(row.keyValueEncrypted).not.toContain('RAW-KEY');
    }
  });

  it('rejects adding keys to a non-digital-key listing', async () => {
    const { service } = build({ type: ListingType.Item });
    await expect(service.addKeys(sellerId, 'listing-1', ['X'])).rejects.toThrow(ForbiddenException);
  });

  it('rejects a non-owner from adding keys', async () => {
    const { service } = build({ sellerId: 'someone-else' });
    await expect(service.addKeys(sellerId, 'listing-1', ['X'])).rejects.toThrow(ForbiddenException);
  });

  it('listKeys never includes the encrypted or raw key value', async () => {
    const { service, keyInventory } = build();
    keyInventory.rows.set('key-1', {
      id: 'key-1',
      listingId: 'listing-1',
      status: 'available',
      keyValueEncrypted: 'ciphertext-should-not-leak',
      soldAt: null,
      createdAt: new Date(),
    });

    const result = await service.listKeys(sellerId, 'listing-1');

    expect(result).toHaveLength(1);
    expect(result[0]).not.toHaveProperty('keyValueEncrypted');
    expect(JSON.stringify(result)).not.toContain('ciphertext-should-not-leak');
  });

  it('removeKey only affects an available key (soft-delete via status update)', async () => {
    const { service, keyInventory } = build();
    keyInventory.update.mockResolvedValueOnce({ affected: 1 });

    await service.removeKey(sellerId, 'listing-1', 'key-1');

    expect(keyInventory.update).toHaveBeenCalledWith(
      { id: 'key-1', listingId: 'listing-1', status: 'available' },
      { status: 'revoked' },
    );
  });

  it('removeKey 404s when the key is already sold/revoked or missing', async () => {
    const { service } = build();
    await expect(service.removeKey(sellerId, 'listing-1', 'key-1')).rejects.toThrow('Available key not found');
  });
});
