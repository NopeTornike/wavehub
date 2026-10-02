import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Coach } from './coach.entity';
import { CoachingSession } from './coaching-session.entity';
import { CoachingSessionReview } from './coaching-session-review.entity';
import { CoachFavorite } from './coach-favorite.entity';
import { CoachingPackage } from './coaching-package.entity';
import { CoachingPackagesService } from './coaching-packages.service';
import { CoachingPackagesController } from './coaching-packages.controller';
import { Game } from '../listings/game.entity';
import { User } from '../users/user.entity';
import { StorageModule } from '../storage/storage.module';
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
import { CommunityModule } from '../community/community.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Coach, CoachingSession, CoachingSessionReview, CoachFavorite, CoachingPackage, Game, User]),
    AuthModule,
    AdminModule,
    WalletModule,
    SettingsModule,
    NotificationsModule,
    SubscriptionsModule,
    CommunityModule,
    StorageModule,
  ],
  controllers: [CoachesController, CoachingSessionsController, CoachingPackagesController],
  providers: [CoachesService, CoachingSessionsService, CoachingPackagesService],
  exports: [CoachesService, CoachingSessionsService],
})
export class CoachingModule {}
