import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformSettings } from './platform-settings.entity';
import { PlatformSettingsService } from './platform-settings.service';
import { PlatformSettingsController } from './platform-settings.controller';
import { MaintenanceGuard } from './maintenance.guard';
import { AuthModule } from '../auth/auth.module';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [TypeOrmModule.forFeature([PlatformSettings]), AuthModule, AdminModule],
  controllers: [PlatformSettingsController],
  // APP_GUARD registered here (not in AppModule) because the guard needs this module's service plus
  // AuthModule's SessionService/UsersService — the provider is still applied globally.
  providers: [PlatformSettingsService, { provide: APP_GUARD, useClass: MaintenanceGuard }],
  exports: [PlatformSettingsService],
})
export class SettingsModule {}
