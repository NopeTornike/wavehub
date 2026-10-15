import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Allow, IsNotEmpty, IsString } from 'class-validator';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { StateService } from './state.service';

class SaveStateDto {
  @IsString()
  @IsNotEmpty()
  key: string;

  @Allow()
  value: unknown;
}

@Controller('state')
export class StateController {
  constructor(private readonly state: StateService) {}

  @Get('public')
  async publicState() {
    return { ok: true, values: await this.state.publicState() };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async myState(@Req() request: Request) {
    const user = (request as any).user;
    return { ok: true, values: await this.state.stateFor(user.username) };
  }

  @Post('me')
  @UseGuards(AuthGuard)
  async save(@Req() request: Request, @Body() body: SaveStateDto) {
    const user = (request as any).user;
    return { ok: true, value: await this.state.saveClientState(user.username, user.role, body.key, body.value) };
  }
}
