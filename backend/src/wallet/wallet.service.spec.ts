import { WalletLedgerStatus, WalletLedgerType } from '@wavehub/shared-types';
import { User } from '../users/user.entity';
import { WalletLedgerEntry } from './wallet-ledger-entry.entity';
import { WalletService } from './wallet.service';

// A minimal in-memory fake standing in for TypeORM's EntityManager, scoped to exactly what
// WalletService calls (findOne/update/create/save). This exercises the real transaction-shaped
// control flow (insufficient balance throws before any write, idempotent lookups short-circuit,
// balanceAfter is computed correctly) without needing a live Postgres connection — the "does this
// actually persist correctly against real Postgres" question is CI's job (see wallet/CLAUDE.md).
function createFakeDataSource(initialUsers: Array<{ id: string; wavecoinBalance: number }>) {
  const users = new Map(initialUsers.map((u) => [u.id, { ...u }]));
  const ledgerEntries: any[] = [];

  const manager = {
    findOne: jest.fn(async (entityClass: any, options: any) => {
      if (entityClass === User) {
        return users.get(options.where.id) ?? null;
      }
      if (entityClass === WalletLedgerEntry) {
        return ledgerEntries.find((e) => e.reference === options.where.reference) ?? null;
      }
      return null;
    }),
    update: jest.fn(async (entityClass: any, id: string, partial: any) => {
      if (entityClass === User) {
        const user = users.get(id);
        if (user) Object.assign(user, partial);
      }
    }),
    create: jest.fn((_entityClass: any, data: any) => ({ ...data })),
    save: jest.fn(async (entity: any) => {
      const saved = { ...entity, id: entity.id ?? `entry-${ledgerEntries.length + 1}` };
      ledgerEntries.push(saved);
      return saved;
    }),
  };

  const dataSource = { transaction: jest.fn(async (cb: any) => cb(manager)) } as any;
  return { dataSource, users, ledgerEntries };
}

describe('WalletService', () => {
  const userId = 'user-1';

  it('recordTopup credits the balance and writes an available ledger entry', async () => {
    const { dataSource, users, ledgerEntries } = createFakeDataSource([
      { id: userId, wavecoinBalance: 50 },
    ]);
    const wallet = new WalletService(dataSource);

    const entry = await wallet.recordTopup(userId, 100, 'bog-tx-1');

    expect(users.get(userId)?.wavecoinBalance).toBe(150);
    expect(entry.balanceAfter).toBe(150);
    expect(entry.type).toBe(WalletLedgerType.Topup);
    expect(entry.status).toBe(WalletLedgerStatus.Available);
    expect(ledgerEntries).toHaveLength(1);
  });

  it('recordTopup takes the user row lock before the reference check so racing duplicates serialize', async () => {
    const calls: string[] = [];
    const existing = { id: 'e1', reference: 'ref-race' };
    const manager = {
      findOne: jest.fn(async (entity: any, opts: any) => {
        calls.push(opts.lock ? 'lock-user' : 'check-reference');
        return opts.lock ? { id: userId, wavecoinBalance: 100 } : existing;
      }),
      update: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as any;
    const wallet = new WalletService({ transaction: jest.fn(async (cb: any) => cb(manager)) } as any);
    const entry = await wallet.recordTopup(userId, 50, 'ref-race');
    expect(calls).toEqual(['lock-user', 'check-reference']);
    expect(entry).toBe(existing);
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('recordTopup is idempotent on reference — a repeat call does not double-credit', async () => {
    const { dataSource, users, ledgerEntries } = createFakeDataSource([
      { id: userId, wavecoinBalance: 0 },
    ]);
    const wallet = new WalletService(dataSource);

    const first = await wallet.recordTopup(userId, 100, 'bog-tx-retry');
    const second = await wallet.recordTopup(userId, 100, 'bog-tx-retry');

    expect(users.get(userId)?.wavecoinBalance).toBe(100);
    expect(ledgerEntries).toHaveLength(1);
    expect(second).toEqual(first);
  });

  it('debitForOrder rejects when the balance is insufficient and writes nothing', async () => {
    const { dataSource, users, ledgerEntries } = createFakeDataSource([
      { id: userId, wavecoinBalance: 10 },
    ]);
    const wallet = new WalletService(dataSource);

    await expect(wallet.debitForOrder(userId, 'order-1', 20)).rejects.toThrow('INSUFFICIENT_BALANCE');
    expect(users.get(userId)?.wavecoinBalance).toBe(10);
    expect(ledgerEntries).toHaveLength(0);
  });

  it('debitForOrder moves funds out of the buyer balance as a held, negative entry', async () => {
    const { dataSource, users } = createFakeDataSource([{ id: userId, wavecoinBalance: 100 }]);
    const wallet = new WalletService(dataSource);

    const entry = await wallet.debitForOrder(userId, 'order-1', 40);

    expect(users.get(userId)?.wavecoinBalance).toBe(60);
    expect(entry.amountWaveCoin).toBe(-40);
    expect(entry.status).toBe(WalletLedgerStatus.Held);
    expect(entry.type).toBe(WalletLedgerType.OrderEscrowHold);
  });

  it('releaseSellerEarnings credits the seller with a pending, time-gated entry', async () => {
    const sellerId = 'seller-1';
    const { dataSource, users } = createFakeDataSource([{ id: sellerId, wavecoinBalance: 0 }]);
    const wallet = new WalletService(dataSource);

    const before = Date.now();
    const entry = await wallet.releaseSellerEarnings(sellerId, 'order-1', 18, 7);

    expect(users.get(sellerId)?.wavecoinBalance).toBe(18);
    expect(entry.status).toBe(WalletLedgerStatus.Pending);
    expect(entry.availableAt).toBeInstanceOf(Date);
    expect(entry.availableAt!.getTime()).toBeGreaterThan(before + 6 * 24 * 60 * 60 * 1000);
  });

  it('refundBuyer credits the buyer back and does not touch any other balance', async () => {
    const { dataSource, users } = createFakeDataSource([{ id: userId, wavecoinBalance: 10 }]);
    const wallet = new WalletService(dataSource);

    const entry = await wallet.refundBuyer(userId, 'order-1', 40);

    expect(users.get(userId)?.wavecoinBalance).toBe(50);
    expect(entry.type).toBe(WalletLedgerType.OrderRefund);
    expect(entry.status).toBe(WalletLedgerStatus.Available);
  });

  it('holdForWithdrawal debits the balance as a held, negative withdrawal entry', async () => {
    const { dataSource, users } = createFakeDataSource([{ id: userId, wavecoinBalance: 100 }]);
    const wallet = new WalletService(dataSource);

    const entry = await wallet.holdForWithdrawal(userId, 30, 'withdraw-1');

    expect(users.get(userId)?.wavecoinBalance).toBe(70);
    expect(entry.amountWaveCoin).toBe(-30);
    expect(entry.status).toBe(WalletLedgerStatus.Held);
    expect(entry.type).toBe(WalletLedgerType.Withdrawal);
    expect(entry.reference).toBe('withdraw:withdraw-1');
  });

  it('holdForWithdrawal rejects when the balance is insufficient', async () => {
    const { dataSource, users } = createFakeDataSource([{ id: userId, wavecoinBalance: 5 }]);
    const wallet = new WalletService(dataSource);

    await expect(wallet.holdForWithdrawal(userId, 30, 'withdraw-1')).rejects.toThrow(
      'INSUFFICIENT_BALANCE',
    );
    expect(users.get(userId)?.wavecoinBalance).toBe(5);
  });

  it('holdForWithdrawal is idempotent on the derived reference — a repeat call does not double-debit', async () => {
    const { dataSource, users, ledgerEntries } = createFakeDataSource([
      { id: userId, wavecoinBalance: 100 },
    ]);
    const wallet = new WalletService(dataSource);

    const first = await wallet.holdForWithdrawal(userId, 30, 'withdraw-1');
    const second = await wallet.holdForWithdrawal(userId, 30, 'withdraw-1');

    expect(users.get(userId)?.wavecoinBalance).toBe(70);
    expect(ledgerEntries).toHaveLength(1);
    expect(second).toEqual(first);
  });

  it('reverseWithdrawal credits the balance back with a Reversed entry', async () => {
    const { dataSource, users } = createFakeDataSource([{ id: userId, wavecoinBalance: 70 }]);
    const wallet = new WalletService(dataSource);

    const entry = await wallet.reverseWithdrawal(userId, 30, 'withdraw-1');

    expect(users.get(userId)?.wavecoinBalance).toBe(100);
    expect(entry.amountWaveCoin).toBe(30);
    expect(entry.status).toBe(WalletLedgerStatus.Reversed);
    expect(entry.reference).toBe('withdraw-reversed:withdraw-1');
  });

  describe('getBalanceSummary', () => {
    // Lighter fake than createFakeDataSource above — this method reads via
    // dataSource.getRepository(...).createQueryBuilder(...) rather than a transaction manager, so
    // it needs its own chainable query-builder stub. Exercises the arithmetic (capping
    // availableToWithdraw at the current balance), not real SQL — see wallet/CLAUDE.md.
    function fakeSummaryDataSource(wavecoinBalance: number, sums: { totalEarned: number; pendingClearance: number; withdrawnNet?: number }) {
      let call = 0;
      const qb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn(async () => {
          call += 1;
          // First sumEntries() call is totalEarned (no andWhere on availableAt), second is
          // pendingClearance (has the extra andWhere), third is the net of withdrawal ledger rows
          // (<= 0) — matches call order in getBalanceSummary.
          return { sum: String(call === 1 ? sums.totalEarned : call === 2 ? sums.pendingClearance : sums.withdrawnNet ?? 0) };
        }),
      };
      const repo = { createQueryBuilder: jest.fn(() => qb), findOne: jest.fn(async () => ({ id: userId, wavecoinBalance })) };
      return { getRepository: jest.fn(() => repo) } as any;
    }

    it('caps availableToWithdraw at the current wallet balance', async () => {
      const dataSource = fakeSummaryDataSource(40, { totalEarned: 200, pendingClearance: 0 });
      const wallet = new WalletService(dataSource);

      const summary = await wallet.getBalanceSummary(userId);

      expect(summary.walletBalance).toBe(40);
      expect(summary.totalEarned).toBe(200);
      expect(summary.pendingClearance).toBe(0);
      // Cleared earnings (200) exceed the actual balance (40, since the seller already spent some)
      // — availableToWithdraw must not exceed what they actually have.
      expect(summary.availableToWithdraw).toBe(40);
    });

    it('caps availableToWithdraw at cleared earnings when the balance is higher', async () => {
      const dataSource = fakeSummaryDataSource(500, { totalEarned: 200, pendingClearance: 50 });
      const wallet = new WalletService(dataSource);

      const summary = await wallet.getBalanceSummary(userId);

      // Cleared earnings = 200 - 50 = 150, well below the 500 balance (which includes buyer
      // top-up money that isn't withdrawable) — available should be capped at 150, not 500.
      expect(summary.availableToWithdraw).toBe(150);
    });

    // Real bug found by the e2e suite (withdrawals.e2e-spec.ts): withdrawals were never subtracted
    // from cleared earnings, so the same earnings could be withdrawn repeatedly against top-up money.
    it('subtracts already-withdrawn/held earnings from what is still withdrawable', async () => {
      const dataSource = fakeSummaryDataSource(1000, { totalEarned: 90, pendingClearance: 0, withdrawnNet: -90 });
      const summary = await new WalletService(dataSource).getBalanceSummary(userId);
      expect(summary.availableToWithdraw).toBe(0);
    });

    // Real bug found while verifying coaching-session escrow against a live Postgres instance
    // (2026-09-16): this method originally summed only WalletLedgerType.OrderRelease, so a coach's
    // SessionRelease earnings were silently excluded from totalEarned/availableToWithdraw even
    // though the money really was credited to their wavecoinBalance. Locks in the fix.
    it('counts SessionRelease earnings toward totalEarned, not just OrderRelease', async () => {
      let capturedTypes: string[] | undefined;
      const qb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn((clause: string, params: any) => {
          if (clause.includes('e.type') && !capturedTypes) capturedTypes = params.types; // first call = totalEarned
          return qb;
        }),
        getRawOne: jest.fn(async () => ({ sum: '18' })),
      };
      const repo = { createQueryBuilder: jest.fn(() => qb), findOne: jest.fn(async () => ({ id: userId, wavecoinBalance: 63 })) };
      const dataSource = { getRepository: jest.fn(() => repo) } as any;
      const wallet = new WalletService(dataSource);

      const summary = await wallet.getBalanceSummary(userId);

      expect(capturedTypes).toEqual([WalletLedgerType.OrderRelease, WalletLedgerType.SessionRelease]);
      expect(summary.totalEarned).toBe(18);
    });
  });

  describe('composed transactions (manager param)', () => {
    it('debitForOrder uses the passed manager instead of opening its own transaction', async () => {
      const { dataSource } = createFakeDataSource([{ id: userId, wavecoinBalance: 100 }]);
      const wallet = new WalletService(dataSource);

      const users = new Map([[userId, { id: userId, wavecoinBalance: 100 }]]);
      const manager = {
        findOne: jest.fn(async () => users.get(userId)),
        update: jest.fn(async (_e: any, id: string, partial: any) => Object.assign(users.get(id)!, partial)),
        create: jest.fn((_e: any, data: any) => ({ ...data })),
        save: jest.fn(async (entity: any) => entity),
      } as any;

      const entry = await wallet.debitForOrder(userId, 'order-1', 10, manager);

      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(manager.findOne).toHaveBeenCalled();
      expect(users.get(userId)?.wavecoinBalance).toBe(90);
      expect(entry.amountWaveCoin).toBe(-10);
    });

    it('a failure inside a caller-supplied manager still rejects (no silent swallow)', async () => {
      const { dataSource } = createFakeDataSource([{ id: userId, wavecoinBalance: 5 }]);
      const wallet = new WalletService(dataSource);
      const manager = {
        findOne: jest.fn(async () => ({ id: userId, wavecoinBalance: 5 })),
        update: jest.fn(),
        create: jest.fn((_e: any, d: any) => d),
        save: jest.fn(),
      } as any;

      await expect(wallet.debitForOrder(userId, 'order-1', 999, manager)).rejects.toThrow(
        'INSUFFICIENT_BALANCE',
      );
      expect(manager.update).not.toHaveBeenCalled();
    });
  });
});
