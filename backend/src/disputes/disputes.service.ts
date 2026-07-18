import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { DisputeResolution, DisputeStatus, ListingStatus, ListingType, NotificationType, OrderStatus } from '@wavehub/shared-types';
import type { AdminDisputeSummary, PublicDispute } from '@wavehub/shared-types';
import { Dispute } from './dispute.entity';
import { DisputeMessage } from './dispute-message.entity';
import { DisputeEvidence } from './dispute-evidence.entity';
import { Order } from '../orders/order.entity';
import { Listing } from '../listings/listing.entity';
import { assertValidTransition } from '../orders/order-lifecycle';
import { assertValidTransition as assertValidListingTransition } from '../listings/listing-lifecycle';
import { WalletService } from '../wallet/wallet.service';
import { StorageService } from '../storage/storage.service';
import { ChatService } from '../chat/chat.service';
import { NotificationsService } from '../notifications/notifications.service';

const POSTGRES_UNIQUE_VIOLATION = '23505';
const DISPUTE_WINDOW_DAYS = 7;
const OPENABLE_STATUSES = [OrderStatus.Paid, OrderStatus.InProgress, OrderStatus.Delivered];
const ALLOWED_EVIDENCE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
];
const MAX_EVIDENCE_FILE_BYTES = 20 * 1024 * 1024;

// Maps a dispute resolution to the order status it produces — the one place that mapping is
// defined, so resolve() and its tests stay in sync with order-lifecycle.ts's transition map.
const RESOLUTION_TARGET_STATUS: Record<DisputeResolution, OrderStatus> = {
  [DisputeResolution.ReleaseToSeller]: OrderStatus.Completed,
  [DisputeResolution.RefundBuyer]: OrderStatus.Refunded,
  [DisputeResolution.CancelOrder]: OrderStatus.Cancelled,
};

@Injectable()
export class DisputesService {
  private readonly logger = new Logger(DisputesService.name);

  constructor(
    @InjectRepository(Dispute) private readonly disputes: Repository<Dispute>,
    @InjectRepository(DisputeMessage) private readonly messages: Repository<DisputeMessage>,
    @InjectRepository(DisputeEvidence) private readonly evidence: Repository<DisputeEvidence>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    private readonly dataSource: DataSource,
    private readonly wallet: WalletService,
    private readonly storage: StorageService,
    private readonly chat: ChatService,
    private readonly notifications: NotificationsService,
  ) {}

  // Same best-effort principle as postChatNotice below — a notification failure must never block
  // the dispute action itself.
  private async notify(userId: string, type: NotificationType, title: string, body: string, disputeId: string): Promise<void> {
    try {
      await this.notifications.emit(userId, type, title, body, { disputeId });
    } catch (err) {
      this.logger.error(`Failed to notify user ${userId} for dispute ${disputeId}`, err as Error);
    }
  }

  // Gated on: caller is the order's buyer or seller, the order is in an "open" enough status
  // (Paid/InProgress/Delivered), and — if Delivered — within DISPUTE_WINDOW_DAYS of delivery. One
  // dispute per order is enforced by the DB UNIQUE constraint on `orderId` (see the migration),
  // not just the pre-check below, so a race between two concurrent opens on the same order can't
  // slip through — the loser gets a clean 403, same pattern as
  // backend/src/reviews/reviews.service.ts#create.
  async open(userId: string, orderId: string, reason: string): Promise<PublicDispute> {
    const order = await this.orders.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.buyerId !== userId && order.sellerId !== userId) {
      throw new ForbiddenException("This order doesn't belong to you");
    }
    if (!OPENABLE_STATUSES.includes(order.status)) {
      throw new ForbiddenException('This order cannot be disputed in its current status');
    }
    if (order.status === OrderStatus.Delivered && order.deliveredAt) {
      const daysSinceDelivery = (Date.now() - order.deliveredAt.getTime()) / (24 * 60 * 60 * 1000);
      if (daysSinceDelivery > DISPUTE_WINDOW_DAYS) {
        throw new ForbiddenException(`Disputes must be opened within ${DISPUTE_WINDOW_DAYS} days of delivery`);
      }
    }
    assertValidTransition(order.status, OrderStatus.Disputed);

    let saved: Dispute;
    try {
      saved = await this.dataSource.transaction(async (manager) => {
        const dispute = manager.create(Dispute, {
          orderId: order.id,
          buyerId: order.buyerId,
          sellerId: order.sellerId,
          openedBy: userId,
          reason,
          status: DisputeStatus.Open,
        });
        const savedDispute = await manager.save(dispute);
        await manager.update(Order, order.id, { status: OrderStatus.Disputed });
        return savedDispute;
      });
    } catch (err: any) {
      if (err?.code === POSTGRES_UNIQUE_VIOLATION) {
        throw new ForbiddenException('A dispute already exists for this order');
      }
      throw err;
    }

    await this.postChatNotice(orderId, `დავა გაიხსნა: ${reason}`);
    const counterpart = userId === order.buyerId ? order.sellerId : order.buyerId;
    await this.notify(
      counterpart,
      NotificationType.DisputeOpened,
      'დავა გაიხსნა',
      `დავა გაიხსნა შეკვეთაზე #${order.orderNumber}: ${reason}`,
      saved.id,
    );
    return this.toPublic(saved, [], []);
  }

  async getForOrder(userId: string, orderId: string): Promise<PublicDispute> {
    const dispute = await this.getDisputeAsParticipant(userId, orderId);
    return this.loadPublic(dispute);
  }

  async addMessage(userId: string, orderId: string, body: string): Promise<PublicDispute> {
    const dispute = await this.getDisputeAsParticipant(userId, orderId);
    await this.messages.save(this.messages.create({ disputeId: dispute.id, senderId: userId, body }));
    return this.loadPublic(dispute);
  }

  async addEvidence(
    userId: string,
    orderId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
  ): Promise<PublicDispute> {
    const dispute = await this.getDisputeAsParticipant(userId, orderId);
    if (!ALLOWED_EVIDENCE_MIME_TYPES.includes(file.mimetype)) {
      throw new ForbiddenException('File type not allowed (JPG, PNG, WEBP, PDF, ZIP only)');
    }
    if (file.size > MAX_EVIDENCE_FILE_BYTES) {
      throw new ForbiddenException('File exceeds the 20MB size limit');
    }

    const stored = await this.storage.save(file.buffer, file.originalname);
    await this.evidence.save(
      this.evidence.create({
        disputeId: dispute.id,
        uploadedBy: userId,
        fileUrl: stored.url,
        fileType: file.mimetype,
      }),
    );
    return this.loadPublic(dispute);
  }

  // Admin-only — reached via `resolveForOrder` below, guarded by AdminGuard/@RequireAdminRole in
  // DisputesController (Super Admin only, per SPECIFICATION.md §5.13's CAN lists — see the
  // controller for the citation). This method itself does no role checking; `adminId` is whatever
  // the guard resolved the caller to.
  async resolve(
    disputeId: string,
    adminId: string,
    resolution: DisputeResolution,
    note: string,
  ): Promise<PublicDispute> {
    const dispute = await this.disputes.findOne({ where: { id: disputeId } });
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }
    if (dispute.status === DisputeStatus.Resolved || dispute.status === DisputeStatus.Closed) {
      throw new ForbiddenException('This dispute has already been resolved');
    }
    const order = await this.orders.findOne({ where: { id: dispute.orderId } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const targetStatus = RESOLUTION_TARGET_STATUS[resolution];
    assertValidTransition(order.status, targetStatus);

    await this.dataSource.transaction(async (manager) => {
      const now = new Date();

      if (resolution === DisputeResolution.ReleaseToSeller) {
        await this.wallet.releaseSellerEarnings(order.sellerId, order.id, order.sellerPayoutWaveCoin, undefined, manager);
        await manager.update(Order, order.id, { status: targetStatus, completedAt: now });
        await manager.increment(Listing, { id: order.listingId }, 'ordersCount', 1);
      } else {
        // RefundBuyer and CancelOrder both reverse the buyer's original debit — they differ only in
        // which terminal order status they land on (Refunded vs Cancelled), not in the money
        // movement itself. See RESOLUTION_TARGET_STATUS's comment for why these are distinct
        // resolutions despite the shared wallet call.
        await this.wallet.refundBuyer(order.buyerId, order.id, order.priceWaveCoin, manager);
        await manager.update(Order, order.id, {
          status: targetStatus,
          cancelledAt: now,
          cancellationReason: note,
        });

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
      }

      await manager.update(Dispute, dispute.id, {
        status: DisputeStatus.Resolved,
        resolution,
        resolutionNote: note,
        resolvedBy: adminId,
        resolvedAt: now,
      });
    });

    await this.postChatNotice(order.id, `დავა გადაწყდა: ${note}`);
    await this.notify(order.buyerId, NotificationType.DisputeResolved, 'დავა გადაწყდა', `დავა გადაწყდა შეკვეთაზე #${order.orderNumber}: ${note}`, dispute.id);
    await this.notify(order.sellerId, NotificationType.DisputeResolved, 'დავა გადაწყდა', `დავა გადაწყდა შეკვეთაზე #${order.orderNumber}: ${note}`, dispute.id);
    const resolved = await this.disputes.findOne({ where: { id: dispute.id } });
    return this.loadPublic(resolved!);
  }

  // Thin lookup wrapper so DisputesController's route (scoped under /orders/:orderId/dispute, like
  // every other route here) doesn't need to know a dispute's own id — an admin resolving a dispute
  // navigates to it via the order, same as everything else in this controller.
  async resolveForOrder(
    orderId: string,
    adminId: string,
    resolution: DisputeResolution,
    note: string,
  ): Promise<PublicDispute> {
    const dispute = await this.disputes.findOne({ where: { orderId } });
    if (!dispute) {
      throw new NotFoundException('No dispute exists for this order');
    }
    return this.resolve(dispute.id, adminId, resolution, note);
  }

  // Backs the admin `GET disputes` route (see admin-disputes.controller.ts) — the resolution
  // queue. `resolve`/`resolveForOrder` above have existed since Phase 8/11a but there was no way
  // to discover which orders actually have an open dispute short of already knowing the orderId,
  // same "built the action before the list" gap as Listings/Reviews. Only `Open` for now —
  // `UnderReview`/`WaitingForEvidence` are defined in the enum but nothing sets them yet (see
  // disputes/CLAUDE.md).
  async listOpen(): Promise<AdminDisputeSummary[]> {
    const disputes = await this.disputes.find({
      where: { status: DisputeStatus.Open },
      relations: ['order'],
      order: { createdAt: 'ASC' },
    });
    return disputes.map((d) => ({
      id: d.id,
      orderId: d.orderId,
      orderNumber: d.order.orderNumber,
      buyerId: d.buyerId,
      sellerId: d.sellerId,
      status: d.status,
      reason: d.reason,
      createdAt: d.createdAt.toISOString(),
    }));
  }

  // Admin view of a dispute's full thread (messages + evidence) — no participant check, unlike
  // getForOrder. Backs `GET disputes/:orderId` (admin-disputes.controller.ts), which an admin
  // needs before resolve() can be a real, evidence-informed decision rather than a blind action by
  // orderId. Super-Admin-only, matching resolve's own gating — see that route's comment for why
  // broader roles aren't wired here yet.
  async getForOrderAsAdmin(orderId: string): Promise<PublicDispute> {
    const dispute = await this.disputes.findOne({ where: { orderId } });
    if (!dispute) {
      throw new NotFoundException('No dispute exists for this order');
    }
    return this.loadPublic(dispute);
  }

  private async getDisputeAsParticipant(userId: string, orderId: string): Promise<Dispute> {
    const dispute = await this.disputes.findOne({ where: { orderId } });
    if (!dispute) {
      throw new NotFoundException('No dispute exists for this order');
    }
    if (dispute.buyerId !== userId && dispute.sellerId !== userId) {
      throw new ForbiddenException("This dispute doesn't belong to you");
    }
    return dispute;
  }

  // No ownership check — callers that already know they're allowed to see this dispute (a
  // participant, verified by getDisputeAsParticipant, or an admin resolving it) call this
  // directly. Don't expose this without a check upstream.
  private async loadPublic(dispute: Dispute): Promise<PublicDispute> {
    const [messages, evidence] = await Promise.all([
      this.messages.find({ where: { disputeId: dispute.id }, relations: ['sender'], order: { createdAt: 'ASC' } }),
      this.evidence.find({ where: { disputeId: dispute.id }, order: { createdAt: 'ASC' } }),
    ]);
    return this.toPublic(dispute, messages, evidence);
  }

  // Best-effort — a dispute event notice in the order's regular chat is a nice-to-have, never
  // allowed to fail the dispute action that triggered it. Same pattern as
  // backend/src/orders/orders.service.ts's private postSystemMessage helper.
  private async postChatNotice(orderId: string, body: string): Promise<void> {
    try {
      await this.chat.postSystemMessage(orderId, body);
    } catch (err) {
      this.logger.error(`Failed to post dispute chat notice for order ${orderId}`, err as Error);
    }
  }

  private toPublic(dispute: Dispute, messages: DisputeMessage[], evidence: DisputeEvidence[]): PublicDispute {
    return {
      id: dispute.id,
      orderId: dispute.orderId,
      buyerId: dispute.buyerId,
      sellerId: dispute.sellerId,
      openedBy: dispute.openedBy,
      reason: dispute.reason,
      status: dispute.status,
      resolution: dispute.resolution,
      resolutionNote: dispute.resolutionNote,
      resolvedBy: dispute.resolvedBy,
      resolvedAt: dispute.resolvedAt?.toISOString() ?? null,
      createdAt: dispute.createdAt.toISOString(),
      messages: messages.map((message) => ({
        id: message.id,
        senderId: message.senderId,
        senderUsername: message.sender?.username ?? '',
        body: message.body,
        createdAt: message.createdAt.toISOString(),
      })),
      evidence: evidence.map((file) => ({
        id: file.id,
        fileUrl: file.fileUrl,
        fileType: file.fileType,
        uploadedBy: file.uploadedBy,
        createdAt: file.createdAt.toISOString(),
      })),
    };
  }
}
