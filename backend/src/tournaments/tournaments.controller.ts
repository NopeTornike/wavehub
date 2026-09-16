import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
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

  @Post('tournaments/:id/register')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  register(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.tournaments.register(id, userId);
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

  @Delete('admin/tournaments/:id')
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole(...TOURNAMENT_MANAGEMENT_ROLES)
  async remove(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Param('id') id: string) {
    await this.tournaments.delete(id);
    await this.audit.log({ adminId, adminRole, action: 'tournament.delete', entityType: 'tournament', entityId: id });
    return { ok: true };
  }
}
