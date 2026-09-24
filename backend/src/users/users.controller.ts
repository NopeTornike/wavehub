import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Game } from '../listings/game.entity';
import { SubscriptionAudience } from '@wavehub/shared-types';
import type { PublicUserProfile } from '@wavehub/shared-types';
import { UsersService } from './users.service';
import { ListingsService } from '../listings/listings.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { ProfilesService } from '../profiles/profiles.service';

// Public, unauthenticated — no guard. Only exposes fields safe to show an anonymous visitor (see
// PublicUserProfile's own comment for the exact list and why it's smaller than AdminUserSummary).
@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly listings: ListingsService,
    private readonly subscriptions: SubscriptionsService,
    private readonly profiles: ProfilesService,
    @InjectRepository(Game) private readonly games: Repository<Game>,
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
    const mainGameIds = user.mainGameIds ?? [];
    const mainGames = mainGameIds.length
      ? (await this.games.find({ where: { id: In(mainGameIds) }, select: ['id', 'name', 'slug'] })).map((g) => ({ name: g.name, slug: g.slug }))
      : [];
    const facts = await this.profiles.facts(user.id, user.lastSeenAt ?? null, activeListingCount);
    return {
      ...facts,
      userId: user.id,
      shortId: user.id.replace(/-/g, '').slice(0, 8).toUpperCase(),
      location: user.location ?? null,
      tagline: user.tagline ?? null,
      platform: user.platform ?? null,
      preferredRole: user.preferredRole ?? null,
      achievement: user.achievement ?? null,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      sellerRatingAvg: user.sellerRatingAvg,
      sellerRatingCount: user.sellerRatingCount,
      activeListingCount,
      createdAt: user.createdAt.toISOString(),
      profileBadge,
      bio: user.bio ?? null,
      avatarUrl: user.avatarUrl ?? null,
      mainGames,
    };
  }
}
