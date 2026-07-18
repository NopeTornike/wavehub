import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DisputeStatus, WithdrawStatus } from '@wavehub/shared-types';
import { WithdrawalsService } from './withdrawals.service';

// Same fake-repository/fake-manager approach as disputes.service.spec.ts / orders.service.spec.ts.
describe('WithdrawalsService', () => {
  const sellerId = 'seller-1';
  const requestId = 'withdraw-1';

  function fakeManager() {
    const saved: any[] = [];
    const updates: any[] = [];
    return {
      create: jest.fn((_e: any, data: any) => ({ id: requestId, createdAt: new Date(), ...data })),
      save: jest.fn(async (entity: any) => {
        saved.push(entity);
        return entity;
      }),
      update: jest.fn(async (_entity: any, _id: any, data: any) => {
        updates.push(data);
      }),
      _saved: saved,
      _updates: updates,
    };
  }

  function build(options: {
    activeDispute?: any;
    availableToWithdraw?: number;
    existingRequest?: any;
  } = {}) {
    const manager = fakeManager();
    const dataSource = { transaction: jest.fn(async (cb: any) => cb(manager)) } as any;
    const withdrawals = {
      findOne: jest.fn(async () => options.existingRequest ?? null),
      find: jest.fn(async () => (options.existingRequest ? [options.existingRequest] : [])),
      createQueryBuilder: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn(async () => ({ sum: '0' })),
      })),
    } as any;
    const disputes = { findOne: jest.fn(async () => options.activeDispute ?? null) } as any;
    const wallet = {
      getBalanceSummary: jest.fn(async () => ({
        walletBalance: 1000,
        totalEarned: 1000,
        pendingClearance: 0,
        availableToWithdraw: options.availableToWithdraw ?? 1000,
      })),
      holdForWithdrawal: jest.fn(),
      reverseWithdrawal: jest.fn(),
    } as any;

    const notifications = { emit: jest.fn() } as any;
    const platformSettings = { getMinWithdrawalWaveCoin: jest.fn(async () => 20) } as any;

    const service = new WithdrawalsService(withdrawals, disputes, dataSource, wallet, notifications, platformSettings);
    return { service, manager, withdrawals, disputes, wallet, notifications, platformSettings };
  }

  describe('request', () => {
    it('rejects an amount below the minimum withdrawal threshold', async () => {
      const { service } = build();
      await expect(
        service.request(sellerId, { amountWaveCoin: 5, method: 'paypal', payoutDetails: {} } as any),
      ).rejects.toThrow('Minimum withdrawal is 20 WaveCoin');
    });

    it('rejects when the seller has an active (non-terminal) dispute', async () => {
      const { service } = build({ activeDispute: { id: 'dispute-1', status: DisputeStatus.Open } });
      await expect(
        service.request(sellerId, { amountWaveCoin: 50, method: 'paypal', payoutDetails: {} } as any),
      ).rejects.toThrow('Withdrawals are blocked while you have an active dispute');
    });

    it('rejects when the amount exceeds availableToWithdraw', async () => {
      const { service } = build({ availableToWithdraw: 30 });
      await expect(
        service.request(sellerId, { amountWaveCoin: 50, method: 'paypal', payoutDetails: {} } as any),
      ).rejects.toThrow('Requested amount exceeds your available balance');
    });

    it('creates a Pending request and holds the funds in one transaction', async () => {
      const { service, manager, wallet } = build({ availableToWithdraw: 500 });

      const result = await service.request(sellerId, {
        amountWaveCoin: 100,
        method: 'paypal',
        payoutDetails: { email: 'seller@example.com' },
      } as any);

      expect(result.status).toBe(WithdrawStatus.Pending);
      expect(result.amountWaveCoin).toBe(100);
      expect(wallet.holdForWithdrawal).toHaveBeenCalledWith(sellerId, 100, requestId, expect.anything());
      expect(manager.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('cancel', () => {
    it('rejects cancelling a request that is not Pending', async () => {
      const { service } = build({
        existingRequest: { id: requestId, sellerId, amountWaveCoin: 50, status: WithdrawStatus.Processing, createdAt: new Date() },
      });
      await expect(service.cancel(sellerId, requestId)).rejects.toThrow();
    });

    it("rejects cancelling someone else's request", async () => {
      const { service } = build({
        existingRequest: { id: requestId, sellerId: 'other-seller', amountWaveCoin: 50, status: WithdrawStatus.Pending, createdAt: new Date() },
      });
      await expect(service.cancel(sellerId, requestId)).rejects.toThrow(ForbiddenException);
    });

    it('reverses the hold and marks the request Cancelled', async () => {
      const { service, wallet } = build({
        existingRequest: { id: requestId, sellerId, amountWaveCoin: 50, status: WithdrawStatus.Pending, createdAt: new Date() },
      });

      const result = await service.cancel(sellerId, requestId);

      expect(result.status).toBe(WithdrawStatus.Cancelled);
      expect(wallet.reverseWithdrawal).toHaveBeenCalledWith(sellerId, 50, requestId, expect.anything());
    });
  });

  describe('process (admin)', () => {
    it('rejects processing a request that does not exist', async () => {
      const { service } = build();
      await expect(
        service.process('admin-1', requestId, WithdrawStatus.Processing),
      ).rejects.toThrow(NotFoundException);
    });

    it('Rejected reverses the held funds back to the seller', async () => {
      const { service, wallet } = build({
        existingRequest: { id: requestId, sellerId, amountWaveCoin: 75, status: WithdrawStatus.Pending, createdAt: new Date() },
      });

      await service.process('admin-1', requestId, WithdrawStatus.Rejected, 'Payout details invalid');

      expect(wallet.reverseWithdrawal).toHaveBeenCalledWith(sellerId, 75, requestId, expect.anything());
    });

    it('Completed does not touch the wallet — the debit already happened at request time', async () => {
      const { service, wallet } = build({
        existingRequest: { id: requestId, sellerId, amountWaveCoin: 75, status: WithdrawStatus.Processing, createdAt: new Date() },
      });

      await service.process('admin-1', requestId, WithdrawStatus.Completed);

      expect(wallet.reverseWithdrawal).not.toHaveBeenCalled();
    });
  });
});
