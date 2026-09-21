import { CREATE_THROTTLE } from '../common/throttle';
import { Throttle } from '@nestjs/throttler';
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { VerifiedEmailGuard } from '../auth/verified-email.guard';
import { CoachingSessionsService } from './coaching-sessions.service';
import { RequestSessionDto } from './dto/request-session.dto';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUserId } from '../auth/current-user.decorator';

@Controller()
@UseGuards(AuthGuard)
export class CoachingSessionsController {
  constructor(private readonly sessions: CoachingSessionsService) {}

  @Post('coaches/:id/sessions')
  @Throttle(CREATE_THROTTLE)
  @UseGuards(VerifiedEmailGuard)
  request(@CurrentUserId() buyerId: string, @Param('id') coachId: string, @Body() dto: RequestSessionDto) {
    return this.sessions.request(buyerId, coachId, dto);
  }

  @Get('coaching-sessions/mine-as-buyer')
  findMineAsBuyer(@CurrentUserId() userId: string) {
    return this.sessions.findMineAsBuyer(userId);
  }

  @Get('coaching-sessions/mine-as-coach')
  findMineAsCoach(@CurrentUserId() userId: string) {
    return this.sessions.findMineAsCoach(userId);
  }

  @Get('coaching-sessions/:id')
  getOne(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.sessions.getForParticipant(id, userId);
  }

  @Post('coaching-sessions/:id/complete')
  @HttpCode(HttpStatus.OK)
  complete(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.sessions.complete(id, userId);
  }

  @Post('coaching-sessions/:id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.sessions.cancel(id, userId);
  }
}
