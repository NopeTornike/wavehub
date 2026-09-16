import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KeyInventoryStatus, ListingStatus, ListingType } from '@wavehub/shared-types';
import type { AdminListingSummary, SellerListingKeySummary } from '@wavehub/shared-types';
import { Listing } from './listing.entity';
import { ListingImage } from './listing-image.entity';
import { ServiceDetails } from './service-details.entity';
import { ItemDetails } from './item-details.entity';
import { ListingKeyInventory } from './listing-key-inventory.entity';
import { Package } from './package.entity';
import { Category } from './category.entity';
import { Game } from './game.entity';
import { assertValidTransition } from './listing-lifecycle';
import { CreateListingDto } from './dto/create-listing.dto';
import { CreatePackageDto } from './dto/create-package.dto';
import { BrowseListingsDto } from './dto/browse-listings.dto';
import { StorageService } from '../storage/storage.service';
import { encryptKeyValue } from './key-encryption.util';

const MAX_IMAGES_PER_LISTING = 5;
const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

@Injectable()
export class ListingsService {
  constructor(
    @InjectRepository(Listing) private readonly listings: Repository<Listing>,
    @InjectRepository(ListingImage) private readonly images: Repository<ListingImage>,
    @InjectRepository(ServiceDetails) private readonly serviceDetails: Repository<ServiceDetails>,
    @InjectRepository(ItemDetails) private readonly itemDetails: Repository<ItemDetails>,
    @InjectRepository(ListingKeyInventory) private readonly keyInventory: Repository<ListingKeyInventory>,
    @InjectRepository(Package) private readonly packages: Repository<Package>,
    @InjectRepository(Category) private readonly categories: Repository<Category>,
    @InjectRepository(Game) private readonly games: Repository<Game>,
    private readonly storage: StorageService,
  ) {}

  listCategories() {
    return this.categories.find({ where: { isActive: true }, order: { sortOrder: 'ASC' } });
  }

  listGames() {
    return this.games.find({ where: { isActive: true }, order: { sortOrder: 'ASC' } });
  }

  async createDraft(sellerId: string, dto: CreateListingDto): Promise<Listing> {
    if ((dto.type === ListingType.Item || dto.type === ListingType.DigitalKey) && !dto.priceWaveCoin) {
      throw new ForbiddenException(
        `${dto.type === ListingType.Item ? 'Item' : 'Digital key'} listings require priceWaveCoin`,
      );
    }
    if (dto.type === ListingType.DigitalKey && dto.resaleRightsAttested !== true) {
      throw new ForbiddenException('You must confirm you have the legal right to resell these keys');
    }

    const listing = this.listings.create({
      sellerId,
      categoryId: dto.categoryId,
      gameId: dto.gameId ?? null,
      type: dto.type,
      title: dto.title,
      description: dto.description,
      status: ListingStatus.Draft,
      priceWaveCoin: dto.type === ListingType.Item || dto.type === ListingType.DigitalKey ? dto.priceWaveCoin! : null,
      // DigitalKey stock is derived from listing_key_inventory row counts, never stored here.
      stockQuantity: dto.type === ListingType.Item ? dto.stockQuantity ?? 1 : null,
      resaleRightsAttestedAt: dto.type === ListingType.DigitalKey ? new Date() : null,
    });
    const saved = await this.listings.save(listing);

    if (dto.type === ListingType.Service) {
      await this.serviceDetails.save(
        this.serviceDetails.create({
          listingId: saved.id,
          requirementsSchema: dto.requirementsSchema ?? [],
          faq: [],
        }),
      );
    } else if (dto.type === ListingType.Item) {
      await this.itemDetails.save(
        this.itemDetails.create({
          listingId: saved.id,
          attributes: {},
          isUnique: dto.isUnique ?? true,
        }),
      );
    }
    // DigitalKey: no 1:1 details row — see listing-key-inventory.entity.ts instead.

    return saved;
  }

  async findMine(sellerId: string): Promise<Listing[]> {
    return this.listings.find({ where: { sellerId }, order: { createdAt: 'DESC' } });
  }

  // Backs the public seller-profile page (backend/src/users/users.controller.ts) — only counts
  // what's actually visible to a public visitor, same as browseActive's own status filter.
  countActiveBySeller(sellerId: string): Promise<number> {
    return this.listings.count({ where: { sellerId, status: ListingStatus.Active } });
  }

  // Backs the admin `GET listings/pending-review` route — the "what needs my approval" queue.
  // Returns a purpose-built projection (AdminListingSummary), not the raw joined entity — a bare
  // Listing.seller relation would carry the seller's full User row (email, wavecoinBalance, etc.)
  // into an approval-queue table that has no reason to see it. approve/reject already existed
  // (Phase 11a) but had nothing that could actually list the ids to act on.
  async listPendingReview(): Promise<AdminListingSummary[]> {
    const rows = await this.listings.find({
      where: { status: ListingStatus.PendingReview },
      relations: ['seller', 'category', 'game'],
      order: { createdAt: 'ASC' },
    });
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      type: row.type,
      sellerId: row.sellerId,
      sellerUsername: row.seller.username,
      categoryName: row.category.name,
      gameName: row.game?.name ?? null,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  // Public browse — only ever returns Active listings. A listing's owner viewing their own
  // draft/pending/paused/rejected listings must use findMine, not this.
  //
  // Joins seller/category/game/images so the caller (the frontend marketplace grid) has enough to
  // render a card without N+1 follow-up requests — a bare Listing only has FK ids, not names. Full
  // package rows aren't joined (that's a detail-page concern, see findPublicById), but a
  // `startingPriceWaveCoin` (item's own price, or a service listing's cheapest package) is computed
  // in one batched follow-up query so cards can always show a price.
  async browseActive(
    filters: BrowseListingsDto,
  ): Promise<{ items: Array<Listing & { startingPriceWaveCoin: number | null }>; total: number }> {
    const qb = this.listings
      .createQueryBuilder('listing')
      .leftJoinAndSelect('listing.seller', 'seller')
      .leftJoinAndSelect('listing.category', 'category')
      .leftJoinAndSelect('listing.game', 'game')
      .leftJoinAndSelect('listing.images', 'images')
      .where('listing.status = :status', { status: ListingStatus.Active });

    if (filters.categoryId) {
      qb.andWhere('listing.categoryId = :categoryId', { categoryId: filters.categoryId });
    }
    if (filters.gameId) {
      qb.andWhere('listing.gameId = :gameId', { gameId: filters.gameId });
    }
    if (filters.type) {
      qb.andWhere('listing.type = :type', { type: filters.type });
    }

    const [items, total] = await qb
      .orderBy('listing.isFeatured', 'DESC')
      .addOrderBy('listing.createdAt', 'DESC')
      .take(filters.limit ?? 20)
      .skip(filters.offset ?? 0)
      .getManyAndCount();

    const serviceListingIds = items.filter((item) => item.type === ListingType.Service).map((i) => i.id);
    const minPriceByListing = new Map<string, number>();
    if (serviceListingIds.length > 0) {
      const rows: Array<{ listingId: string; min: string }> = await this.packages
        .createQueryBuilder('pkg')
        .select('pkg.listingId', 'listingId')
        .addSelect('MIN(pkg.priceWaveCoin)', 'min')
        .where('pkg.listingId IN (:...ids)', { ids: serviceListingIds })
        .groupBy('pkg.listingId')
        .getRawMany();
      rows.forEach((row) => minPriceByListing.set(row.listingId, Number(row.min)));
    }

    // DigitalKey "stock" isn't a stored column (see listing.entity.ts) — it's a live count of
    // `available` rows, batched the same way startingPriceWaveCoin is above (one extra query per
    // page, not per listing).
    const digitalKeyListingIds = items.filter((item) => item.type === ListingType.DigitalKey).map((i) => i.id);
    const availableCountByListing = new Map<string, number>();
    if (digitalKeyListingIds.length > 0) {
      const rows: Array<{ listingId: string; count: string }> = await this.keyInventory
        .createQueryBuilder('k')
        .select('k.listingId', 'listingId')
        .addSelect('COUNT(*)', 'count')
        .where('k.listingId IN (:...ids)', { ids: digitalKeyListingIds })
        .andWhere('k.status = :status', { status: KeyInventoryStatus.Available })
        .groupBy('k.listingId')
        .getRawMany();
      rows.forEach((row) => availableCountByListing.set(row.listingId, Number(row.count)));
    }

    const withStartingPrice = items.map((item) => ({
      ...item,
      stockQuantity: item.type === ListingType.DigitalKey ? availableCountByListing.get(item.id) ?? 0 : item.stockQuantity,
      startingPriceWaveCoin:
        item.type === ListingType.Item || item.type === ListingType.DigitalKey
          ? item.priceWaveCoin
          : minPriceByListing.get(item.id) ?? null,
    }));

    return { items: withStartingPrice, total };
  }

  // Public detail lookup — 404s on anything not Active (a draft/pending listing isn't "not found"
  // in the DB sense, but it must behave as not found to an unauthenticated/non-owner caller).
  // Increments viewsCount as a side effect, best-effort (not awaited as part of the critical path).
  //
  // Returns more than a bare `Listing`: packages (sorted) and the type-specific requirements/FAQ/
  // item-attributes are fetched separately (they don't join cleanly via `relations` because of the
  // sort-order and type-branching) and attached to the response. There's no shared response DTO for
  // this shape yet — see packages/shared-types/CLAUDE.md if that becomes worth formalizing.
  async findPublicById(id: string) {
    const listing = await this.listings.findOne({
      where: { id, status: ListingStatus.Active },
      relations: ['seller', 'category', 'game', 'images'],
    });
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }
    void this.listings.increment({ id }, 'viewsCount', 1);

    if (listing.type === ListingType.Service) {
      const [packages, details] = await Promise.all([
        this.packages.find({ where: { listingId: id }, order: { sortOrder: 'ASC' } }),
        this.serviceDetails.findOne({ where: { listingId: id } }),
      ]);
      return {
        ...listing,
        packages,
        requirementsSchema: details?.requirementsSchema ?? [],
        faq: details?.faq ?? [],
      };
    }

    if (listing.type === ListingType.DigitalKey) {
      const availableCount = await this.keyInventory.count({
        where: { listingId: id, status: KeyInventoryStatus.Available },
      });
      return { ...listing, packages: [], stockQuantity: availableCount };
    }

    const itemDetails = await this.itemDetails.findOne({ where: { listingId: id } });
    return { ...listing, packages: [], itemAttributes: itemDetails?.attributes ?? {} };
  }

  async addPackage(sellerId: string, listingId: string, dto: CreatePackageDto): Promise<Package> {
    const listing = await this.getOwnedListing(sellerId, listingId);
    if (listing.type !== ListingType.Service) {
      throw new ForbiddenException('Only service listings have packages');
    }

    const pkg = this.packages.create({
      listingId,
      name: dto.name,
      priceWaveCoin: dto.priceWaveCoin,
      deliveryTimeDays: dto.deliveryTimeDays,
      features: dto.features ?? [],
      revisionsIncluded: dto.revisionsIncluded ?? 0,
    });
    return this.packages.save(pkg);
  }

  async removePackage(sellerId: string, listingId: string, packageId: string): Promise<void> {
    await this.getOwnedListing(sellerId, listingId);
    const result = await this.packages.delete({ id: packageId, listingId });
    if (!result.affected) {
      throw new NotFoundException('Package not found');
    }
  }

  async addImage(
    sellerId: string,
    listingId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
  ): Promise<ListingImage> {
    await this.getOwnedListing(sellerId, listingId);

    if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype)) {
      throw new ForbiddenException('Only JPG, PNG, or WEBP images are allowed');
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new ForbiddenException('Image exceeds the 5MB size limit');
    }

    const existingCount = await this.images.count({ where: { listingId } });
    if (existingCount >= MAX_IMAGES_PER_LISTING) {
      throw new ForbiddenException(`A listing can have at most ${MAX_IMAGES_PER_LISTING} images`);
    }

    const stored = await this.storage.save(file.buffer, file.originalname);
    const image = this.images.create({ listingId, url: stored.url, sortOrder: existingCount });
    return this.images.save(image);
  }

  async submitForReview(sellerId: string, listingId: string): Promise<Listing> {
    const listing = await this.getOwnedListing(sellerId, listingId);
    assertValidTransition(listing.status, ListingStatus.PendingReview);
    listing.status = ListingStatus.PendingReview;
    listing.rejectionReason = null;
    return this.listings.save(listing);
  }

  async pause(sellerId: string, listingId: string): Promise<Listing> {
    const listing = await this.getOwnedListing(sellerId, listingId);
    assertValidTransition(listing.status, ListingStatus.Paused);
    listing.status = ListingStatus.Paused;
    return this.listings.save(listing);
  }

  async unpause(sellerId: string, listingId: string): Promise<Listing> {
    const listing = await this.getOwnedListing(sellerId, listingId);
    assertValidTransition(listing.status, ListingStatus.Active);
    listing.status = ListingStatus.Active;
    return this.listings.save(listing);
  }

  // Admin-only actions per the build plan — not wired to any HTTP route yet (Phase 11 adds the
  // guarded admin controller that calls these). Implemented now so Phase 11 doesn't need to design
  // the state machine from scratch, matching how backend/src/wallet/wallet.service.ts's primitives
  // were built ahead of Orders.
  async approve(listingId: string): Promise<Listing> {
    const listing = await this.getListingOrThrow(listingId);
    assertValidTransition(listing.status, ListingStatus.Active);
    listing.status = ListingStatus.Active;
    listing.rejectionReason = null;
    return this.listings.save(listing);
  }

  async reject(listingId: string, reason: string): Promise<Listing> {
    const listing = await this.getListingOrThrow(listingId);
    assertValidTransition(listing.status, ListingStatus.Rejected);
    listing.status = ListingStatus.Rejected;
    listing.rejectionReason = reason;
    return this.listings.save(listing);
  }

  // Bulk "paste a list of keys" upload — a seller realistically has dozens/hundreds per title (see
  // LAUNCH_PLAN.md §2d). Each raw key is encrypted before it ever touches a `save()` call; nothing
  // in this method (or its caller) ever logs or returns a raw value back.
  async addKeys(sellerId: string, listingId: string, rawKeys: string[]): Promise<{ added: number }> {
    const listing = await this.getOwnedListing(sellerId, listingId);
    if (listing.type !== ListingType.DigitalKey) {
      throw new ForbiddenException('Only digital key listings accept key inventory');
    }
    const rows = rawKeys.map((raw) =>
      this.keyInventory.create({
        listingId,
        keyValueEncrypted: encryptKeyValue(raw.trim()),
        status: KeyInventoryStatus.Available,
      }),
    );
    await this.keyInventory.save(rows);
    return { added: rows.length };
  }

  // Seller-facing inventory view — status/timestamps only, never the key value (see
  // SellerListingKeySummary's own comment in packages/shared-types). Once uploaded, a seller has no
  // way to read a key back through this app; they're expected to keep their own record before
  // pasting it in, same as any real key-reseller platform.
  async listKeys(sellerId: string, listingId: string): Promise<SellerListingKeySummary[]> {
    const listing = await this.getOwnedListing(sellerId, listingId);
    if (listing.type !== ListingType.DigitalKey) {
      throw new ForbiddenException('Only digital key listings have key inventory');
    }
    const rows = await this.keyInventory.find({ where: { listingId }, order: { createdAt: 'DESC' } });
    return rows.map((row) => ({
      id: row.id,
      status: row.status,
      soldAt: row.soldAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  // Soft-delete only — an already-`sold` key is permanent (it's tied to a real order), and this
  // query's WHERE clause only ever matches an `available` row, so attempting to "remove" a sold key
  // just 404s rather than silently no-op'ing on the wrong row.
  async removeKey(sellerId: string, listingId: string, keyId: string): Promise<void> {
    await this.getOwnedListing(sellerId, listingId);
    const result = await this.keyInventory.update(
      { id: keyId, listingId, status: KeyInventoryStatus.Available },
      { status: KeyInventoryStatus.Revoked },
    );
    if (!result.affected) {
      throw new NotFoundException('Available key not found');
    }
  }

  private async getListingOrThrow(listingId: string): Promise<Listing> {
    const listing = await this.listings.findOne({ where: { id: listingId } });
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }
    return listing;
  }

  private async getOwnedListing(sellerId: string, listingId: string): Promise<Listing> {
    const listing = await this.getListingOrThrow(listingId);
    if (listing.sellerId !== sellerId) {
      throw new ForbiddenException("This listing doesn't belong to you");
    }
    return listing;
  }
}
