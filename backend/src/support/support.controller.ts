import { CREATE_THROTTLE, MESSAGE_THROTTLE, UPLOAD_THROTTLE } from '../common/throttle';
import { Throttle } from '@nestjs/throttler';
import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { SupportService } from './support.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ReplyTicketDto } from './dto/reply-ticket.dto';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUserId } from '../auth/current-user.decorator';

// Screenshots / PDF / Word files on a ticket or live chat — 10MB, same order as dispute evidence.
export const TICKET_ATTACHMENT = FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// User-facing ticket routes — no admin role needed, just a real session. The requester can only
// ever see their own tickets (enforced in SupportService, not here) and never sees internal notes.
@Controller('tickets')
@UseGuards(AuthGuard)
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Post()
  @Throttle(CREATE_THROTTLE)
  create(@CurrentUserId() userId: string, @Body() dto: CreateTicketDto) {
    return this.support.createTicket(userId, dto);
  }

  // The live support chat ("Contact support"): the open one, or null before the first message.
  @Get('live')
  liveChat(@CurrentUserId() userId: string) {
    return this.support.getLiveChat(userId);
  }

  @Post('live')
  @HttpCode(HttpStatus.OK)
  @Throttle(MESSAGE_THROTTLE)
  sendLive(@CurrentUserId() userId: string, @Body() dto: ReplyTicketDto) {
    return this.support.sendLiveMessage(userId, dto.body);
  }

  @Post('mine/:id/attachment')
  @HttpCode(HttpStatus.OK)
  @Throttle(UPLOAD_THROTTLE)
  @UseInterceptors(TICKET_ATTACHMENT)
  attach(@CurrentUserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @UploadedFile() file: Express.Multer.File | undefined) {
    return this.support.addAttachment(userId, id, file);
  }

  @Get('mine')
  listMine(@CurrentUserId() userId: string) {
    return this.support.listMine(userId);
  }

  @Get('mine/:id')
  getMine(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.support.getMine(userId, id);
  }

  @Post('mine/:id/reply')
  @Throttle(MESSAGE_THROTTLE)
  reply(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: ReplyTicketDto) {
    return this.support.reply(userId, id, dto.body);
  }
}
