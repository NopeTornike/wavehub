import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tournament } from './tournament.entity';
import { TournamentRegistration } from './tournament-registration.entity';
import { TournamentTeam } from './tournament-team.entity';
import { TournamentTeamMember } from './tournament-team-member.entity';
import { TournamentMatch } from './tournament-match.entity';
import { TournamentMatchResult } from './tournament-match-result.entity';
import { TournamentLeaderboardEntry } from './tournament-leaderboard-entry.entity';
import { TournamentNotifier } from './tournament-notifier.service';
import { TournamentLeaderboardService } from './tournament-leaderboard.service';
import { SettingsModule } from '../settings/settings.module';
import { User } from '../users/user.entity';
import { Game } from '../listings/game.entity';
import { TournamentsService } from './tournaments.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { TournamentsController } from './tournaments.controller';
import { AuthModule } from '../auth/auth.module';
import { AdminModule } from '../admin/admin.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [TypeOrmModule.forFeature([Tournament, TournamentRegistration, TournamentTeam, TournamentTeamMember, TournamentMatch, TournamentMatchResult, TournamentLeaderboardEntry, Game, User]), AuthModule, SettingsModule, AdminModule, StorageModule, NotificationsModule],
  controllers: [TournamentsController],
  providers: [TournamentsService, TournamentNotifier, TournamentLeaderboardService],
})
export class TournamentsModule {}
