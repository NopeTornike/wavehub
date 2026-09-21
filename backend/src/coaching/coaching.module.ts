import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Coach } from './coach.entity';
import { CoachingSession } from './coaching-session.entity';
import { Game } from '../listings/game.entity';
import { CoachesService } from './coaches.service';
import { CoachesController } from './coaches.controller';
import { CoachingSessionsService } from './coaching-sessions.service';
import { CoachingSessionsController } from './coaching-sessions.controller';
import { AuthModule } from '../auth/auth.module';
import { AdminModule } from '../admin/admin.module';
import { WalletModule } from '../wallet/wallet.module';
import { SettingsModule } from '../settings/settings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Coach, CoachingSession, Game]),
    AuthModule,
    AdminModule,
    WalletModule,
    SettingsModule,
    NotificationsModule,
    SubscriptionsModule,
  ],
  controllers: [CoachesController, CoachingSessionsController],
  providers: [CoachesService, CoachingSessionsService],
  exports: [CoachesService, CoachingSessionsService],
})
export class CoachingModule {}
