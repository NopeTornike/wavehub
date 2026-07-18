import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './notification.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { EmailModule } from '../email/email.module';
import { AuthModule } from '../auth/auth.module';

// Imported by every module with a notification hook point (Orders, Chat, Reviews, Disputes,
// Withdrawals so far) — same "shared foundation module" shape as backend/src/admin/.
@Module({
  imports: [TypeOrmModule.forFeature([Notification]), EmailModule, AuthModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
