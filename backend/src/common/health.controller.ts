import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { DataSource } from 'typeorm';
import { PlatformSettingsService } from '../settings/platform-settings.service';

// Unauthenticated liveness/readiness probe for Docker healthchecks, the reverse proxy and uptime
// monitors. Deliberately reveals nothing but coarse status: no versions, no error text, no config.
// `maintenance` is public on purpose — the frontend/uptime monitor can show a maintenance banner.
// Exempt from throttling so a fast healthcheck interval or a monitor can never trip the limiter.
@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly settings: PlatformSettingsService,
  ) {}

  @Get()
  async check() {
    let dbUp = false;
    try {
      await Promise.race([
        this.dataSource.query('SELECT 1'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000).unref()),
      ]);
      dbUp = true;
    } catch {
      dbUp = false;
    }
    if (!dbUp) {
      throw new HttpException({ status: 'error', db: 'down' }, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return { status: 'ok', db: 'up', maintenance: await this.settings.isMaintenanceMode() };
  }
}
