import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { ListingFavorite } from './listing-favorite.entity';
import { KeyInventoryStatus, ListingStatus, ListingType } from '@wavehub/shared-types';
import type { AdminListingSummary, PublicSeller, SellerListingKeySummary } from '@wavehub/shared-types';
import { User } from '../users/user.entity';
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
import { UpdateListingDto } from './dto/update-listing.dto';
import { CreatePackageDto } from './dto/create-package.dto';
import { BrowseListingsDto } from './dto/browse-listings.dto';
import { StorageService } from '../storage/storage.service';
import { encryptKeyValue } from './key-encryption.util';

// The joined `seller` relation is a full User row (email, wallet balance, admin role, moderation
// reason...). Anything public must go through this projection — the shared `PublicSeller` type
// always promised exactly these fields, but the raw entity was being serialized instead (found by
// the response-privacy sweep in backend/test/security.e2e-spec.ts).
function toPublicSeller(seller: User): PublicSeller {
  return {
    id: seller.id,
    username: seller.username,
    firstName: seller.firstName,
    lastName: seller.lastName,
    sellerRatingAvg: seller.sellerRatingAvg,
    sellerRatingCount: seller.sellerRatingCount,
  };
}

const MAX_IMAGES_PER_LISTING = 6;
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
    @InjectRepository(ListingFavorite) private readonly favorites: Repository<ListingFavorite>,
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
          attributes: dto.attributes ?? {},
          isUnique: dto.isUnique ?? true,
        }),
      );
    }
    // DigitalKey: no 1:1 details row — see listing-key-inventory.entity.ts instead.

    return saved;
  }

  async findMine(sellerId: string): Promise<Listing[]> {
    return this.listings.find({ where: { sellerId }, relations: ['game', 'images'], order: { createdAt: 'DESC' } });
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
  ): Promise<{ items: Array<Omit<Listing, 'seller'> & { seller: PublicSeller; startingPriceWaveCoin: number | null }>; total: number }> {
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
    } else if (filters.game) {
      qb.andWhere('game.slug = :gameSlug', { gameSlug: filters.game });
    }
    if (filters.type) {
      qb.andWhere('listing.type = :type', { type: filters.type });
    }
    const search = filters.q?.trim();
    if (search) {
      const pattern = `%${search.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
      qb.andWhere(
        new Brackets((w) => {
          w.where('listing.title ILIKE :search', { search: pattern })
            .orWhere('listing.description ILIKE :search', { search: pattern })
            .orWhere('game.name ILIKE :search', { search: pattern });
        }),
      );
    }

    // `featuredListings` perk boost (LAUNCH_PLAN.md §3b) — read live via a join to
    // user_subscriptions/subscription_plans, never a cached flag on Listing, so a lapsed
    // subscription stops boosting the instant it lapses rather than lingering until something
    // re-syncs a flag. Joined (not a separate lookup) so the boost applies BEFORE pagination cuts
    // the result down to one page — a later in-memory re-sort of just the fetched page would be too
    // late to promote a boosted listing that the SQL-level ORDER BY + LIMIT already excluded.
    // Every alias below is quoted to match TypeORM's own mixed-case alias quoting exactly
    // ("sellerSub", "sellerPlan") — an unquoted reference in a raw join condition gets
    // lowercase-folded by Postgres's parser and then fails to resolve against the quoted alias
    // TypeORM generates elsewhere in the same query (`missing FROM-clause entry for "sellersub"`,
    // caught while verifying this against a live instance).
    qb.leftJoin(
      'user_subscriptions',
      'sellerSub',
      `"sellerSub"."userId" = "listing"."sellerId" AND "sellerSub"."status" IN ('active', 'past_due') AND "sellerSub"."audience" = 'seller_coach'`,
    )
      .leftJoin(
        'subscription_plans',
        'sellerPlan',
        `"sellerPlan"."id" = "sellerSub"."planId" AND ("sellerPlan"."perks"->>'featuredListings')::boolean IS TRUE`,
      )
      // A named raw column, not an inline expression in .orderBy() — TypeORM's orderBy alias
      // resolution (used to decide whether DISTINCT/pagination needs adjusting) chokes on a raw
      // boolean/CASE expression passed directly, but orders correctly by a plain addSelect alias.
      .addSelect('CASE WHEN "sellerPlan"."id" IS NOT NULL THEN 1 ELSE 0 END', 'featured_boost');
    if (filters.featured) {
      qb.andWhere('"sellerPlan"."id" IS NOT NULL');
    }

    // Sort key for price sorts: an item/key's own price, else the cheapest package (services).
    qb.addSelect(
      `COALESCE("listing"."priceWaveCoin", (SELECT MIN(p."priceWaveCoin") FROM "packages" p WHERE p."listingId" = "listing"."id"))`,
      'sort_price',
    );
    if (filters.sort === 'oldest') {
      qb.orderBy('listing.createdAt', 'ASC');
    } else if (filters.sort === 'price_asc') {
      qb.orderBy('sort_price', 'ASC', 'NULLS LAST').addOrderBy('listing.createdAt', 'DESC');
    } else if (filters.sort === 'price_desc') {
      qb.orderBy('sort_price', 'DESC', 'NULLS LAST').addOrderBy('listing.createdAt', 'DESC');
    } else {
      qb.orderBy('featured_boost', 'DESC').addOrderBy('listing.isFeatured', 'DESC').addOrderBy('listing.createdAt', 'DESC');
    }

    const [items, total] = await qb
      .take(filters.limit ?? 20)
      .skip(filters.offset ?? 0)
      .getManyAndCount();

    return { items: await this.decorateSummaries(items), total };
  }

  // Everything a listing card needs beyond the row itself, batched per page (a fixed handful of
  // queries regardless of page size): cheapest package price for services, live available-key
  // count for digital keys, item attributes, and the favourite count. Shared by browse and the
  // favourites list so both return the exact same card shape.
  private async decorateSummaries(items: Listing[]) {
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

    const ids = items.map((item) => item.id);
    const itemListingIds = items.filter((item) => item.type === ListingType.Item).map((i) => i.id);
    const [attributeRows, favoriteRows] = await Promise.all([
      itemListingIds.length > 0
        ? this.itemDetails.find({ where: { listingId: In(itemListingIds) }, select: ['listingId', 'attributes'] })
        : Promise.resolve([] as ItemDetails[]),
      ids.length > 0
        ? this.favorites
            .createQueryBuilder('f')
            .select('f.listingId', 'listingId')
            .addSelect('COUNT(*)', 'count')
            .where('f.listingId IN (:...ids)', { ids })
            .groupBy('f.listingId')
            .getRawMany<{ listingId: string; count: string }>()
        : Promise.resolve([] as Array<{ listingId: string; count: string }>),
    ]);
    const attributesByListing = new Map(attributeRows.map((row) => [row.listingId, row.attributes]));
    const favoritesByListing = new Map(favoriteRows.map((row) => [row.listingId, Number(row.count)]));

    return items.map((item) => ({
      ...item,
      seller: toPublicSeller(item.seller),
      stockQuantity: item.type === ListingType.DigitalKey ? availableCountByListing.get(item.id) ?? 0 : item.stockQuantity,
      startingPriceWaveCoin:
        item.type === ListingType.Item || item.type === ListingType.DigitalKey
          ? item.priceWaveCoin
          : minPriceByListing.get(item.id) ?? null,
      itemAttributes: item.type === ListingType.Item ? attributesByListing.get(item.id) ?? {} : null,
      favoriteCount: favoritesByListing.get(item.id) ?? 0,
    }));
  }

  // --- Favourites (the prototype's ♡ / Favorites page) ---

  // Only an Active listing can be saved (same visibility rule as the public detail page); saving
  // twice is a no-op thanks to the composite primary key.
  async addFavorite(userId: string, listingId: string): Promise<{ favorited: true; favoriteCount: number }> {
    const exists = await this.listings.exist({ where: { id: listingId, status: ListingStatus.Active } });
    if (!exists) {
      throw new NotFoundException('Listing not found');
    }
    await this.favorites
      .createQueryBuilder()
      .insert()
      .into(ListingFavorite)
      .values({ userId, listingId })
      .orIgnore()
      .execute();
    return { favorited: true, favoriteCount: await this.favorites.count({ where: { listingId } }) };
  }

  async removeFavorite(userId: string, listingId: string): Promise<{ favorited: false; favoriteCount: number }> {
    await this.favorites.delete({ userId, listingId });
    return { favorited: false, favoriteCount: await this.favorites.count({ where: { listingId } }) };
  }

  async listFavoriteIds(userId: string): Promise<string[]> {
    const rows = await this.favorites.find({ where: { userId }, select: ['listingId'], order: { createdAt: 'DESC' } });
    return rows.map((row) => row.listingId);
  }

  // The viewer's saved listings as ordinary cards, newest save first. Listings that have since
  // stopped being Active are left out (they'd 404 on click) but the favourite row is kept, so it
  // reappears if the seller re-activates the listing.
  async listFavorites(userId: string) {
    const ids = await this.listFavoriteIds(userId);
    if (ids.length === 0) return [];
    const rows = await this.listings.find({
      where: { id: In(ids), status: ListingStatus.Active },
      relations: ['seller', 'category', 'game', 'images'],
    });
    const order = new Map(ids.map((id, index) => [id, index]));
    rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    return this.decorateSummaries(rows);
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
    const [favoriteCount, [{ sellerCompletedOrders }]] = await Promise.all([
      this.favorites.count({ where: { listingId: id } }),
      this.listings.query(
        `SELECT count(*)::int AS "sellerCompletedOrders" FROM "orders" WHERE "sellerId" = $1 AND "status" = 'completed'`,
        [listing.sellerId],
      ),
    ]);

    if (listing.type === ListingType.Service) {
      const [packages, details] = await Promise.all([
        this.packages.find({ where: { listingId: id }, order: { sortOrder: 'ASC' } }),
        this.serviceDetails.findOne({ where: { listingId: id } }),
      ]);
      return {
        ...listing,
        seller: toPublicSeller(listing.seller),
        packages,
        requirementsSchema: details?.requirementsSchema ?? [],
        faq: details?.faq ?? [],
        itemAttributes: null,
        favoriteCount,
        sellerCompletedOrders,
      };
    }

    if (listing.type === ListingType.DigitalKey) {
      const availableCount = await this.keyInventory.count({
        where: { listingId: id, status: KeyInventoryStatus.Available },
      });
      return { ...listing, seller: toPublicSeller(listing.seller), packages: [], stockQuantity: availableCount, itemAttributes: null, favoriteCount, sellerCompletedOrders };
    }

    const itemDetails = await this.itemDetails.findOne({ where: { listingId: id } });
    return { ...listing, seller: toPublicSeller(listing.seller), packages: [], itemAttributes: itemDetails?.attributes ?? {}, favoriteCount, sellerCompletedOrders };
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

    const stored = await this.storage.save(file.buffer, file.originalname, 'image');
    const image = this.images.create({ listingId, url: stored.url, sortOrder: existingCount });
    return this.images.save(image);
  }

  // Seller edit. A Draft/Rejected listing just takes the changes (the seller submits it when ready);
  // an Active/Paused one goes back to PendingReview so the edited version is moderated before it's
  // buyable again. A listing already waiting for review can't be edited mid-review.
  async update(sellerId: string, listingId: string, dto: UpdateListingDto): Promise<Listing> {
    const listing = await this.getOwnedListing(sellerId, listingId);
    if (listing.status === ListingStatus.PendingReview) {
      throw new ConflictException('This listing is waiting for review — edit it after the decision');
    }
    if (dto.priceWaveCoin !== undefined && listing.type === ListingType.Service) {
      throw new ForbiddenException('Service listings are priced by their packages');
    }
    if (dto.attributes !== undefined && listing.type !== ListingType.Item) {
      throw new ForbiddenException('Only item listings have attributes');
    }
    if (dto.title !== undefined) listing.title = dto.title;
    if (dto.description !== undefined) listing.description = dto.description;
    if (dto.priceWaveCoin !== undefined) listing.priceWaveCoin = dto.priceWaveCoin;
    if (listing.status === ListingStatus.Active || listing.status === ListingStatus.Paused) {
      assertValidTransition(listing.status, ListingStatus.PendingReview);
      listing.status = ListingStatus.PendingReview;
    }
    const saved = await this.listings.save(listing);
    if (dto.attributes !== undefined) {
      await this.itemDetails.update({ listingId }, { attributes: dto.attributes });
    }
    return saved;
  }

  // Seller delete. Only a listing nobody has ever ordered can be removed — orders (and their
  // escrow/dispute/review history) must keep pointing at the listing they bought, so a listing with
  // orders gets a clear "pause it instead" answer.
  async remove(sellerId: string, listingId: string): Promise<void> {
    const listing = await this.getOwnedListing(sellerId, listingId);
    const [{ count }] = await this.listings.query(`SELECT count(*)::int AS count FROM "orders" WHERE "listingId" = $1`, [listingId]);
    if (count > 0) {
      throw new ConflictException('This listing has orders and can’t be deleted — pause it instead');
    }
    try {
      await this.listings.delete({ id: listing.id });
    } catch (err) {
      // 23503 = foreign_key_violation: an order was placed between the check above and the delete.
      if ((err as { code?: string }).code === '23503') {
        throw new ConflictException('This listing has orders and can’t be deleted — pause it instead');
      }
      throw err;
    }
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
