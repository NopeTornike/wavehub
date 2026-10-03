import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoginEvent, UserReport, UserStaffNote } from './trust.entities';
import { User } from '../users/user.entity';
import { TrustService } from './trust.service';
import { TrustController } from './trust.controller';
import { AuthModule } from '../auth/auth.module';
import { AdminModule } from '../admin/admin.module';
import { NotificationsModule } from '../notifications/notifications.module';

// Trust & Safety — see trust/CLAUDE.md.
@Module({
  imports: [TypeOrmModule.forFeature([UserReport, UserStaffNote, LoginEvent, User]), AuthModule, AdminModule, NotificationsModule],
  controllers: [TrustController],
  providers: [TrustService],
})
export class TrustModule {}
