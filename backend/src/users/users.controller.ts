import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import type { PublicUserProfile } from '@wavehub/shared-types';
import { UsersService } from './users.service';
import { ListingsService } from '../listings/listings.service';

// Public, unauthenticated — no guard. Only exposes fields safe to show an anonymous visitor (see
// PublicUserProfile's own comment for the exact list and why it's smaller than AdminUserSummary).
@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly listings: ListingsService,
  ) {}

  @Get(':username')
  async getPublicProfile(@Param('username') username: string): Promise<PublicUserProfile> {
    const user = await this.users.findByUsername(username);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const activeListingCount = await this.listings.countActiveBySeller(user.id);
    return {
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      sellerRatingAvg: user.sellerRatingAvg,
      sellerRatingCount: user.sellerRatingCount,
      activeListingCount,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
