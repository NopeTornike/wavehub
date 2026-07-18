import { InternalServerErrorException } from '@nestjs/common';
import { PlatformSettingsService } from './platform-settings.service';
import { PLATFORM_SETTINGS_SINGLETON_ID } from './platform-settings.entity';

describe('PlatformSettingsService', () => {
  function build(row: any) {
    const state = row ? { ...row } : null;
    const repo = {
      findOne: jest.fn(async () => (state ? { ...state } : null)),
      update: jest.fn(async (_id: string, patch: any) => Object.assign(state, patch)),
    } as any;
    const service = new PlatformSettingsService(repo);
    return { service, repo, state };
  }

  it('throws if the singleton row is missing (migration never ran)', async () => {
    const { service } = build(null);
    await expect(service.get()).rejects.toThrow(InternalServerErrorException);
  });

  it('returns the current fee percent and minimum withdrawal', async () => {
    const { service } = build({
      id: PLATFORM_SETTINGS_SINGLETON_ID,
      platformFeePercent: 10,
      minWithdrawalWaveCoin: 20,
      maintenanceMode: false,
    });
    await expect(service.getPlatformFeePercent()).resolves.toBe(10);
    await expect(service.getMinWithdrawalWaveCoin()).resolves.toBe(20);
  });

  it('update() persists a partial patch and returns the fresh row', async () => {
    const { service } = build({
      id: PLATFORM_SETTINGS_SINGLETON_ID,
      platformFeePercent: 10,
      minWithdrawalWaveCoin: 20,
      maintenanceMode: false,
    });
    const updated = await service.update({ platformFeePercent: 15 });
    expect(updated.platformFeePercent).toBe(15);
    expect(updated.minWithdrawalWaveCoin).toBe(20);
  });
});
