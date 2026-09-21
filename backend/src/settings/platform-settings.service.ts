import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformSettings, PLATFORM_SETTINGS_SINGLETON_ID } from './platform-settings.entity';
import { UpdatePlatformSettingsDto } from './dto/update-platform-settings.dto';

const MAINTENANCE_CACHE_TTL_MS = 5_000;

@Injectable()
export class PlatformSettingsService {
  private maintenanceCache?: { value: boolean; expiresAt: number };

  constructor(@InjectRepository(PlatformSettings) private readonly repo: Repository<PlatformSettings>) {}

  // The migration seeds the one row this table will ever have — a missing row means the migration
  // never ran, which is a deployment bug worth failing loudly on, not silently re-creating a
  // default row for (that would mask the real problem).
  async get(): Promise<PlatformSettings> {
    const row = await this.repo.findOne({ where: { id: PLATFORM_SETTINGS_SINGLETON_ID } });
    if (!row) {
      throw new InternalServerErrorException('Platform settings row is missing — migrations may not have run');
    }
    return row;
  }

  async getPlatformFeePercent(): Promise<number> {
    return (await this.get()).platformFeePercent;
  }

  async getMinWithdrawalWaveCoin(): Promise<number> {
    return (await this.get()).minWithdrawalWaveCoin;
  }

  // Read on every non-GET request by MaintenanceGuard, so it's cached for a few seconds instead of
  // costing a DB round-trip per request. `update()` refreshes the cache immediately, so the
  // instance that flips the flag reacts at once; this is a single-instance deployment (see root
  // CLAUDE.md), and any other instance would converge within MAINTENANCE_CACHE_TTL_MS. Fails OPEN
  // (returns false) if the settings row can't be read — a DB blip must not turn into a
  // self-inflicted outage on top of the blip; the request would fail on its own DB access anyway.
  async isMaintenanceMode(): Promise<boolean> {
    const now = Date.now();
    if (this.maintenanceCache && this.maintenanceCache.expiresAt > now) {
      return this.maintenanceCache.value;
    }
    try {
      const value = (await this.get()).maintenanceMode === true;
      this.maintenanceCache = { value, expiresAt: now + MAINTENANCE_CACHE_TTL_MS };
      return value;
    } catch {
      return false;
    }
  }

  async update(patch: UpdatePlatformSettingsDto): Promise<PlatformSettings> {
    await this.repo.update(PLATFORM_SETTINGS_SINGLETON_ID, patch);
    this.maintenanceCache = undefined;
    const row = await this.get();
    this.maintenanceCache = { value: row.maintenanceMode === true, expiresAt: Date.now() + MAINTENANCE_CACHE_TTL_MS };
    return row;
  }
}
