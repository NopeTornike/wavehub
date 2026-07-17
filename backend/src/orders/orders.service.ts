import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, LessThanOrEqual, Repository } from 'typeorm';
import { ListingStatus, ListingType, OrderStatus } from '@wavehub/shared-types';
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

// 10% matches every example in the source spec. Not admin-configurable yet — that's build-plan
// Phase 11 (Platform Settings). Snapshotted onto each Order at creation (platformFeePercentSnapshot)
// so a later rate change never retroactively changes an existing order's math.
const DEFAULT_PLATFORM_FEE_PERCENT = 10;
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
  ) {}

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

    const { feeWaveCoin, sellerReceivesWaveCoin } = calculatePlatformFee(
      priceWaveCoin,
      DEFAULT_PLATFORM_FEE_PERCENT,
    );

    return this.dataSource.transaction(async (manager) => {
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
        platformFeePercentSnapshot: DEFAULT_PLATFORM_FEE_PERCENT,
        platformFeeWaveCoin: feeWaveCoin,
        sellerPayoutWaveCoin: sellerReceivesWaveCoin,
        deliveryDueAt: deliveryTimeDays ? new Date(now.getTime() + deliveryTimeDays * 86_400_000) : null,
      });
      const saved = await manager.save(order);

      // Throws INSUFFICIENT_BALANCE if the buyer can't afford it — rolls back the Order insert too.
      await this.wallet.debitForOrder(buyerId, saved.id, priceWaveCoin, manager);

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
  }

  async startOrder(sellerId: string, orderId: string): Promise<Order> {
    const order = await this.getOrderAsSeller(sellerId, orderId);
    assertValidTransition(order.status, OrderStatus.InProgress);
    order.status = OrderStatus.InProgress;
    return this.orders.save(order);
  }

  async deliverOrder(sellerId: string, orderId: string): Promise<Order> {
    const order = await this.getOrderAsSeller(sellerId, orderId);
    assertValidTransition(order.status, OrderStatus.Delivered);
    order.status = OrderStatus.Delivered;
    order.deliveredAt = new Date();
    order.autoCompleteAt = new Date(Date.now() + AUTO_COMPLETE_HOURS * 60 * 60 * 1000);
    return this.orders.save(order);
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
    return this.deliveryFiles.save(record);
  }

  async requestRevision(buyerId: string, orderId: string, reason: string): Promise<Order> {
    const order = await this.getOrderAsBuyer(buyerId, orderId);
    assertValidTransition(order.status, OrderStatus.InProgress);
    order.status = OrderStatus.InProgress;
    order.revisionReason = reason;
    order.deliveredAt = null;
    order.autoCompleteAt = null;
    return this.orders.save(order);
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

  async findMineAsBuyer(buyerId: string): Promise<Order[]> {
    return this.orders.find({ where: { buyerId }, order: { createdAt: 'DESC' } });
  }

  async findMineAsSeller(sellerId: string): Promise<Order[]> {
    return this.orders.find({ where: { sellerId }, order: { createdAt: 'DESC' } });
  }

  async findForParticipant(userId: string, orderId: string): Promise<Order> {
    const order = await this.getOrderOrThrow(orderId);
    if (order.buyerId !== userId && order.sellerId !== userId) {
      throw new ForbiddenException("This order doesn't belong to you");
    }
    return order;
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
    return this.dataSource.transaction(async (manager) => {
      await this.wallet.releaseSellerEarnings(
        order.sellerId,
        order.id,
        order.sellerPayoutWaveCoin,
        undefined,
        manager,
      );
      order.status = OrderStatus.Completed;
      order.completedAt = new Date();
      const saved = await manager.save(order);
      await manager.increment(Listing, { id: order.listingId }, 'ordersCount', 1);
      return saved;
    });
  }

  private async cancelOrder(order: Order, reason: string): Promise<Order> {
    return this.dataSource.transaction(async (manager) => {
      await this.wallet.refundBuyer(order.buyerId, order.id, order.priceWaveCoin, manager);
      order.status = OrderStatus.Cancelled;
      order.cancelledAt = new Date();
      order.cancellationReason = reason;
      const saved = await manager.save(order);

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

      return saved;
    });
  }

  private async generateOrderNumber(manager: import('typeorm').EntityManager): Promise<string> {
    const result: Array<{ n: string }> = await manager.query(`SELECT nextval('order_number_seq') AS n`);
    return `WH-${result[0].n.padStart(6, '0')}`;
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
