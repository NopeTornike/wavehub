import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { CommunityModule } from '../community/community.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UserFollow } from './user-follow.entity';
import { MyFollowsController, ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';
import { BadgesModule } from '../badges/badges.module';

@Module({
  imports: [BadgesModule, TypeOrmModule.forFeature([UserFollow]), AuthModule, CommunityModule, NotificationsModule],
  controllers: [ProfilesController, MyFollowsController],
  providers: [ProfilesService],
  exports: [ProfilesService],
})
export class ProfilesModule {}
