import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, LessThanOrEqual, Repository } from 'typeorm';
import { ListingStatus, ListingType, NotificationType, OrderStatus } from '@wavehub/shared-types';
import type { PublicOrderDetail, PublicOrderSummary } from '@wavehub/shared-types';
import { Order } from './order.entity';
import { OrderDeliveryFile } from './order-delivery-file.entity';
import { Listing } from '../listings/listing.entity';
import { Package } from '../listings/package.entity';
import { ServiceDetails } from '../listings/service-details.entity';
import { ItemDetails } from '../listings/item-details.entity';
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
    private readonly dataSource: DataSource,
    private readonly wallet: WalletService,
    private readonly storage: StorageService,
    private readonly chat: ChatService,
    private readonly notifications: NotificationsService,
    private readonly platformSettings: PlatformSettingsService,
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

    const platformFeePercent = await this.platformSettings.getPlatformFeePercent();
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
      fileType: file.mimetype,
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
    if (order.status !== OrderStatus.Paid) {
      throw new ForbiddenException('You can only cancel before the seller starts work');
    }
    assertValidTransition(order.status, OrderStatus.Cancelled);
    return this.cancelOrder(order, 'Cancelled by buyer before work started');
  }

  async cancelBySeller(sellerId: string, orderId: string, reason: string): Promise<Order> {
    const order = await this.getOrderAsSeller(sellerId, orderId);
    assertValidTransition(order.status, OrderStatus.Cancelled);
    return this.cancelOrder(order, reason);
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
