import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformSettings, PLATFORM_SETTINGS_SINGLETON_ID } from './platform-settings.entity';
import { UpdatePlatformSettingsDto } from './dto/update-platform-settings.dto';

@Injectable()
export class PlatformSettingsService {
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

  async update(patch: UpdatePlatformSettingsDto): Promise<PlatformSettings> {
    await this.repo.update(PLATFORM_SETTINGS_SINGLETON_ID, patch);
    return this.get();
  }
}
