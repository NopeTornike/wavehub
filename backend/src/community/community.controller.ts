import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { GameListingCount, OnlineStats, SellerLeaderboard, SellerLeaderboardPeriod, SellerLeaderboardSort, SellerRanks, WaveRank } from '@wavehub/shared-types';
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

  // Public: username → Wave rank tier name, for sellers with live listings (marketplace cards).
  @Get('stats/seller-tiers')
  sellerTiers(): Promise<Record<string, string>> {
    return this.community.sellerTiers();
  }

  @Get('stats/seller-ranks')
  sellerRanks(): Promise<SellerRanks> {
    return this.community.sellerRanks();
  }

  // Public: the marketplace sellers leaderboard (top 5 + totals). Unknown query values fall back to
  // the defaults rather than 400, so a stale link still renders.
  @Get('stats/seller-leaderboard')
  sellerLeaderboard(@Query('sort') sort?: string, @Query('period') period?: string): Promise<SellerLeaderboard> {
    const s: SellerLeaderboardSort = sort === 'products' || sort === 'sales' || sort === 'rating' ? sort : 'overall';
    const p: SellerLeaderboardPeriod = period === '30d' || period === '7d' ? period : 'all';
    return this.community.sellerLeaderboard(s, p);
  }

  @Get('me/wave-rank')
  @UseGuards(AuthGuard)
  waveRank(@CurrentUserId() userId: string): Promise<WaveRank> {
    return this.community.waveRank(userId);
  }
}
