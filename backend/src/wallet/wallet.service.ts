import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { WalletLedgerStatus, WalletLedgerType } from '@wavehub/shared-types';
import { User } from '../users/user.entity';
import { WalletLedgerEntry } from './wallet-ledger-entry.entity';

const DEFAULT_HOLD_DAYS = 7;

// The single place allowed to change `users.wavecoinBalance`. Every method here runs inside one
// DB transaction that both updates the balance and writes the matching wallet_ledger_entries row
// — never do one without the other. See CLAUDE.md in this directory for the full model.
@Injectable()
export class WalletService {
  constructor(private readonly dataSource: DataSource) {}

  // Credits a buyer's balance after a successful real-money top-up (currently: BOG). Idempotent on
  // `reference` (the BOG transactionId) — safe to call more than once for the same payment, e.g.
  // if BOG retries its callback. Returns the existing entry on a duplicate call instead of
  // double-crediting.
  async recordTopup(userId: string, amountWaveCoin: number, reference: string): Promise<WalletLedgerEntry> {
    if (amountWaveCoin <= 0) {
      throw new Error('amountWaveCoin must be positive');
    }

    return this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(WalletLedgerEntry, { where: { reference } });
      if (existing) {
        return existing;
      }

      const user = await manager.findOne(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }

      const balanceAfter = user.wavecoinBalance + amountWaveCoin;
      await manager.update(User, userId, { wavecoinBalance: balanceAfter });

      const entry = manager.create(WalletLedgerEntry, {
        userId,
        orderId: null,
        type: WalletLedgerType.Topup,
        amountWaveCoin,
        balanceAfter,
        status: WalletLedgerStatus.Available,
        reference,
      });
      return manager.save(entry);
    });
  }

  // Moves funds out of a buyer's spendable balance at checkout. Throws INSUFFICIENT_BALANCE
  // rather than allowing a negative balance — callers (Order creation, once it exists) must not
  // create an order if this throws. `orderId` has no FK yet (see WalletLedgerEntry) since Orders
  // don't exist until build-plan Phase 5; this method is built ahead of that phase intentionally.
  async debitForOrder(userId: string, orderId: string, amountWaveCoin: number): Promise<WalletLedgerEntry> {
    if (amountWaveCoin <= 0) {
      throw new Error('amountWaveCoin must be positive');
    }

    return this.dataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }
      if (user.wavecoinBalance < amountWaveCoin) {
        throw new Error('INSUFFICIENT_BALANCE');
      }

      const balanceAfter = user.wavecoinBalance - amountWaveCoin;
      await manager.update(User, userId, { wavecoinBalance: balanceAfter });

      const entry = manager.create(WalletLedgerEntry, {
        userId,
        orderId,
        type: WalletLedgerType.OrderEscrowHold,
        amountWaveCoin: -amountWaveCoin,
        balanceAfter,
        status: WalletLedgerStatus.Held,
      });
      return manager.save(entry);
    });
  }

  // Credits a seller once an order completes (buyer accepted / auto-completed / admin decided in
  // the seller's favor). The full order price is credited immediately — WaveHub's cut is simply
  // the difference between what the buyer was debited and what the seller receives here, so no
  // separate ledger row is written for the platform fee (there's no "house" user account in this
  // schema to attribute it to; a revenue report can derive it from Order data once Orders exist —
  // see build-plan Phase 11, Revenue Dashboard). `status: pending` + `availableAt` model
  // *withdrawal* eligibility, not balance ownership — the coins are the seller's the moment this
  // entry is written; see backend/src/wallet/CLAUDE.md for why there's no separate "hold" step.
  async releaseSellerEarnings(
    sellerId: string,
    orderId: string,
    sellerReceivesWaveCoin: number,
    holdDays: number = DEFAULT_HOLD_DAYS,
  ): Promise<WalletLedgerEntry> {
    if (sellerReceivesWaveCoin <= 0) {
      throw new Error('sellerReceivesWaveCoin must be positive');
    }

    return this.dataSource.transaction(async (manager) => {
      const seller = await manager.findOne(User, {
        where: { id: sellerId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!seller) {
        throw new Error('USER_NOT_FOUND');
      }

      const balanceAfter = seller.wavecoinBalance + sellerReceivesWaveCoin;
      await manager.update(User, sellerId, { wavecoinBalance: balanceAfter });

      const entry = manager.create(WalletLedgerEntry, {
        userId: sellerId,
        orderId,
        type: WalletLedgerType.OrderRelease,
        amountWaveCoin: sellerReceivesWaveCoin,
        balanceAfter,
        status: WalletLedgerStatus.Pending,
        availableAt: new Date(Date.now() + holdDays * 24 * 60 * 60 * 1000),
      });
      return manager.save(entry);
    });
  }

  // Reverses a buyer's original escrow debit on refund/cancellation. Does NOT touch any seller
  // balance — a refund and a seller payout are mutually exclusive outcomes for the same order, and
  // it's the caller's (future Disputes/Orders module's) job to only call one of the two.
  async refundBuyer(buyerId: string, orderId: string, amountWaveCoin: number): Promise<WalletLedgerEntry> {
    if (amountWaveCoin <= 0) {
      throw new Error('amountWaveCoin must be positive');
    }

    return this.dataSource.transaction(async (manager) => {
      const buyer = await manager.findOne(User, {
        where: { id: buyerId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!buyer) {
        throw new Error('USER_NOT_FOUND');
      }

      const balanceAfter = buyer.wavecoinBalance + amountWaveCoin;
      await manager.update(User, buyerId, { wavecoinBalance: balanceAfter });

      const entry = manager.create(WalletLedgerEntry, {
        userId: buyerId,
        orderId,
        type: WalletLedgerType.OrderRefund,
        amountWaveCoin,
        balanceAfter,
        status: WalletLedgerStatus.Available,
      });
      return manager.save(entry);
    });
  }
}
