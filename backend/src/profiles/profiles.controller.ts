import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUserId } from '../auth/current-user.decorator';
import { CREATE_THROTTLE } from '../common/throttle';
import { ProfilesService } from './profiles.service';

@Controller('users/:username')
@UseGuards(AuthGuard)
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get('follow-status')
  status(@CurrentUserId() userId: string, @Param('username') username: string) {
    return this.profiles.status(userId, username);
  }

  @Post('follow')
  @HttpCode(HttpStatus.OK)
  @Throttle(CREATE_THROTTLE)
  follow(@CurrentUserId() userId: string, @Param('username') username: string) {
    return this.profiles.follow(userId, username);
  }

  @Delete('follow')
  unfollow(@CurrentUserId() userId: string, @Param('username') username: string) {
    return this.profiles.unfollow(userId, username);
  }
}

// The viewer's own follow lists (client feedback #15): who I follow — to unfollow later — and who
// follows me. Private to the owner; newest first.
@Controller('me')
@UseGuards(AuthGuard)
export class MyFollowsController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get('following')
  following(@CurrentUserId() userId: string) {
    return this.profiles.listFollows(userId, 'following');
  }

  @Get('followers')
  followers(@CurrentUserId() userId: string) {
    return this.profiles.listFollows(userId, 'followers');
  }
}
