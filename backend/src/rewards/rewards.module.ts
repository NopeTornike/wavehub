import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminModule } from '../admin/admin.module';
import { SettingsModule } from '../settings/settings.module';
import { StorageModule } from '../storage/storage.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RewardsController } from './rewards.controller';
import { RewardsService } from './rewards.service';

@Module({
  imports: [AuthModule, AdminModule, SettingsModule, StorageModule, NotificationsModule],
  controllers: [RewardsController],
  providers: [RewardsService],
})
export class RewardsModule {}
