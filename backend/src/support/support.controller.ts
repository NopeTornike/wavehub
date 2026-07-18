import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { SupportService } from './support.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ReplyTicketDto } from './dto/reply-ticket.dto';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUserId } from '../auth/current-user.decorator';

// User-facing ticket routes — no admin role needed, just a real session. The requester can only
// ever see their own tickets (enforced in SupportService, not here) and never sees internal notes.
@Controller('tickets')
@UseGuards(AuthGuard)
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Post()
  create(@CurrentUserId() userId: string, @Body() dto: CreateTicketDto) {
    return this.support.createTicket(userId, dto);
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
  reply(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: ReplyTicketDto) {
    return this.support.reply(userId, id, dto.body);
  }
}
