import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { VerifiedEmailGuard } from '../auth/verified-email.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AdminRole } from '@wavehub/shared-types';
import { TournamentsService } from './tournaments.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { BrowseTournamentsDto } from './dto/browse-tournaments.dto';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUserId } from '../auth/current-user.decorator';
import { AdminGuard } from '../admin/admin-role.guard';
import { RequireAdminRole } from '../admin/require-admin-role.decorator';
import { CurrentAdminRole } from '../admin/current-admin-role.decorator';
import { AdminAuditService } from '../admin/admin-audit.service';
import { Throttle } from '@nestjs/throttler';
import { CREATE_THROTTLE, UPLOAD_THROTTLE } from '../common/throttle';
import { RegisterTeamDto } from './dto/register-team.dto';
import { TeamStatusDto } from './dto/team-status.dto';
import { MatchDto } from './dto/match.dto';

// Same trio as backend/src/coaching/coaches.controller.ts's COACH_MANAGEMENT_ROLES — tournaments
// aren't in SPECIFICATION.md at all (genuinely new scope, see LAUNCH_PLAN.md §2b), so there's no
// spec section to read a role list from; reused the closest existing precedent (a
// marketplace-adjacent, admin-curated content/event type) rather than inventing a new permission.
const TOURNAMENT_MANAGEMENT_ROLES = [AdminRole.OperationLead, AdminRole.MainAdministrator, AdminRole.MarketplaceCoachingOpsManager];

@Controller()
export class TournamentsController {
  constructor(
    private readonly tournaments: TournamentsService,
    private readonly audit: AdminAuditService,
  ) {}

  @Get('tournaments')
  browse(@Query() query: BrowseTournamentsDto) {
    return this.tournaments.browse(query);
  }

  // Must stay registered before GET tournaments/:id — same Express route-ordering gotcha
  // documented in backend/src/listings/CLAUDE.md's `pending-review` note.
  @Get('tournaments/mine')
  @UseGuards(AuthGuard)
  listMine(@CurrentUserId() userId: string) {
    return this.tournaments.listMyRegisteredIds(userId);
  }

  @Get('tournaments/:id')
  findOne(@Param('id') id: string) {
    return this.tournaments.findPublicById(id);
  }

  @Get('tournaments/:id/teams')
  listTeams(@Param('id') id: string) {
    return this.tournaments.listTeams(id);
  }

  @Get('tournaments/:id/matches')
  listMatches(@Param('id') id: string) {
    return this.tournaments.listMatches(id);
  }

  @Get('tournaments/:id/matches/:matchId')
  getMatch(@Param('id') id: string, @Param('matchId') matchId: string) {
    return this.tournaments.getMatch(id, matchId);
  }

  // Solo tournaments (teamSize 1).
  @Post('tournaments/:id/register')
  @HttpCode(HttpStatus.OK)
  @Throttle(CREATE_THROTTLE)
  @UseGuards(AuthGuard, VerifiedEmailGuard)
  register(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.tournaments.register(id, userId);
  }

  // Squad tournaments: the caller becomes the team captain.
  @Post('tournaments/:id/teams')
  @Throttle(CREATE_THROTTLE)
  @UseGuards(AuthGuard, VerifiedEmailGuard)
  registerTeam(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: RegisterTeamDto) {
    return this.tournaments.registerTeam(id, userId, dto);
  }

  @Post('tournaments/:id/teams/mine/logo')
  @HttpCode(HttpStatus.OK)
  @Throttle(UPLOAD_THROTTLE)
  @UseGuards(AuthGuard, VerifiedEmailGuard)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } }))
  setMyTeamLogo(@CurrentUserId() userId: string, @Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    return this.tournaments.setMyTeamLogo(id, userId, file);
  }

  @Post('tournaments/:id/withdraw')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  withdraw(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.tournaments.withdraw(id, userId);
  }

  // The caller's registrations (with team) and their teams' matches — My Tournaments / Hub.
  @Get('me/tournaments')
  @UseGuards(AuthGuard)
  myTournaments(@CurrentUserId() userId: string) {
    return this.tournaments.myTournaments(userId);
  }

  @Get('me/tournament-matches')
  @UseGuards(AuthGuard)
  myMatches(@CurrentUserId() userId: string) {
    return this.tournaments.myMatches(userId);
  }

  @Post('admin/tournaments')
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole(...TOURNAMENT_MANAGEMENT_ROLES)
  async create(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Body() dto: CreateTournamentDto) {
    const tournament = await this.tournaments.create(dto);
    await this.audit.log({ adminId, adminRole, action: 'tournament.create', entityType: 'tournament', entityId: tournament.id });
    return tournament;
  }

  @Post('admin/tournaments/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole(...TOURNAMENT_MANAGEMENT_ROLES)
  async update(
    @CurrentUserId() adminId: string,
    @CurrentAdminRole() adminRole: string,
    @Param('id') id: string,
    @Body() dto: UpdateTournamentDto,
  ) {
    const tournament = await this.tournaments.update(id, dto);
    await this.audit.log({ adminId, adminRole, action: 'tournament.update', entityType: 'tournament', entityId: id, metadata: dto as Record<string, unknown> });
    return tournament;
  }

  @Post('admin/tournaments/:id/cover')
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole(...TOURNAMENT_MANAGEMENT_ROLES)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }))
  async setCover(
    @CurrentUserId() adminId: string,
    @CurrentAdminRole() adminRole: string,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const tournament = await this.tournaments.setCoverImage(id, file);
    await this.audit.log({ adminId, adminRole, action: 'tournament.set_cover', entityType: 'tournament', entityId: id });
    return tournament;
  }

  @Get('admin/tournaments/:id/teams')
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole(...TOURNAMENT_MANAGEMENT_ROLES)
  adminListTeams(@Param('id') id: string) {
    return this.tournaments.adminListTeams(id);
  }

  @Post('admin/tournaments/:id/teams/:teamId/status')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole(...TOURNAMENT_MANAGEMENT_ROLES)
  async setTeamStatus(
    @CurrentUserId() adminId: string,
    @CurrentAdminRole() adminRole: string,
    @Param('id') id: string,
    @Param('teamId') teamId: string,
    @Body() dto: TeamStatusDto,
  ) {
    const team = await this.tournaments.adminSetTeamStatus(id, teamId, dto.status);
    await this.audit.log({ adminId, adminRole, action: 'tournament.team_status', entityType: 'tournament_team', entityId: teamId, metadata: { tournamentId: id, status: dto.status } });
    return team;
  }

  @Post('admin/tournaments/:id/matches')
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole(...TOURNAMENT_MANAGEMENT_ROLES)
  async createMatch(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Param('id') id: string, @Body() dto: MatchDto) {
    const match = await this.tournaments.adminCreateMatch(id, dto);
    await this.audit.log({ adminId, adminRole, action: 'tournament.match_create', entityType: 'tournament_match', entityId: match.id, metadata: { tournamentId: id } });
    return match;
  }

  @Post('admin/tournaments/:id/matches/:matchId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole(...TOURNAMENT_MANAGEMENT_ROLES)
  async updateMatch(
    @CurrentUserId() adminId: string,
    @CurrentAdminRole() adminRole: string,
    @Param('id') id: string,
    @Param('matchId') matchId: string,
    @Body() dto: MatchDto,
  ) {
    const match = await this.tournaments.adminUpdateMatch(id, matchId, dto);
    await this.audit.log({ adminId, adminRole, action: 'tournament.match_update', entityType: 'tournament_match', entityId: matchId, metadata: { tournamentId: id } });
    return match;
  }

  @Delete('admin/tournaments/:id/matches/:matchId')
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole(...TOURNAMENT_MANAGEMENT_ROLES)
  async deleteMatch(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Param('id') id: string, @Param('matchId') matchId: string) {
    const result = await this.tournaments.adminDeleteMatch(id, matchId);
    await this.audit.log({ adminId, adminRole, action: 'tournament.match_delete', entityType: 'tournament_match', entityId: matchId, metadata: { tournamentId: id } });
    return result;
  }

  @Delete('admin/tournaments/:id')
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole(...TOURNAMENT_MANAGEMENT_ROLES)
  async remove(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Param('id') id: string) {
    await this.tournaments.delete(id);
    await this.audit.log({ adminId, adminRole, action: 'tournament.delete', entityType: 'tournament', entityId: id });
    return { ok: true };
  }
}
