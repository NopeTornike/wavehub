import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { SubscriptionAudience } from '@wavehub/shared-types';
import type { PublicUserProfile } from '@wavehub/shared-types';
import { UsersService } from './users.service';
import { ListingsService } from '../listings/listings.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

// Public, unauthenticated — no guard. Only exposes fields safe to show an anonymous visitor (see
// PublicUserProfile's own comment for the exact list and why it's smaller than AdminUserSummary).
@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly listings: ListingsService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  @Get(':username')
  async getPublicProfile(@Param('username') username: string): Promise<PublicUserProfile> {
    const user = await this.users.findByUsername(username);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const activeListingCount = await this.listings.countActiveBySeller(user.id);
    // Seller/Coach badge takes priority over a Buyer one — see PublicUserProfile's own comment.
    const [sellerCoachPerks, buyerPerks] = await Promise.all([
      this.subscriptions.getActivePerks(user.id, SubscriptionAudience.SellerCoach),
      this.subscriptions.getActivePerks(user.id, SubscriptionAudience.Buyer),
    ]);
    const profileBadge = sellerCoachPerks?.profileBadge ?? buyerPerks?.profileBadge ?? null;
    return {
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      sellerRatingAvg: user.sellerRatingAvg,
      sellerRatingCount: user.sellerRatingCount,
      activeListingCount,
      createdAt: user.createdAt.toISOString(),
      profileBadge,
    };
  }
}
