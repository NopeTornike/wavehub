import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AdminModule } from '../admin/admin.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UserBadge } from './user-badge.entity';
import { BadgesService } from './badges.service';
import { BadgesController } from './badges.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserBadge]), AuthModule, AdminModule, NotificationsModule],
  controllers: [BadgesController],
  providers: [BadgesService],
  exports: [BadgesService],
})
export class BadgesModule {}
