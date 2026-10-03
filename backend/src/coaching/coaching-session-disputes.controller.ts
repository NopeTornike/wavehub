import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { IsIn, IsOptional, IsString, Length } from 'class-validator';
import { CREATE_THROTTLE, MESSAGE_THROTTLE, UPLOAD_THROTTLE } from '../common/throttle';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUserId } from '../auth/current-user.decorator';
import { AdminGuard } from '../admin/admin-role.guard';
import { RequireAdminRole } from '../admin/require-admin-role.decorator';
import { CurrentAdminRole } from '../admin/current-admin-role.decorator';
import { AdminAuditService } from '../admin/admin-audit.service';
import { CoachingSessionDisputesService, MAX_SESSION_EVIDENCE_BYTES } from './coaching-session-disputes.service';
import type { SessionDisputeResolution } from '@wavehub/shared-types';

class OpenSessionDisputeDto {
  @IsString()
  @Length(10, 1000)
  reason: string;
}

class SessionDisputeMessageDto {
  @IsString()
  @Length(1, 2000)
  body: string;
}

class ResolveSessionDisputeDto {
  @IsIn(['refund_student', 'pay_coach'])
  resolution: SessionDisputeResolution;

  @IsString()
  @Length(3, 1000)
  note: string;
}

class ListSessionDisputesDto {
  @IsOptional()
  @IsIn(['open', 'resolved', 'all'])
  status?: 'open' | 'resolved' | 'all';
}

const EVIDENCE_UPLOAD = FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_SESSION_EVIDENCE_BYTES } });

// Session disputes — participants (coaching-sessions/:id/dispute…) and staff
// (admin/session-disputes…). Viewing/deciding is Super Admin only, the same as order disputes
// (disputes/admin-disputes.controller.ts); decisions and staff messages are audit-logged.
@Controller()
@UseGuards(AuthGuard)
export class CoachingSessionDisputesController {
  constructor(
    private readonly disputes: CoachingSessionDisputesService,
    private readonly audit: AdminAuditService,
  ) {}

  @Get('coaching-sessions/:id/dispute')
  get(@CurrentUserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.disputes.getForSession(userId, id);
  }

  @Post('coaching-sessions/:id/dispute')
  @Throttle(CREATE_THROTTLE)
  open(@CurrentUserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: OpenSessionDisputeDto) {
    return this.disputes.open(userId, id, dto.reason);
  }

  @Post('coaching-sessions/:id/dispute/messages')
  @HttpCode(HttpStatus.OK)
  @Throttle(MESSAGE_THROTTLE)
  message(@CurrentUserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SessionDisputeMessageDto) {
    return this.disputes.addMessage(userId, id, dto.body);
  }

  @Post('coaching-sessions/:id/dispute/evidence')
  @HttpCode(HttpStatus.OK)
  @Throttle(UPLOAD_THROTTLE)
  @UseInterceptors(EVIDENCE_UPLOAD)
  evidence(@CurrentUserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @UploadedFile() file: Express.Multer.File | undefined) {
    return this.disputes.addEvidence(userId, id, file);
  }

  @Get('admin/session-disputes')
  @UseGuards(AdminGuard)
  @RequireAdminRole()
  list(@Query() dto: ListSessionDisputesDto) {
    return this.disputes.listForAdmin(dto.status ?? 'open');
  }

  @Get('admin/session-disputes/:id')
  @UseGuards(AdminGuard)
  @RequireAdminRole()
  getOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.disputes.getForAdmin(id);
  }

  @Post('admin/session-disputes/:id/messages')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminGuard)
  @RequireAdminRole()
  async staffMessage(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SessionDisputeMessageDto) {
    const dispute = await this.disputes.addStaffMessage(adminId, id, dto.body);
    await this.audit.log({ adminId, adminRole, action: 'session_dispute.message', entityType: 'coaching_session_dispute', entityId: id });
    return dispute;
  }

  @Post('admin/session-disputes/:id/resolve')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminGuard)
  @RequireAdminRole()
  async resolve(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ResolveSessionDisputeDto) {
    const dispute = await this.disputes.resolve(adminId, id, dto.resolution, dto.note);
    await this.audit.log({ adminId, adminRole, action: 'session_dispute.resolve', entityType: 'coaching_session_dispute', entityId: id, metadata: { resolution: dto.resolution, note: dto.note } });
    return dispute;
  }
}
