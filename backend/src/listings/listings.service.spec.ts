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
    createQueryBuilder: jest.fn(),
  };
}

describe('ListingsService.createDraft', () => {
  function build() {
    const listings = createFakeRepo();
    const images = createFakeRepo();
    const serviceDetails = createFakeRepo();
    const itemDetails = createFakeRepo();
    const packages = createFakeRepo();
    const categories = createFakeRepo();
    const games = createFakeRepo();
    const storage = { save: jest.fn() };

    const service = new ListingsService(
      listings as any,
      images as any,
      serviceDetails as any,
      itemDetails as any,
      packages as any,
      categories as any,
      games as any,
      storage as any,
    );

    return { service, listings, serviceDetails, itemDetails };
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
});
