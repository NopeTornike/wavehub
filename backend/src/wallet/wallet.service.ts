import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { WalletLedgerStatus, WalletLedgerType } from '@wavehub/shared-types';
import { User } from '../users/user.entity';
import { WalletLedgerEntry } from './wallet-ledger-entry.entity';

const DEFAULT_HOLD_DAYS = 7;

// The single place allowed to change `users.wavecoinBalance`. Every method here runs inside one
// DB transaction that both updates the balance and writes the matching wallet_ledger_entries row
// — never do one without the other. See CLAUDE.md in this directory for the full model.
//
// Every method accepts an optional `manager` — pass one when this call must be atomic with other
// writes in the same transaction (e.g. OrdersService creating an Order row and debiting the buyer
// together: if the debit fails, the Order insert must roll back too, not be compensated after the
// fact). Omit it to let the method open its own transaction, for standalone callers like the BOG
// top-up callback.
@Injectable()
export class WalletService {
  constructor(private readonly dataSource: DataSource) {}

  async recordTopup(
    userId: string,
    amountWaveCoin: number,
    reference: string,
    manager?: EntityManager,
  ): Promise<WalletLedgerEntry> {
    if (amountWaveCoin <= 0) {
      throw new Error('amountWaveCoin must be positive');
    }

    const run = async (m: EntityManager) => {
      const existing = await m.findOne(WalletLedgerEntry, { where: { reference } });
      if (existing) {
        return existing;
      }

      const user = await m.findOne(User, { where: { id: userId }, lock: { mode: 'pessimistic_write' } });
      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }

      const balanceAfter = user.wavecoinBalance + amountWaveCoin;
      await m.update(User, userId, { wavecoinBalance: balanceAfter });

      const entry = m.create(WalletLedgerEntry, {
        userId,
        orderId: null,
        type: WalletLedgerType.Topup,
        amountWaveCoin,
        balanceAfter,
        status: WalletLedgerStatus.Available,
        reference,
      });
      return m.save(entry);
    };

    return manager ? run(manager) : this.dataSource.transaction(run);
  }

  // Moves funds out of a buyer's spendable balance at checkout. Throws INSUFFICIENT_BALANCE
  // rather than allowing a negative balance — callers must not create an order if this throws (or,
  // when composed into the caller's own transaction via `manager`, the whole transaction rolls
  // back, so the order row never persists).
  async debitForOrder(
    userId: string,
    orderId: string,
    amountWaveCoin: number,
    manager?: EntityManager,
  ): Promise<WalletLedgerEntry> {
    if (amountWaveCoin <= 0) {
      throw new Error('amountWaveCoin must be positive');
    }

    const run = async (m: EntityManager) => {
      const user = await m.findOne(User, { where: { id: userId }, lock: { mode: 'pessimistic_write' } });
      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }
      if (user.wavecoinBalance < amountWaveCoin) {
        throw new Error('INSUFFICIENT_BALANCE');
      }

      const balanceAfter = user.wavecoinBalance - amountWaveCoin;
      await m.update(User, userId, { wavecoinBalance: balanceAfter });

      const entry = m.create(WalletLedgerEntry, {
        userId,
        orderId,
        type: WalletLedgerType.OrderEscrowHold,
        amountWaveCoin: -amountWaveCoin,
        balanceAfter,
        status: WalletLedgerStatus.Held,
      });
      return m.save(entry);
    };

    return manager ? run(manager) : this.dataSource.transaction(run);
  }

  // Credits a seller once an order completes (buyer accepted / auto-completed / admin decided in
  // the seller's favor). The full order price is credited immediately — WaveHub's cut is simply
  // the difference between what the buyer was debited and what the seller receives here, so no
  // separate ledger row is written for the platform fee (there's no "house" user account in this
  // schema to attribute it to; a revenue report can derive it from Order data — see build-plan
  // Phase 11, Revenue Dashboard). `status: pending` + `availableAt` model *withdrawal* eligibility,
  // not balance ownership — the coins are the seller's the moment this entry is written; see
  // backend/src/wallet/CLAUDE.md for why there's no separate "hold" step.
  async releaseSellerEarnings(
    sellerId: string,
    orderId: string,
    sellerReceivesWaveCoin: number,
    holdDays: number = DEFAULT_HOLD_DAYS,
    manager?: EntityManager,
  ): Promise<WalletLedgerEntry> {
    if (sellerReceivesWaveCoin <= 0) {
      throw new Error('sellerReceivesWaveCoin must be positive');
    }

    const run = async (m: EntityManager) => {
      const seller = await m.findOne(User, { where: { id: sellerId }, lock: { mode: 'pessimistic_write' } });
      if (!seller) {
        throw new Error('USER_NOT_FOUND');
      }

      const balanceAfter = seller.wavecoinBalance + sellerReceivesWaveCoin;
      await m.update(User, sellerId, { wavecoinBalance: balanceAfter });

      const entry = m.create(WalletLedgerEntry, {
        userId: sellerId,
        orderId,
        type: WalletLedgerType.OrderRelease,
        amountWaveCoin: sellerReceivesWaveCoin,
        balanceAfter,
        status: WalletLedgerStatus.Pending,
        availableAt: new Date(Date.now() + holdDays * 24 * 60 * 60 * 1000),
      });
      return m.save(entry);
    };

    return manager ? run(manager) : this.dataSource.transaction(run);
  }

  // Reverses a buyer's original escrow debit on refund/cancellation. Does NOT touch any seller
  // balance — a refund and a seller payout are mutually exclusive outcomes for the same order, and
  // it's the caller's job to only call one of the two.
  async refundBuyer(
    buyerId: string,
    orderId: string,
    amountWaveCoin: number,
    manager?: EntityManager,
  ): Promise<WalletLedgerEntry> {
    if (amountWaveCoin <= 0) {
      throw new Error('amountWaveCoin must be positive');
    }

    const run = async (m: EntityManager) => {
      const buyer = await m.findOne(User, { where: { id: buyerId }, lock: { mode: 'pessimistic_write' } });
      if (!buyer) {
        throw new Error('USER_NOT_FOUND');
      }

      const balanceAfter = buyer.wavecoinBalance + amountWaveCoin;
      await m.update(User, buyerId, { wavecoinBalance: balanceAfter });

      const entry = m.create(WalletLedgerEntry, {
        userId: buyerId,
        orderId,
        type: WalletLedgerType.OrderRefund,
        amountWaveCoin,
        balanceAfter,
        status: WalletLedgerStatus.Available,
      });
      return m.save(entry);
    };

    return manager ? run(manager) : this.dataSource.transaction(run);
  }

  // Reserves funds for a withdrawal request at the moment it's created — debits `wavecoinBalance`
  // immediately (same "debit now, not on admin approval" principle as `debitForOrder`), so a
  // seller can't request a withdrawal and then also spend the same coins on a purchase before an
  // admin gets to it. `reference` is `withdraw:<withdrawRequestId>` — unique, so a duplicate call
  // (e.g. a network retry) for the same request is a no-op rather than a double debit, same
  // idempotency pattern as `recordTopup`.
  async holdForWithdrawal(
    userId: string,
    amountWaveCoin: number,
    withdrawRequestId: string,
    manager?: EntityManager,
  ): Promise<WalletLedgerEntry> {
    if (amountWaveCoin <= 0) {
      throw new Error('amountWaveCoin must be positive');
    }
    const reference = `withdraw:${withdrawRequestId}`;

    const run = async (m: EntityManager) => {
      const existing = await m.findOne(WalletLedgerEntry, { where: { reference } });
      if (existing) {
        return existing;
      }

      const user = await m.findOne(User, { where: { id: userId }, lock: { mode: 'pessimistic_write' } });
      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }
      if (user.wavecoinBalance < amountWaveCoin) {
        throw new Error('INSUFFICIENT_BALANCE');
      }

      const balanceAfter = user.wavecoinBalance - amountWaveCoin;
      await m.update(User, userId, { wavecoinBalance: balanceAfter });

      const entry = m.create(WalletLedgerEntry, {
        userId,
        orderId: null,
        type: WalletLedgerType.Withdrawal,
        amountWaveCoin: -amountWaveCoin,
        balanceAfter,
        status: WalletLedgerStatus.Held,
        reference,
      });
      return m.save(entry);
    };

    return manager ? run(manager) : this.dataSource.transaction(run);
  }

  // Reverses a held withdrawal when an admin rejects or the seller cancels it — credits
  // `wavecoinBalance` back. Writes a new entry rather than mutating the original hold entry;
  // ledger rows are append-only, see wallet/CLAUDE.md.
  async reverseWithdrawal(
    userId: string,
    amountWaveCoin: number,
    withdrawRequestId: string,
    manager?: EntityManager,
  ): Promise<WalletLedgerEntry> {
    if (amountWaveCoin <= 0) {
      throw new Error('amountWaveCoin must be positive');
    }
    const reference = `withdraw-reversed:${withdrawRequestId}`;

    const run = async (m: EntityManager) => {
      const existing = await m.findOne(WalletLedgerEntry, { where: { reference } });
      if (existing) {
        return existing;
      }

      const user = await m.findOne(User, { where: { id: userId }, lock: { mode: 'pessimistic_write' } });
      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }

      const balanceAfter = user.wavecoinBalance + amountWaveCoin;
      await m.update(User, userId, { wavecoinBalance: balanceAfter });

      const entry = m.create(WalletLedgerEntry, {
        userId,
        orderId: null,
        type: WalletLedgerType.Withdrawal,
        amountWaveCoin,
        balanceAfter,
        status: WalletLedgerStatus.Reversed,
        reference,
      });
      return m.save(entry);
    };

    return manager ? run(manager) : this.dataSource.transaction(run);
  }

  // Derived view over the ledger — see packages/shared-types' PublicWalletBalance for what each
  // field means. Deliberately does NOT include withdrawal-request-specific numbers
  // (pendingWithdrawal/totalWithdrawn) — this module has no access to `WithdrawRequest` (that's
  // backend/src/withdrawals/, which depends on this module, not the other way around).
  // `WithdrawalsService#getBalanceSummary` composes this with its own numbers into the full
  // `PublicWalletBalance` the frontend actually renders.
  async getBalanceSummary(userId: string): Promise<{
    walletBalance: number;
    totalEarned: number;
    pendingClearance: number;
    availableToWithdraw: number;
  }> {
    const user = await this.dataSource.getRepository(User).findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    const repo = this.dataSource.getRepository(WalletLedgerEntry);
    const now = new Date();

    const totalEarned = await this.sumEntries(repo, userId, WalletLedgerType.OrderRelease);
    const pendingClearance = await this.sumEntries(repo, userId, WalletLedgerType.OrderRelease, (qb) =>
      qb.andWhere('e.availableAt > :now', { now }),
    );
    const clearedEarnings = totalEarned - pendingClearance;

    return {
      walletBalance: user.wavecoinBalance,
      totalEarned,
      pendingClearance,
      // Capped by the actual current balance — a seller who already spent earned coins on a
      // purchase can't request a withdrawal against money they no longer have. See this method's
      // own comment above for the fuller reasoning.
      availableToWithdraw: Math.max(0, Math.min(user.wavecoinBalance, clearedEarnings)),
    };
  }

  // Paginated raw ledger history — "order earnings, withdrawals, refunds, adjustments" per the
  // source spec's §5.6. Newest first.
  async listTransactions(userId: string, limit: number, offset: number): Promise<WalletLedgerEntry[]> {
    return this.dataSource.getRepository(WalletLedgerEntry).find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  private async sumEntries(
    repo: import('typeorm').Repository<WalletLedgerEntry>,
    userId: string,
    type: WalletLedgerType,
    extra?: (qb: import('typeorm').SelectQueryBuilder<WalletLedgerEntry>) => void,
  ): Promise<number> {
    const qb = repo
      .createQueryBuilder('e')
      .select('COALESCE(SUM(e.amountWaveCoin), 0)', 'sum')
      .where('e.userId = :userId', { userId })
      .andWhere('e.type = :type', { type });
    if (extra) {
      extra(qb);
    }
    const { sum } = await qb.getRawOne<{ sum: string }>();
    return Number(sum);
  }
}
