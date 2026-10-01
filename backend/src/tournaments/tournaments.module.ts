import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tournament } from './tournament.entity';
import { TournamentRegistration } from './tournament-registration.entity';
import { TournamentTeam } from './tournament-team.entity';
import { TournamentTeamMember } from './tournament-team-member.entity';
import { TournamentMatch } from './tournament-match.entity';
import { User } from '../users/user.entity';
import { Game } from '../listings/game.entity';
import { TournamentsService } from './tournaments.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { TournamentsController } from './tournaments.controller';
import { AuthModule } from '../auth/auth.module';
import { AdminModule } from '../admin/admin.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [TypeOrmModule.forFeature([Tournament, TournamentRegistration, TournamentTeam, TournamentTeamMember, TournamentMatch, Game, User]), AuthModule, AdminModule, StorageModule, NotificationsModule],
  controllers: [TournamentsController],
  providers: [TournamentsService],
})
export class TournamentsModule {}
