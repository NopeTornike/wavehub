import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { AdminRole, type GameImageKind } from '@wavehub/shared-types';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUserId } from '../auth/current-user.decorator';
import { AdminGuard } from '../admin/admin-role.guard';
import { RequireAdminRole } from '../admin/require-admin-role.decorator';
import { CurrentAdminRole } from '../admin/current-admin-role.decorator';
import { AdminAuditService } from '../admin/admin-audit.service';
import { CREATE_THROTTLE, UPLOAD_THROTTLE } from '../common/throttle';
import { GamesService } from './games.service';
import { CreateGameDto, UpdateGameDto } from './dto/game.dto';

// The marketplace catalogue is an operations concern: same roles that run tournaments/listings.
const CATALOGUE_ROLES = [AdminRole.OperationLead, AdminRole.MainAdministrator, AdminRole.MarketplaceCoachingOpsManager];
const KINDS: GameImageKind[] = ['icon', 'cover', 'tile'];

function parseKind(kind: string): GameImageKind {
  if (!(KINDS as string[]).includes(kind)) throw new BadRequestException('Image kind must be icon, cover or tile');
  return kind as GameImageKind;
}

@Controller('admin/games')
@UseGuards(AuthGuard, AdminGuard)
@RequireAdminRole(...CATALOGUE_ROLES)
export class AdminGamesController {
  constructor(
    private readonly games: GamesService,
    private readonly audit: AdminAuditService,
  ) {}

  @Get()
  list() {
    return this.games.listForAdmin();
  }

  @Post()
  @Throttle(CREATE_THROTTLE)
  async create(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Body() dto: CreateGameDto) {
    const game = await this.games.create(dto);
    await this.audit.log({ adminId, adminRole, action: 'game.create', entityType: 'game', entityId: game.id, metadata: { name: game.name, slug: game.slug } });
    return game;
  }

  @Post(':id')
  @HttpCode(HttpStatus.OK)
  async update(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateGameDto) {
    const game = await this.games.update(id, dto);
    await this.audit.log({ adminId, adminRole, action: 'game.update', entityType: 'game', entityId: id, metadata: dto as Record<string, unknown> });
    return game;
  }

  @Post(':id/images/:kind')
  @HttpCode(HttpStatus.OK)
  @Throttle(UPLOAD_THROTTLE)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }))
  async setImage(
    @CurrentUserId() adminId: string,
    @CurrentAdminRole() adminRole: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('kind') kind: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const game = await this.games.setImage(id, parseKind(kind), file);
    await this.audit.log({ adminId, adminRole, action: 'game.set_image', entityType: 'game', entityId: id, metadata: { kind: parseKind(kind) } });
    return game;
  }

  @Delete(':id/images/:kind')
  async clearImage(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Param('id', ParseUUIDPipe) id: string, @Param('kind') kind: string) {
    const game = await this.games.clearImage(id, parseKind(kind));
    await this.audit.log({ adminId, adminRole, action: 'game.clear_image', entityType: 'game', entityId: id, metadata: { kind: parseKind(kind) } });
    return game;
  }
}
