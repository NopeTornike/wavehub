import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { ListingStatus, ListingType } from '@wavehub/shared-types';

// GET admin/listings — moderator search across every status.
export class AdminListingSearchDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  q?: string;

  @IsOptional()
  @IsEnum(ListingStatus)
  status?: ListingStatus;

  @IsOptional()
  @IsEnum(ListingType)
  type?: ListingType;

  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

// POST admin/listings/:id/featured — pick/unpick a listing for the home "Featured Items" rail.
export class SetVerifiedDto {
  @IsBoolean()
  verified: boolean;
}

export class SetFeaturedDto {
  @IsBoolean()
  isFeatured: boolean;
}

// POST admin/listings/:id/sold — the SOLD overlay (owner 2026-11-06).
export class SetSoldDto {
  @IsBoolean()
  sold: boolean;
}

// POST admin/listings/:id/badges — badges staff assign by hand (owner 2026-11-08). VERIFIED has its
// own route (it means a real ownership check), so it isn't assignable here.
export const MANUAL_LISTING_BADGES = ['hot', 'trending', 'price_drop', 'most_popular', 'most_viewed', 'just_updated'] as const;
export class SetManualBadgesDto {
  @IsArray()
  @ArrayMaxSize(6)
  @IsIn(MANUAL_LISTING_BADGES, { each: true })
  badges: string[];
}

// POST admin/listings/:id/cover-overlay — the Tournament Gift cover or none (owner 2026-11-09). A
// custom image goes through POST admin/listings/:id/cover-overlay/image (multipart).
export class SetCoverOverlayDto {
  @IsIn(['gift', 'none'])
  overlay: 'gift' | 'none';
}

// POST admin/listings/:id/pin — pin to the first places of the marketplace (owner 2026-11-09).
export class SetPinnedDto {
  @IsBoolean()
  pinned: boolean;
}
