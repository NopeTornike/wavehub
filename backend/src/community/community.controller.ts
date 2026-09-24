import { Controller, Get, UseGuards } from '@nestjs/common';
import type { GameListingCount, OnlineStats, SellerRanks, WaveRank } from '@wavehub/shared-types';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUserId } from '../auth/current-user.decorator';
import { CommunityService } from './community.service';

// Public aggregates for the site shell (sidebar "N online", home/marketplace game counts) plus the
// signed-in user's own Wave rank. The public routes return counts only — never ids or usernames of
// who is online.
@Controller()
export class CommunityController {
  constructor(private readonly community: CommunityService) {}

  @Get('stats/online')
  online(): Promise<OnlineStats> {
    return this.community.onlineStats();
  }

  @Get('stats/games')
  games(): Promise<GameListingCount[]> {
    return this.community.gameListingCounts();
  }

  @Get('stats/seller-ranks')
  sellerRanks(): Promise<SellerRanks> {
    return this.community.sellerRanks();
  }

  @Get('me/wave-rank')
  @UseGuards(AuthGuard)
  waveRank(@CurrentUserId() userId: string): Promise<WaveRank> {
    return this.community.waveRank(userId);
  }
}
