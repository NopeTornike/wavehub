import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Not, In, Repository } from 'typeorm';
import { DisputeStatus, NotificationType, WithdrawStatus } from '@wavehub/shared-types';
import type { PublicWalletBalance, PublicWithdrawRequest } from '@wavehub/shared-types';
import { WithdrawRequest } from './withdraw-request.entity';
import { Dispute } from '../disputes/dispute.entity';
import { assertValidTransition } from './withdraw-lifecycle';
import { CreateWithdrawRequestDto } from './dto/create-withdraw-request.dto';
import { WalletService } from '../wallet/wallet.service';
import { NotificationsService } from '../notifications/notifications.service';

// SPECIFICATION.md §5.6: "Minimum withdrawal $20 (recommended default, should be
// admin-configurable)" — 1 GEL/WaveCoin at the current fixed top-up rate (see
// backend/src/payments/CLAUDE.md), so 20 WaveCoin. Hardcoded for now, same tradeoff as the
// platform fee constant in orders.service.ts — becomes admin-configurable in build-plan Phase
// 11f (Platform Settings), not before.
const MIN_WITHDRAWAL_WAVECOIN = 20;

const STATUS_LABELS_KA: Record<WithdrawStatus, string> = {
  [WithdrawStatus.Pending]: 'მოლოდინში',
  [WithdrawStatus.Processing]: 'მუშავდება',
  [WithdrawStatus.Completed]: 'შესრულებულია',
  [WithdrawStatus.Rejected]: 'უარყოფილია',
  [WithdrawStatus.Cancelled]: 'გაუქმებულია',
};

@Injectable()
export class WithdrawalsService {
  private readonly logger = new Logger(WithdrawalsService.name);

  constructor(
    @InjectRepository(WithdrawRequest) private readonly withdrawals: Repository<WithdrawRequest>,
    @InjectRepository(Dispute) private readonly disputes: Repository<Dispute>,
    private readonly dataSource: DataSource,
    private readonly wallet: WalletService,
    private readonly notifications: NotificationsService,
  ) {}

  // Gated on: amount >= MIN_WITHDRAWAL_WAVECOIN, no active dispute for this seller (any status
  // that isn't Resolved/Closed — a fresh Open dispute should block just as much as one already
  // UnderReview), and amount <= the derived availableToWithdraw ceiling (see
  // WalletService#getBalanceSummary for why that's capped at the current wallet balance, not just
  // cleared earnings). The WithdrawRequest insert and the wallet hold happen in one transaction —
  // same "atomic, not compensated after the fact" principle as OrdersService.purchase.
  async request(sellerId: string, dto: CreateWithdrawRequestDto): Promise<PublicWithdrawRequest> {
    if (dto.amountWaveCoin < MIN_WITHDRAWAL_WAVECOIN) {
      throw new ForbiddenException(`Minimum withdrawal is ${MIN_WITHDRAWAL_WAVECOIN} WaveCoin`);
    }

    const activeDispute = await this.disputes.findOne({
      where: { sellerId, status: Not(In([DisputeStatus.Resolved, DisputeStatus.Closed])) },
    });
    if (activeDispute) {
      throw new ForbiddenException('Withdrawals are blocked while you have an active dispute');
    }

    const summary = await this.wallet.getBalanceSummary(sellerId);
    if (dto.amountWaveCoin > summary.availableToWithdraw) {
      throw new ForbiddenException('Requested amount exceeds your available balance');
    }

    const saved = await this.dataSource.transaction(async (manager) => {
      const request = manager.create(WithdrawRequest, {
        sellerId,
        amountWaveCoin: dto.amountWaveCoin,
        method: dto.method,
        payoutDetails: dto.payoutDetails,
        status: WithdrawStatus.Pending,
      });
      const savedRequest = await manager.save(request);
      await this.wallet.holdForWithdrawal(sellerId, dto.amountWaveCoin, savedRequest.id, manager);
      return savedRequest;
    });

    return this.toPublic(saved);
  }

  async listMine(sellerId: string): Promise<PublicWithdrawRequest[]> {
    const rows = await this.withdrawals.find({ where: { sellerId }, order: { createdAt: 'DESC' } });
    return rows.map((row) => this.toPublic(row));
  }

  async cancel(sellerId: string, id: string): Promise<PublicWithdrawRequest> {
    const request = await this.getOwnedOrThrow(sellerId, id);
    assertValidTransition(request.status, WithdrawStatus.Cancelled);

    await this.dataSource.transaction(async (manager) => {
      await manager.update(WithdrawRequest, id, { status: WithdrawStatus.Cancelled, processedAt: new Date() });
      await this.wallet.reverseWithdrawal(sellerId, request.amountWaveCoin, id, manager);
    });

    return this.toPublic({ ...request, status: WithdrawStatus.Cancelled });
  }

  // Admin-only — reached via a guarded route (backend/src/admin/CLAUDE.md); this method itself
  // does no role checking. `Rejected` reverses the held funds back to the seller; `Processing`
  // and `Completed` are administrative status updates only — the money already left the seller's
  // spendable balance the moment the request was created.
  async process(adminId: string, id: string, status: WithdrawStatus, note?: string): Promise<PublicWithdrawRequest> {
    const request = await this.withdrawals.findOne({ where: { id } });
    if (!request) {
      throw new NotFoundException('Withdrawal request not found');
    }
    assertValidTransition(request.status, status);

    await this.dataSource.transaction(async (manager) => {
      await manager.update(WithdrawRequest, id, {
        status,
        adminNote: note ?? null,
        processedBy: adminId,
        processedAt: new Date(),
      });
      if (status === WithdrawStatus.Rejected) {
        await this.wallet.reverseWithdrawal(request.sellerId, request.amountWaveCoin, id, manager);
      }
    });

    try {
      await this.notifications.emit(
        request.sellerId,
        NotificationType.WithdrawalStatusChanged,
        'გატანის მოთხოვნის სტატუსი შეიცვალა',
        `თქვენი გატანის მოთხოვნა (${request.amountWaveCoin} WC) ${STATUS_LABELS_KA[status]}${note ? `: ${note}` : ''}`,
        { withdrawRequestId: id },
      );
    } catch (err) {
      this.logger.error(`Failed to notify seller ${request.sellerId} of withdrawal status change`, err as Error);
    }

    const updated = await this.withdrawals.findOne({ where: { id } });
    return this.toPublic(updated!);
  }

  // Composes WalletService's ledger-derived numbers with this module's own WithdrawRequest sums
  // into the full PublicWalletBalance the frontend renders — see wallet/CLAUDE.md for why that
  // composition happens here and not in WalletService itself (dependency direction: this module
  // depends on wallet, not the other way around).
  async getBalanceSummary(sellerId: string): Promise<PublicWalletBalance> {
    const base = await this.wallet.getBalanceSummary(sellerId);
    const pendingWithdrawal = await this.sumWithdrawRequests(sellerId, [
      WithdrawStatus.Pending,
      WithdrawStatus.Processing,
    ]);
    const totalWithdrawn = await this.sumWithdrawRequests(sellerId, [WithdrawStatus.Completed]);
    return { ...base, pendingWithdrawal, totalWithdrawn };
  }

  private async sumWithdrawRequests(sellerId: string, statuses: WithdrawStatus[]): Promise<number> {
    const result = await this.withdrawals
      .createQueryBuilder('w')
      .select('COALESCE(SUM(w.amountWaveCoin), 0)', 'sum')
      .where('w.sellerId = :sellerId', { sellerId })
      .andWhere('w.status IN (:...statuses)', { statuses })
      .getRawOne<{ sum: string }>();
    return Number(result?.sum ?? 0);
  }

  private async getOwnedOrThrow(sellerId: string, id: string): Promise<WithdrawRequest> {
    const request = await this.withdrawals.findOne({ where: { id } });
    if (!request) {
      throw new NotFoundException('Withdrawal request not found');
    }
    if (request.sellerId !== sellerId) {
      throw new ForbiddenException("This withdrawal request doesn't belong to you");
    }
    return request;
  }

  private toPublic(request: WithdrawRequest): PublicWithdrawRequest {
    return {
      id: request.id,
      amountWaveCoin: request.amountWaveCoin,
      method: request.method,
      status: request.status,
      adminNote: request.adminNote,
      createdAt: request.createdAt.toISOString(),
      processedAt: request.processedAt?.toISOString() ?? null,
    };
  }
}
