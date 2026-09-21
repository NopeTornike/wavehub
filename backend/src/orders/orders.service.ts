import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, LessThanOrEqual, Repository } from 'typeorm';
import { KeyInventoryStatus, ListingStatus, ListingType, NotificationType, OrderStatus } from '@wavehub/shared-types';
import type { PublicOrderDetail, PublicOrderSummary } from '@wavehub/shared-types';
import { Order } from './order.entity';
import { OrderDeliveryFile } from './order-delivery-file.entity';
import { Listing } from '../listings/listing.entity';
import { Package } from '../listings/package.entity';
import { ServiceDetails } from '../listings/service-details.entity';
import { ItemDetails } from '../listings/item-details.entity';
import { ListingKeyInventory } from '../listings/listing-key-inventory.entity';
import { decryptKeyValue } from '../listings/key-encryption.util';
import { assertValidTransition } from './order-lifecycle';
import { assertValidTransition as assertValidListingTransition } from '../listings/listing-lifecycle';
import { validateRequirementsAnswers } from './requirements-validator';
import { PurchaseOrderDto } from './dto/purchase-order.dto';
import { WalletService } from '../wallet/wallet.service';
import { calculatePlatformFee } from '../wallet/fee.util';
import { StorageService } from '../storage/storage.service';
import { ChatService } from '../chat/chat.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PlatformSettingsService } from '../settings/platform-settings.service';

const AUTO_COMPLETE_HOURS = 72;
const ALLOWED_DELIVERY_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
];
const MAX_DELIVERY_FILE_BYTES = 20 * 1024 * 1024;
// Every status a DigitalKey order's key is revealable from — see getRevealedKey's own comment.
const KEY_REVEALABLE_STATUSES = [OrderStatus.Paid, OrderStatus.InProgress, OrderStatus.Delivered, OrderStatus.Completed];

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(OrderDeliveryFile) private readonly deliveryFiles: Repository<OrderDeliveryFile>,
    @InjectRepository(Listing) private readonly listings: Repository<Listing>,
    @InjectRepository(Package) private readonly packages: Repository<Package>,
    @InjectRepository(ServiceDetails) private readonly serviceDetails: Repository<ServiceDetails>,
    @InjectRepository(ItemDetails) private readonly itemDetails: Repository<ItemDetails>,
    @InjectRepository(ListingKeyInventory) private readonly keyInventory: Repository<ListingKeyInventory>,
    private readonly dataSource: DataSource,
    private readonly wallet: WalletService,
    private readonly storage: StorageService,
    private readonly chat: ChatService,
    private readonly notifications: NotificationsService,
    private readonly platformSettings: PlatformSettingsService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  // Every lifecycle system-message post goes through this — chat is a side channel, never allowed
  // to fail or slow down the real state change that triggered it. Failures are logged and
  // swallowed, matching the pattern already established for `Listing.viewsCount` increments.
  private async postSystemMessage(orderId: string, body: string): Promise<void> {
    try {
      await this.chat.postSystemMessage(orderId, body);
    } catch (err) {
      this.logger.error(`Failed to post system message for order ${orderId}`, err as Error);
    }
  }

  // Same best-effort principle as postSystemMessage above — a notification failure must never
  // block the real order state change. No email bundling yet (NotificationsService#emit supports
  // it via `alsoEmail`, but that needs the recipient's address, which would mean pulling
  // UsersService into every hook module — deferred until a real caller needs it, see
  // notifications/CLAUDE.md).
  private async notify(userId: string, type: NotificationType, title: string, body: string, orderId: string): Promise<void> {
    try {
      await this.notifications.emit(userId, type, title, body, { orderId });
    } catch (err) {
      this.logger.error(`Failed to notify user ${userId} for order ${orderId}`, err as Error);
    }
  }

  // The entire purchase flow: validate listing/package/requirements, compute price+fee snapshots,
  // then atomically create the Order row and debit the buyer's WaveCoin balance in ONE transaction
  // — if the debit fails (insufficient balance), the whole transaction rolls back and no Order ever
  // persists. See wallet/CLAUDE.md for why WalletService accepts a manager param for this.
  async purchase(buyerId: string, dto: PurchaseOrderDto): Promise<Order> {
    const listing = await this.listings.findOne({
      where: { id: dto.listingId, status: ListingStatus.Active },
    });
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }
    if (listing.sellerId === buyerId) {
      throw new ForbiddenException("You can't buy your own listing");
    }

    let priceWaveCoin: number;
    let deliveryTimeDays: number | null = null;
    let pkg: Package | null = null;
    let itemIsUnique = false;

    if (listing.type === ListingType.Service) {
      if (!dto.packageId) {
        throw new ForbiddenException('packageId is required for service listings');
      }
      pkg = await this.packages.findOne({ where: { id: dto.packageId, listingId: listing.id } });
      if (!pkg) {
        throw new NotFoundException('Package not found');
      }
      priceWaveCoin = pkg.priceWaveCoin;
      deliveryTimeDays = pkg.deliveryTimeDays;

      const details = await this.serviceDetails.findOne({ where: { listingId: listing.id } });
      validateRequirementsAnswers(details?.requirementsSchema ?? [], dto.requirementsAnswers);
    } else if (listing.type === ListingType.DigitalKey) {
      if (listing.priceWaveCoin == null) {
        throw new ForbiddenException('This listing has no price set');
      }
      // No stock pre-check here on purpose — DigitalKey stock lives in listing_key_inventory, not
      // a listings column, and any pre-check here would be racy anyway (two buyers could both pass
      // it before either claims a row). The atomic claim inside the transaction below is the real,
      // race-safe gate — see the SELECT ... FOR UPDATE SKIP LOCKED query.
      priceWaveCoin = listing.priceWaveCoin;
    } else {
      if (listing.priceWaveCoin == null) {
        throw new ForbiddenException('This listing has no price set');
      }
      if (listing.stockQuantity != null && listing.stockQuantity < 1) {
        throw new ForbiddenException('This item is out of stock');
      }
      priceWaveCoin = listing.priceWaveCoin;
      const details = await this.itemDetails.findOne({ where: { listingId: listing.id } });
      itemIsUnique = details?.isUnique ?? true;
    }

    const platformFeePercent = await this.subscriptions.effectiveFeePercent(
      listing.sellerId,
      await this.platformSettings.getPlatformFeePercent(),
    );
    const { feeWaveCoin, sellerReceivesWaveCoin } = calculatePlatformFee(priceWaveCoin, platformFeePercent);

    const saved = await this.dataSource.transaction(async (manager) => {
      const orderNumber = await this.generateOrderNumber(manager);
      const now = new Date();

      const order = manager.create(Order, {
        orderNumber,
        buyerId,
        sellerId: listing.sellerId,
        listingId: listing.id,
        packageId: pkg?.id ?? null,
        listingType: listing.type,
        status: OrderStatus.Paid,
        requirementsAnswers: listing.type === ListingType.Service ? (dto.requirementsAnswers ?? {}) : null,
        priceWaveCoin,
        platformFeePercentSnapshot: platformFeePercent,
        platformFeeWaveCoin: feeWaveCoin,
        sellerPayoutWaveCoin: sellerReceivesWaveCoin,
        deliveryDueAt: deliveryTimeDays ? new Date(now.getTime() + deliveryTimeDays * 86_400_000) : null,
      });
      const saved = await manager.save(order);

      // The race-safe stock claim: lock exactly one `available` row for this listing (skipping any
      // row a concurrent purchase already has locked, rather than waiting on it) and flip it to
      // `sold` in the same statement. Two simultaneous buyers can never claim the same key — one of
      // them gets a real row, the other's subquery returns nothing (either because every row is
      // locked by the other transaction, or, once that transaction commits, because none are
      // `available` anymore). Done before the wallet debit so an out-of-stock buyer's balance is
      // never touched (the whole transaction still rolls back either way, but this keeps the two
      // failure modes cleanly separated instead of relying on rollback alone to make it "not
      // matter").
      if (listing.type === ListingType.DigitalKey) {
        // Deliberately built on the QueryBuilder's `UpdateResult.affected` (a stable, documented
        // TypeORM number), not a hand-parsed `manager.query()` raw-array result — a real bug here
        // during verification: `manager.query()`'s return value for a raw `UPDATE ... RETURNING`
        // was NOT the plain `Array<{id}>` this code originally assumed, so `claimed.length === 0`
        // silently never evaluated true (comparing `undefined === 0`) and let a purchase through
        // with zero keys actually claimed — caught only by firing real concurrent requests against
        // a live Postgres instance, not by any unit test with a fake repository. `.affected` has no
        // such ambiguity.
        const claimResult = await manager
          .createQueryBuilder()
          .update(ListingKeyInventory)
          .set({ status: KeyInventoryStatus.Sold, orderId: saved.id, soldAt: () => 'now()' })
          .where(
            `id = (
              SELECT id FROM listing_key_inventory
              WHERE "listingId" = :listingId AND status = :availableStatus
              ORDER BY "createdAt" ASC
              FOR UPDATE SKIP LOCKED
              LIMIT 1
            )`,
            { listingId: listing.id, availableStatus: KeyInventoryStatus.Available },
          )
          .execute();
        if (!claimResult.affected) {
          throw new ForbiddenException('This key listing is out of stock');
        }
      }

      // WalletService throws a plain Error('INSUFFICIENT_BALANCE') — translate it to a clean 4xx
      // here rather than letting it fall through as an unhandled 500 (rolls back the Order insert
      // either way; this only changes what the caller sees).
      try {
        await this.wallet.debitForOrder(buyerId, saved.id, priceWaveCoin, manager);
      } catch (err) {
        if (err instanceof Error && err.message === 'INSUFFICIENT_BALANCE') {
          throw new ForbiddenException('Insufficient WaveCoin balance for this purchase');
        }
        throw err;
      }

      if (listing.type === ListingType.Item) {
        if (listing.stockQuantity != null) {
          await manager.decrement(Listing, { id: listing.id }, 'stockQuantity', 1);
        }
        const soldOut = itemIsUnique || (listing.stockQuantity != null && listing.stockQuantity <= 1);
        if (soldOut) {
          assertValidListingTransition(listing.status, ListingStatus.Paused);
          await manager.update(Listing, listing.id, { status: ListingStatus.Paused });
        }
      } else if (listing.type === ListingType.DigitalKey) {
        const remaining = await manager.count(ListingKeyInventory, {
          where: { listingId: listing.id, status: KeyInventoryStatus.Available },
        });
        if (remaining === 0) {
          assertValidListingTransition(listing.status, ListingStatus.Paused);
          await manager.update(Listing, listing.id, { status: ListingStatus.Paused });
        }
      }

      return saved;
    });

    // Chat is created and posted to outside the money-moving transaction — a chat failure must
    // never roll back a successful purchase. See `postSystemMessage` above.
    try {
      await this.chat.ensureConversation(saved.id, saved.buyerId, saved.sellerId);
      await this.chat.postSystemMessage(saved.id, 'შეკვეთა შექმნილია.');
    } catch (err) {
      this.logger.error(`Failed to create chat for order ${saved.orderNumber}`, err as Error);
    }
    await this.notify(
      saved.sellerId,
      NotificationType.OrderPaid,
      'ახალი შეკვეთა',
      `თქვენ მიიღეთ ახალი შეკვეთა #${saved.orderNumber}.`,
      saved.id,
    );

    return saved;
  }

  async startOrder(sellerId: string, orderId: string): Promise<Order> {
    const order = await this.getOrderAsSeller(sellerId, orderId);
    assertValidTransition(order.status, OrderStatus.InProgress);
    order.status = OrderStatus.InProgress;
    const saved = await this.orders.save(order);
    await this.postSystemMessage(orderId, 'გამყიდველმა დაიწყო სამუშაო.');
    await this.notify(
      saved.buyerId,
      NotificationType.OrderStarted,
      'სამუშაო დაიწყო',
      `გამყიდველმა დაიწყო სამუშაო შეკვეთაზე #${saved.orderNumber}.`,
      saved.id,
    );
    return saved;
  }

  async deliverOrder(sellerId: string, orderId: string): Promise<Order> {
    const order = await this.getOrderAsSeller(sellerId, orderId);
    assertValidTransition(order.status, OrderStatus.Delivered);
    order.status = OrderStatus.Delivered;
    order.deliveredAt = new Date();
    order.autoCompleteAt = new Date(Date.now() + AUTO_COMPLETE_HOURS * 60 * 60 * 1000);
    const saved = await this.orders.save(order);
    await this.postSystemMessage(orderId, 'შეკვეთა მიწოდებულია.');
    await this.notify(
      saved.buyerId,
      NotificationType.OrderDelivered,
      'შეკვეთა მიწოდებულია',
      `თქვენი შეკვეთა #${saved.orderNumber} მიწოდებულია — გადახედეთ და დაადასტურეთ მიღება.`,
      saved.id,
    );
    return saved;
  }

  async addDeliveryFile(
    sellerId: string,
    orderId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
  ): Promise<OrderDeliveryFile> {
    const order = await this.getOrderAsSeller(sellerId, orderId);
    if (order.status !== OrderStatus.InProgress && order.status !== OrderStatus.Delivered) {
      throw new ForbiddenException('Can only attach delivery files while the order is in progress or delivered');
    }
    if (!ALLOWED_DELIVERY_MIME_TYPES.includes(file.mimetype)) {
      throw new ForbiddenException('File type not allowed (JPG, PNG, WEBP, PDF, ZIP only)');
    }
    if (file.size > MAX_DELIVERY_FILE_BYTES) {
      throw new ForbiddenException('File exceeds the 20MB size limit');
    }

    const stored = await this.storage.save(file.buffer, file.originalname);
    const record = this.deliveryFiles.create({
      orderId: order.id,
      uploadedBy: sellerId,
      fileUrl: stored.url,
      fileType: stored.contentType ?? file.mimetype,
    });
    const saved = await this.deliveryFiles.save(record);
    await this.postSystemMessage(orderId, 'გამყიდველმა ატვირთა ფაილი.');
    return saved;
  }

  async requestRevision(buyerId: string, orderId: string, reason: string): Promise<Order> {
    const order = await this.getOrderAsBuyer(buyerId, orderId);
    assertValidTransition(order.status, OrderStatus.InProgress);
    order.status = OrderStatus.InProgress;
    order.revisionReason = reason;
    order.deliveredAt = null;
    order.autoCompleteAt = null;
    const saved = await this.orders.save(order);
    await this.postSystemMessage(orderId, `მყიდველმა მოითხოვა გადამუშავება: ${reason}`);
    await this.notify(
      saved.sellerId,
      NotificationType.OrderRevisionRequested,
      'გადამუშავება მოთხოვნილია',
      `მყიდველმა მოითხოვა გადამუშავება შეკვეთაზე #${saved.orderNumber}: ${reason}`,
      saved.id,
    );
    return saved;
  }

  async acceptDelivery(buyerId: string, orderId: string): Promise<Order> {
    const order = await this.getOrderAsBuyer(buyerId, orderId);
    assertValidTransition(order.status, OrderStatus.Completed);
    return this.completeOrder(order);
  }

  async cancelByBuyer(buyerId: string, orderId: string): Promise<Order> {
    const order = await this.getOrderAsBuyer(buyerId, orderId);
    this.assertCancellableListingType(order);
    if (order.status !== OrderStatus.Paid) {
      throw new ForbiddenException('You can only cancel before the seller starts work');
    }
    assertValidTransition(order.status, OrderStatus.Cancelled);
    return this.cancelOrder(order, 'Cancelled by buyer before work started');
  }

  async cancelBySeller(sellerId: string, orderId: string, reason: string): Promise<Order> {
    const order = await this.getOrderAsSeller(sellerId, orderId);
    this.assertCancellableListingType(order);
    assertValidTransition(order.status, OrderStatus.Cancelled);
    return this.cancelOrder(order, reason);
  }

  // A DigitalKey order is never plain-cancellable by either party — by the time an order reaches
  // `Paid` (the only status either cancel method allows from), the key has already been claimed
  // and is immediately viewable by the buyer (see getRevealedKey). A no-review cancel-and-refund
  // would let a buyer walk away with a real secret and their WaveCoin back, or let a seller yank
  // back a key the buyer may have already used. "This key doesn't work" is a real, legitimate
  // complaint — it just belongs in `backend/src/disputes/` (Paid/InProgress/Delivered are all
  // openable there already, no changes needed) where an admin actually reviews it, not an
  // automatic refund either party can trigger unilaterally.
  private assertCancellableListingType(order: Order): void {
    if (order.listingType === ListingType.DigitalKey) {
      throw new ForbiddenException(
        'Digital key purchases are final and cannot be cancelled — open a dispute if there is a problem with the key',
      );
    }
  }

  // Relations are joined here (not left as bare FK ids) so a list page can render a card — title,
  // counterparty name, package name — without an N+1 follow-up request per row. See
  // ListingsService#browseActive for the same reasoning applied to listings.
  async findMineAsBuyer(buyerId: string): Promise<PublicOrderSummary[]> {
    const orders = await this.orders.find({
      where: { buyerId },
      relations: ['listing', 'package', 'buyer', 'seller'],
      order: { createdAt: 'DESC' },
    });
    return orders.map((order) => this.toSummary(order));
  }

  async findMineAsSeller(sellerId: string): Promise<PublicOrderSummary[]> {
    const orders = await this.orders.find({
      where: { sellerId },
      relations: ['listing', 'package', 'buyer', 'seller'],
      order: { createdAt: 'DESC' },
    });
    return orders.map((order) => this.toSummary(order));
  }

  async findForParticipant(userId: string, orderId: string): Promise<PublicOrderDetail> {
    const order = await this.orders.findOne({
      where: { id: orderId },
      relations: ['listing', 'package', 'buyer', 'seller'],
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.buyerId !== userId && order.sellerId !== userId) {
      throw new ForbiddenException("This order doesn't belong to you");
    }

    const files = await this.deliveryFiles.find({ where: { orderId }, order: { createdAt: 'ASC' } });

    return {
      ...this.toSummary(order),
      requirementsAnswers: order.requirementsAnswers,
      platformFeeWaveCoin: order.platformFeeWaveCoin,
      sellerPayoutWaveCoin: order.sellerPayoutWaveCoin,
      cancelledAt: order.cancelledAt?.toISOString() ?? null,
      cancellationReason: order.cancellationReason,
      revisionReason: order.revisionReason,
      deliveryFiles: files.map((file) => ({
        id: file.id,
        fileUrl: file.fileUrl,
        fileType: file.fileType,
        uploadedBy: file.uploadedBy,
        createdAt: file.createdAt.toISOString(),
      })),
    };
  }

  private toSummary(order: Order): PublicOrderSummary {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      listing: { id: order.listing.id, title: order.listing.title, type: order.listing.type },
      package: order.package ? { id: order.package.id, name: order.package.name } : null,
      buyer: {
        id: order.buyer.id,
        username: order.buyer.username,
        firstName: order.buyer.firstName,
        lastName: order.buyer.lastName,
      },
      seller: {
        id: order.seller.id,
        username: order.seller.username,
        firstName: order.seller.firstName,
        lastName: order.seller.lastName,
      },
      priceWaveCoin: order.priceWaveCoin,
      deliveryDueAt: order.deliveryDueAt?.toISOString() ?? null,
      deliveredAt: order.deliveredAt?.toISOString() ?? null,
      autoCompleteAt: order.autoCompleteAt?.toISOString() ?? null,
      completedAt: order.completedAt?.toISOString() ?? null,
      createdAt: order.createdAt.toISOString(),
    };
  }

  // Runs hourly — a 72h auto-complete window doesn't need per-minute precision, and hourly keeps
  // this cheap. Not wired to anything user-facing; failures are logged and skipped per-order so one
  // bad row can't block the rest of the batch.
  @Cron('0 * * * *')
  async autoCompleteDueOrders(): Promise<void> {
    const due = await this.orders.find({
      where: { status: OrderStatus.Delivered, autoCompleteAt: LessThanOrEqual(new Date()) },
    });

    for (const order of due) {
      try {
        await this.completeOrder(order);
      } catch (err) {
        this.logger.error(`Auto-complete failed for order ${order.orderNumber}`, err as Error);
      }
    }
  }

  private async completeOrder(order: Order): Promise<Order> {
    const saved = await this.dataSource.transaction(async (manager) => {
      await this.wallet.releaseSellerEarnings(
        order.sellerId,
        order.id,
        order.sellerPayoutWaveCoin,
        undefined,
        manager,
      );
      order.status = OrderStatus.Completed;
      order.completedAt = new Date();
      const savedOrder = await manager.save(order);
      await manager.increment(Listing, { id: order.listingId }, 'ordersCount', 1);
      return savedOrder;
    });
    await this.postSystemMessage(order.id, 'შეკვეთა დასრულებულია.');
    await this.notify(
      saved.buyerId,
      NotificationType.OrderCompleted,
      'შეკვეთა დასრულებულია',
      `შეკვეთა #${saved.orderNumber} დასრულებულია.`,
      saved.id,
    );
    await this.notify(
      saved.sellerId,
      NotificationType.OrderCompleted,
      'შეკვეთა დასრულებულია',
      `შეკვეთა #${saved.orderNumber} დასრულებულია და თანხა ჩაირიცხა თქვენს ბალანსზე.`,
      saved.id,
    );
    return saved;
  }

  private async cancelOrder(order: Order, reason: string): Promise<Order> {
    const saved = await this.dataSource.transaction(async (manager) => {
      await this.wallet.refundBuyer(order.buyerId, order.id, order.priceWaveCoin, manager);
      order.status = OrderStatus.Cancelled;
      order.cancelledAt = new Date();
      order.cancellationReason = reason;
      const savedOrder = await manager.save(order);

      if (order.listingType === ListingType.Item) {
        const listing = await manager.findOne(Listing, { where: { id: order.listingId } });
        if (listing) {
          if (listing.stockQuantity != null) {
            await manager.increment(Listing, { id: listing.id }, 'stockQuantity', 1);
          }
          if (listing.status === ListingStatus.Paused) {
            assertValidListingTransition(listing.status, ListingStatus.Active);
            await manager.update(Listing, listing.id, { status: ListingStatus.Active });
          }
        }
      }

      return savedOrder;
    });
    await this.postSystemMessage(order.id, `შეკვეთა გაუქმებულია: ${reason}`);
    await this.notify(
      saved.buyerId,
      NotificationType.OrderCancelled,
      'შეკვეთა გაუქმებულია',
      `შეკვეთა #${saved.orderNumber} გაუქმებულია: ${reason}`,
      saved.id,
    );
    await this.notify(
      saved.sellerId,
      NotificationType.OrderCancelled,
      'შეკვეთა გაუქმებულია',
      `შეკვეთა #${saved.orderNumber} გაუქმებულია: ${reason}`,
      saved.id,
    );
    return saved;
  }

  private async generateOrderNumber(manager: import('typeorm').EntityManager): Promise<string> {
    const result: Array<{ n: string }> = await manager.query(`SELECT nextval('order_number_seq') AS n`);
    return `WH-${result[0].n.padStart(6, '0')}`;
  }

  // Chat routes live on OrdersController (`/orders/:id/messages`) rather than a ChatController,
  // reusing this same participant check rather than duplicating it in a module that doesn't
  // otherwise know about orders — see backend/src/chat/CLAUDE.md.
  async listMessages(userId: string, orderId: string) {
    const order = await this.getOrderOrThrow(orderId);
    if (order.buyerId !== userId && order.sellerId !== userId) {
      throw new ForbiddenException("This order doesn't belong to you");
    }
    return this.chat.listMessages(orderId);
  }

  async sendMessage(userId: string, orderId: string, body: string) {
    const order = await this.getOrderOrThrow(orderId);
    if (order.buyerId !== userId && order.sellerId !== userId) {
      throw new ForbiddenException("This order doesn't belong to you");
    }
    return this.chat.postMessage(orderId, userId, body);
  }

  // Buyer-only, decrypted on demand — the plaintext key is never stored anywhere except this one
  // reconstruction from the encrypted column, and never included in the general order-detail
  // response (findForParticipant) so it can't leak into a listing that both parties (or an admin)
  // can see. Available from `Paid` onward — LAUNCH_PLAN.md §2d's "the buyer only ever sees the key
  // value after status = paid" — deliberately not gated on the InProgress/Delivered/Completed
  // ceremony a service/item order goes through, since there's no real seller action for a key
  // (it's already in inventory). Cancelled/Refunded orders never reach here in practice (see
  // assertCancellableListingType — a DigitalKey order can't be plain-cancelled at all), but the
  // explicit status allowlist below is the actual gate, not an assumption about what else prevents it.
  async getRevealedKey(buyerId: string, orderId: string): Promise<{ key: string }> {
    const order = await this.getOrderAsBuyer(buyerId, orderId);
    if (order.listingType !== ListingType.DigitalKey) {
      throw new ForbiddenException('This order has no digital key');
    }
    if (!KEY_REVEALABLE_STATUSES.includes(order.status)) {
      throw new ForbiddenException('The key for this order is not available');
    }
    const row = await this.keyInventory.findOne({ where: { orderId: order.id, status: KeyInventoryStatus.Sold } });
    if (!row) {
      throw new NotFoundException('Key not found for this order');
    }
    return { key: decryptKeyValue(row.keyValueEncrypted) };
  }

  private async getOrderOrThrow(orderId: string): Promise<Order> {
    const order = await this.orders.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  private async getOrderAsBuyer(buyerId: string, orderId: string): Promise<Order> {
    const order = await this.getOrderOrThrow(orderId);
    if (order.buyerId !== buyerId) {
      throw new ForbiddenException("This order doesn't belong to you");
    }
    return order;
  }

  private async getOrderAsSeller(sellerId: string, orderId: string): Promise<Order> {
    const order = await this.getOrderOrThrow(orderId);
    if (order.sellerId !== sellerId) {
      throw new ForbiddenException("This order doesn't belong to you");
    }
    return order;
  }
}
