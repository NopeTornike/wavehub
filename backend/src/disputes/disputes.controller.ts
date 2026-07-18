import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { DisputesService } from './disputes.service';
import { OpenDisputeDto } from './dto/open-dispute.dto';
import { AddDisputeMessageDto } from './dto/add-dispute-message.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUserId } from '../auth/current-user.decorator';
import { AdminGuard } from '../admin/admin-role.guard';
import { RequireAdminRole } from '../admin/require-admin-role.decorator';
import { CurrentAdminRole } from '../admin/current-admin-role.decorator';
import { AdminAuditService } from '../admin/admin-audit.service';

// Routes live under /orders/:orderId/dispute rather than a bare /disputes/:id — unlike
// backend/src/chat/ (which has no controller at all and piggybacks on OrdersController),
// DisputesService already depends directly on the Order repo for its own status-transition logic,
// so there's no dependency-direction reason to avoid a dedicated controller here. See
// disputes/CLAUDE.md for the fuller comparison.
@Controller('orders/:orderId/dispute')
@UseGuards(AuthGuard)
export class DisputesController {
  constructor(
    private readonly disputes: DisputesService,
    private readonly audit: AdminAuditService,
  ) {}

  @Post()
  open(@CurrentUserId() userId: string, @Param('orderId') orderId: string, @Body() dto: OpenDisputeDto) {
    return this.disputes.open(userId, orderId, dto.reason);
  }

  @Get()
  getForOrder(@CurrentUserId() userId: string, @Param('orderId') orderId: string) {
    return this.disputes.getForOrder(userId, orderId);
  }

  @Post('messages')
  addMessage(
    @CurrentUserId() userId: string,
    @Param('orderId') orderId: string,
    @Body() dto: AddDisputeMessageDto,
  ) {
    return this.disputes.addMessage(userId, orderId, dto.body);
  }

  @Post('evidence')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } }))
  addEvidence(
    @CurrentUserId() userId: string,
    @Param('orderId') orderId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.disputes.addEvidence(userId, orderId, file);
  }

  // Super Admin only — per SPECIFICATION.md §5.13.1, only Super Admin's CAN list includes "refund
  // buyer, release funds to seller." Operation Lead and Main Administrator can participate in the
  // dispute workflow (review evidence, prepare a recommendation, escalate) but their own CAN lists
  // explicitly exclude approving refunds independently — those narrower participation actions
  // aren't built yet (no route/service method exists for them), so don't guess at them here.
  @Post('resolve')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminGuard)
  @RequireAdminRole()
  async resolve(
    @CurrentUserId() adminId: string,
    @CurrentAdminRole() adminRole: string,
    @Param('orderId') orderId: string,
    @Body() dto: ResolveDisputeDto,
  ) {
    const dispute = await this.disputes.resolveForOrder(orderId, adminId, dto.resolution, dto.note);
    await this.audit.log({
      adminId,
      adminRole,
      action: 'dispute.resolve',
      entityType: 'dispute',
      entityId: dispute.id,
      metadata: { resolution: dto.resolution, note: dto.note },
    });
    return dispute;
  }
}
