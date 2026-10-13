import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
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
export class SetFeaturedDto {
  @IsBoolean()
  isFeatured: boolean;
}
