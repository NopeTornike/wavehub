import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { ListingType, STEAM_GENRES } from '@wavehub/shared-types';

export class BrowseListingsDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  gameId?: string;

  // Game by slug (e.g. `cs2`) — what the site's `/marketplace?game=` links carry, so a shared link
  // stays readable. Ignored when `gameId` is also given.
  @IsOptional()
  @IsString()
  @MaxLength(60)
  @Matches(/^[a-z0-9-]+$/)
  game?: string;

  @IsOptional()
  @IsIn([ListingType.Service, ListingType.Item, ListingType.DigitalKey])
  type?: ListingType;

  // Topbar / marketplace search: case-insensitive substring match on title, description and game
  // name. Bound as a parameter with LIKE wildcards escaped — never interpolated.
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  // Only listings whose seller currently holds the `featuredListings` subscription perk — the
  // home page's "Featured Items" rail.
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  featured?: boolean;

  // The prototype's sort menu. Default (`newest`) keeps the featured-perk boost first; the explicit
  // sorts are exactly what they say. A service's price is its cheapest package.
  // `popular` = most completed orders first.
  @IsOptional()
  @IsIn(['newest', 'oldest', 'price_asc', 'price_desc', 'popular'])
  sort?: 'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'popular';

  // Steam games (digital keys): the seller-entered genre attribute.
  @IsOptional()
  @IsIn(STEAM_GENRES.map(([key]) => key))
  genre?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  offset?: number = 0;
}
