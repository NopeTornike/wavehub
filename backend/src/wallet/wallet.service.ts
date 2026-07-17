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
}
