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
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUserId } from '../auth/current-user.decorator';

// Routes live under /orders/:orderId/dispute rather than a bare /disputes/:id — unlike
// backend/src/chat/ (which has no controller at all and piggybacks on OrdersController),
// DisputesService already depends directly on the Order repo for its own status-transition logic,
// so there's no dependency-direction reason to avoid a dedicated controller here. See
// disputes/CLAUDE.md for the fuller comparison.
@Controller('orders/:orderId/dispute')
@UseGuards(AuthGuard)
export class DisputesController {
  constructor(private readonly disputes: DisputesService) {}

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
}
