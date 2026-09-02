import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { MessagesService } from './messages.service';

class SendMessageDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9_-]+$/)
  @MaxLength(40)
  toUsername: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  body: string;
}

@Controller('messages')
@UseGuards(AuthGuard)
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get()
  async list(@Req() request: Request) {
    const user = (request as any).user;
    return { ok: true, messages: await this.messages.listFor(user.username) };
  }

  @Post()
  async send(@Req() request: Request, @Body() body: SendMessageDto) {
    const user = (request as any).user;
    return { ok: true, message: await this.messages.send(user.username, body.toUsername, body.body) };
  }

  @Post('read/:participant')
  @HttpCode(HttpStatus.OK)
  async markRead(@Req() request: Request, @Param('participant') participant: string) {
    const user = (request as any).user;
    return { ok: true, updated: await this.messages.markConversationRead(user.username, participant) };
  }
}
