import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, ParseUUIDPipe, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUserId } from '../auth/current-user.decorator';
import { AdminGuard } from '../admin/admin-role.guard';
import { RequireAdminRole } from '../admin/require-admin-role.decorator';
import { CurrentAdminRole } from '../admin/current-admin-role.decorator';
import { AdminAuditService } from '../admin/admin-audit.service';
import { UPLOAD_THROTTLE } from '../common/throttle';
import { REWARD_STAFF_ROLES, RewardsService, weekStartOf } from './rewards.service';
import { RewardDeliveredDto, RewardFinalizeDto, RewardPrizeDto, RewardSettingsDto, RewardTaskDto, RewardVisitDto } from './dto/reward.dto';

// User Hub rewards (owner 2026-11-10). Player routes need a session; every staff mutation is audited.
@Controller()
export class RewardsController {
  constructor(
    private readonly rewards: RewardsService,
    private readonly audit: AdminAuditService,
  ) {}

  @Get('rewards/hub')
  @UseGuards(AuthGuard)
  hub(@CurrentUserId() userId: string) {
    return this.rewards.hub(userId);
  }

  @Post('rewards/checkin')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  checkIn(@CurrentUserId() userId: string) {
    return this.rewards.checkIn(userId);
  }

  @Post('rewards/visit')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  visit(@CurrentUserId() userId: string, @Body() dto: RewardVisitDto) {
    return this.rewards.visit(userId, dto.page);
  }

  @Post('rewards/wins/:id/open')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  open(@CurrentUserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.rewards.openWin(userId, id);
  }

  // --- Admin → Rewards ---

  @Get('admin/rewards')
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole(...REWARD_STAFF_ROLES)
  overview() {
    return this.rewards.adminOverview();
  }

  @Post('admin/rewards/tasks')
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole(...REWARD_STAFF_ROLES)
  async createTask(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Body() dto: RewardTaskDto) {
    const result = await this.rewards.saveTask(dto);
    await this.audit.log({ adminId, adminRole, action: 'rewards.task_create', entityType: 'reward_task', entityId: result.id, metadata: { ...dto } });
    return result;
  }

  @Post('admin/rewards/tasks/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole(...REWARD_STAFF_ROLES)
  async updateTask(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RewardTaskDto) {
    const result = await this.rewards.saveTask(dto, id);
    await this.audit.log({ adminId, adminRole, action: 'rewards.task_update', entityType: 'reward_task', entityId: id, metadata: { ...dto } });
    return result;
  }

  @Delete('admin/rewards/tasks/:id')
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole(...REWARD_STAFF_ROLES)
  async deleteTask(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Param('id', ParseUUIDPipe) id: string) {
    const result = await this.rewards.deleteTask(id);
    await this.audit.log({ adminId, adminRole, action: 'rewards.task_delete', entityType: 'reward_task', entityId: id });
    return result;
  }

  @Post('admin/rewards/prizes/:place')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole(...REWARD_STAFF_ROLES)
  async savePrize(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Param('place', ParseIntPipe) place: number, @Body() dto: RewardPrizeDto) {
    const result = await this.rewards.savePrize(place, dto.title, dto.description ?? null);
    await this.audit.log({ adminId, adminRole, action: 'rewards.prize_save', entityType: 'reward_prize', entityId: String(place), metadata: { ...dto } });
    return result;
  }

  @Post('admin/rewards/prizes/:place/image')
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole(...REWARD_STAFF_ROLES)
  @Throttle(UPLOAD_THROTTLE)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } }))
  async prizeImage(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Param('place', ParseIntPipe) place: number, @UploadedFile() file: Express.Multer.File) {
    const result = await this.rewards.setPrizeImage(place, file);
    await this.audit.log({ adminId, adminRole, action: 'rewards.prize_image', entityType: 'reward_prize', entityId: String(place) });
    return result;
  }

  @Post('admin/rewards/settings')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole(...REWARD_STAFF_ROLES)
  async settings(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Body() dto: RewardSettingsDto) {
    const result = await this.rewards.saveSettings(dto);
    await this.audit.log({ adminId, adminRole, action: 'rewards.settings', entityType: 'platform_settings', entityId: 'rewards', metadata: { ...dto } });
    return result;
  }

  @Post('admin/rewards/wins/:id/delivered')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole(...REWARD_STAFF_ROLES)
  async delivered(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RewardDeliveredDto) {
    const result = await this.rewards.setDelivered(id, dto.delivered);
    await this.audit.log({ adminId, adminRole, action: 'rewards.win_delivered', entityType: 'reward_win', entityId: id, metadata: { delivered: dto.delivered } });
    return result;
  }

  // Settles a finished week now instead of waiting for the hourly job (idempotent).
  @Post('admin/rewards/finalize')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole(...REWARD_STAFF_ROLES)
  async finalize(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Body() dto: RewardFinalizeDto) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dto.weekStart) || weekStartOf(dto.weekStart) !== dto.weekStart) throw new BadRequestException('weekStart must be a Monday (YYYY-MM-DD)');
    const created = await this.rewards.finalizeWeek(dto.weekStart);
    await this.audit.log({ adminId, adminRole, action: 'rewards.finalize', entityType: 'reward_win', entityId: dto.weekStart, metadata: { created } });
    return { created };
  }
}
